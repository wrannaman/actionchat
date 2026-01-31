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
    if (value === undefined || value === null) continue;

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
    if (args[key] !== undefined) {
      body[key] = args[key];
    }
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
async function executeMcpTool({ tool, source, args, userCredentials }) {
  const startTime = Date.now();
  const toolName = tool.mcp_tool_name || tool.path;

  // Build MCP config, injecting user credentials into env if provided
  const mcpConfig = {
    mcp_server_uri: source.mcp_server_uri,
    mcp_transport: source.mcp_transport || 'stdio',
    mcp_env: {
      ...(source.mcp_env || {}),
      // Inject credentials as environment variables if provided
      ...(userCredentials?.env_vars || {}),
    },
  };

  try {
    const result = await mcpManager.callTool(source.id, mcpConfig, toolName, args);
    const duration_ms = Date.now() - startTime;

    // Parse the MCP result
    const parsed = parseMcpResult(result);

    return {
      url: `mcp://${source.name}/${toolName}`,
      response_status: parsed.isError ? 500 : 200,
      response_body: parsed.data || { text: parsed.text },
      duration_ms,
      error_message: parsed.isError ? parsed.text : null,
    };
  } catch (error) {
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
