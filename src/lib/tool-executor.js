import * as mcpManager from './mcp-manager.js';
import { parseToolResult as parseMcpResult } from './mcp-parser.js';

const MAX_RESPONSE_SIZE = 10 * 1024; // 10KB limit for LLM context

/**
 * Build the full URL by substituting path parameters and appending query params.
 *
 * @param {string} baseUrl - e.g. "https://api.stripe.com/v1"
 * @param {string} path - e.g. "/refunds/{id}"
 * @param {object} args - All arguments from the LLM
 * @param {object|null} paramSchema - The tool's parameters JSON Schema
 * @returns {string} Fully resolved URL
 */
export function buildUrl(baseUrl, path, args, paramSchema) {
  let resolvedPath = path;
  const queryParams = new URLSearchParams();
  const properties = paramSchema?.properties || {};

  for (const [name, schema] of Object.entries(properties)) {
    const value = args[name];
    // Skip empty values - don't send empty strings to APIs
    if (value === undefined || value === null || value === '') continue;

    if (schema.in === 'path') {
      resolvedPath = resolvedPath.replace(`{${name}}`, encodeURIComponent(value));
    } else if (schema.in === 'query') {
      queryParams.set(name, String(value));
    }
  }

  // Clean up base URL trailing slash and path leading slash
  const base = baseUrl.replace(/\/+$/, '');
  const cleanPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
  const qs = queryParams.toString();

  return `${base}${cleanPath}${qs ? `?${qs}` : ''}`;
}

/**
 * Build request body from args, excluding path/query params.
 *
 * @param {object} args - All arguments from the LLM
 * @param {object|null} paramSchema - The tool's parameters JSON Schema
 * @param {object|null} requestBodySchema - The tool's request_body JSON Schema
 * @returns {object|null} Request body to send
 */
export function buildRequestBody(args, paramSchema, requestBodySchema) {
  if (!requestBodySchema) {
    // No explicit request body schema — filter out path/query params, use rest as body
    const paramProps = paramSchema?.properties || {};
    const body = {};
    for (const [key, value] of Object.entries(args)) {
      // Skip empty values
      if (value === undefined || value === null || value === '') continue;
      const paramDef = paramProps[key];
      if (paramDef && (paramDef.in === 'path' || paramDef.in === 'query')) continue;
      body[key] = value;
    }
    return Object.keys(body).length > 0 ? body : null;
  }

  // Has explicit request body schema — extract matching keys
  const bodyProps = requestBodySchema.properties || {};
  const body = {};
  for (const key of Object.keys(bodyProps)) {
    const value = args[key];
    // Skip empty values
    if (value === undefined || value === null || value === '') continue;
    body[key] = value;
  }
  return Object.keys(body).length > 0 ? body : null;
}

/**
 * Build Authorization/auth headers from user credentials.
 *
 * @param {object} source - Source with auth_type
 * @param {object|null} userCredentials - User's credentials from user_api_credentials table
 * @returns {object} Headers to add to the request
 */
export function buildAuthHeaders(source, userCredentials) {
  const headers = {};
  const creds = userCredentials || {};

  switch (source.auth_type) {
    case 'bearer':
      if (creds.token) {
        headers['Authorization'] = `Bearer ${creds.token}`;
      } else {
        throw new Error(
          `This API requires a Bearer token. Add your credentials for "${source.name}".`
        );
      }
      break;

    case 'api_key': {
      const headerName = creds.header_name || 'X-API-Key';
      const apiKey = creds.api_key;
      if (apiKey) {
        headers[headerName] = apiKey;
      } else {
        throw new Error(
          `This API requires an API key. Add your credentials for "${source.name}".`
        );
      }
      break;
    }

    case 'basic': {
      const { username, password } = creds;
      if (username) {
        const encoded = Buffer.from(`${username}:${password || ''}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      } else {
        throw new Error(
          `This API requires username/password. Add your credentials for "${source.name}".`
        );
      }
      break;
    }

    case 'header': {
      const { header_name, header_value } = creds;
      if (header_name && header_value) {
        headers[header_name] = header_value;
      } else {
        throw new Error(
          `This API requires a custom header. Add your credentials for "${source.name}".`
        );
      }
      break;
    }

    case 'none':
    default:
      // No auth needed
      break;
  }

  return headers;
}

/**
 * Execute an MCP tool call.
 *
 * @param {object} params
 * @param {object} params.tool - Tool row with mcp_tool_name
 * @param {object} params.source - Source with mcp_server_uri, mcp_transport, mcp_env
 * @param {object} params.args - LLM-generated arguments
 * @param {object|null} params.userCredentials - User's credentials (for env var injection)
 * @returns {{ response_status: number, response_body: any, duration_ms: number, url: string, error_message?: string }}
 */
/**
 * Strip empty values from args object.
 * LLMs often pass empty strings for optional params - APIs don't want those.
 */
function cleanArgs(args) {
  const cleaned = {};
  for (const [key, value] of Object.entries(args || {})) {
    if (value === undefined || value === null || value === '') continue;
    cleaned[key] = value;
  }
  return cleaned;
}

async function executeMcpTool({ tool, source, args, userCredentials }) {
  const startTime = Date.now();
  const toolName = tool.mcp_tool_name || tool.path;

  // Clean empty values before sending to MCP
  const cleanedArgs = cleanArgs(args);

  console.log('[MCP EXEC] ══════════════════════════════════════════');
  console.log('[MCP EXEC] Tool:', toolName);
  console.log('[MCP EXEC] Source:', source.name, '|', source.source_type);
  console.log('[MCP EXEC] Server URI:', source.mcp_server_uri);
  console.log('[MCP EXEC] Transport:', source.mcp_transport);
  console.log('[MCP EXEC] Raw args:', JSON.stringify(args, null, 2));
  console.log('[MCP EXEC] Cleaned args:', JSON.stringify(cleanedArgs, null, 2));
  console.log('[MCP EXEC] Has credentials:', !!userCredentials);
  console.log('[MCP EXEC] ══════════════════════════════════════════');

  // Determine auth token for HTTP MCP
  let mcpAuthToken = null;
  if (source.mcp_transport === 'http') {
    // For HTTP MCP with bearer auth, use the stored token
    mcpAuthToken = userCredentials?.token || userCredentials?.api_key;
  }

  // Build MCP config, injecting user credentials
  const mcpConfig = {
    mcp_server_uri: source.mcp_server_uri,
    mcp_transport: source.mcp_transport || 'stdio',
    mcp_auth_token: mcpAuthToken,
    mcp_env: {
      ...(source.mcp_env || {}),
      // Inject credentials as environment variables if provided (for stdio MCP)
      ...(userCredentials?.env_vars || {}),
    },
  };

  try {
    console.log('[MCP EXEC] Calling mcpManager.callTool...');
    const result = await mcpManager.callTool(source.id, mcpConfig, toolName, cleanedArgs);
    const duration_ms = Date.now() - startTime;

    console.log('[MCP EXEC] Raw result:', JSON.stringify(result, null, 2).slice(0, 8000));

    // Parse the MCP result
    const parsed = parseMcpResult(result);

    console.log('[MCP EXEC] Parsed:', { isError: parsed.isError, hasData: !!parsed.data, textLen: parsed.text?.length });
    console.log('[MCP EXEC] Duration:', duration_ms, 'ms');

    // Debug: Log structure of returned data to help debug missing fields
    if (parsed.data) {
      const data = parsed.data;
      if (Array.isArray(data)) {
        console.log('[MCP EXEC] Data is array with', data.length, 'items');
        if (data[0]) console.log('[MCP EXEC] First item keys:', Object.keys(data[0]));
      } else if (data.data && Array.isArray(data.data)) {
        console.log('[MCP EXEC] Data.data is array with', data.data.length, 'items');
        if (data.data[0]) {
          console.log('[MCP EXEC] First item keys:', Object.keys(data.data[0]));
          console.log('[MCP EXEC] First item email:', data.data[0].email);
          console.log('[MCP EXEC] First item name:', data.data[0].name);
        }
      }
    }

    return {
      url: `mcp://${source.name}/${toolName}`,
      response_status: parsed.isError ? 500 : 200,
      response_body: parsed.data || { text: parsed.text },
      duration_ms,
      error_message: parsed.isError ? parsed.text : null,
    };
  } catch (error) {
    console.error('[MCP EXEC] ERROR:', error.message);
    console.error('[MCP EXEC] Stack:', error.stack);
    return {
      url: `mcp://${source.name}/${toolName}`,
      response_status: 0,
      response_body: null,
      duration_ms: Date.now() - startTime,
      error_message: error.message,
    };
  }
}

/**
 * Execute an HTTP API tool call against the target service.
 *
 * @param {object} params
 * @param {object} params.tool - Tool row from get_agent_tools
 * @param {object} params.source - Source with auth_type, base_url, name
 * @param {object} params.args - LLM-generated arguments
 * @param {object|null} params.userCredentials - User's credentials for this source
 * @param {string|null} params.userId - User ID for per-user isolation (mock APIs)
 * @returns {{ response_status: number, response_body: any, duration_ms: number, url: string, error_message?: string }}
 */
async function executeHttpTool({ tool, source, args, userCredentials, userId }) {
  const startTime = Date.now();
  const url = buildUrl(source.base_url, tool.path, args, tool.parameters);

  try {
    const authHeaders = buildAuthHeaders(source, userCredentials);

    const fetchOptions = {
      method: tool.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders,
        // Pass user ID for per-user mock data isolation
        ...(userId ? { 'X-Mock-User': userId } : {}),
      },
    };

    // Add body for methods that support it
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(tool.method)) {
      const body = buildRequestBody(args, tool.parameters, tool.request_body);
      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }
    }

    const response = await fetch(url, fetchOptions);
    const duration_ms = Date.now() - startTime;

    let response_body;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      response_body = await response.json();
    } else {
      const text = await response.text();
      response_body = { text: text.slice(0, MAX_RESPONSE_SIZE) };
    }

    return {
      url,
      response_status: response.status,
      response_body,
      duration_ms,
      error_message: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      url,
      response_status: 0,
      response_body: null,
      duration_ms: Date.now() - startTime,
      error_message: error.message,
    };
  }
}

/**
 * Execute an API tool call against the target service.
 * Routes to HTTP or MCP execution based on source type.
 *
 * @param {object} params
 * @param {object} params.tool - Tool row from get_agent_tools
 * @param {object} params.source - Source with auth_type, base_url, name, source_type
 * @param {object} params.args - LLM-generated arguments
 * @param {object|null} params.userCredentials - User's credentials for this source
 * @param {string|null} params.userId - User ID for per-user isolation (mock APIs)
 * @returns {{ response_status: number, response_body: any, duration_ms: number, url: string, error_message?: string }}
 */
export async function executeTool({ tool, source, args, userCredentials, userId }) {
  // Route based on source type
  if (source.source_type === 'mcp' || tool.method === 'MCP') {
    return executeMcpTool({ tool, source, args, userCredentials });
  }

  // Default: HTTP execution
  return executeHttpTool({ tool, source, args, userCredentials, userId });
}

/**
 * Truncate a response body for inclusion in LLM context.
 * Returns a string summary suitable for the LLM to read.
 */
export function formatToolResult(result) {
  if (result.error_message && !result.response_body) {
    return `Error: ${result.error_message}`;
  }

  const body = result.response_body;
  let summary;
  if (typeof body === 'string') {
    summary = body;
  } else {
    summary = JSON.stringify(body, null, 2);
  }

  if (summary.length > MAX_RESPONSE_SIZE) {
    summary = summary.slice(0, MAX_RESPONSE_SIZE) + '\n... (response truncated)';
  }

  const status = result.response_status;
  if (status >= 200 && status < 300) {
    return summary;
  }
  return `HTTP ${status} Error:\n${summary}`;
}
