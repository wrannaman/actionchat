/**
 * Tool Executor
 * 
 * Executes API tools (HTTP and MCP) with proper auth, argument handling,
 * and response formatting.
 */

import { callMCPTool } from '../mcp/client.js';
import { parseToolResult as parseMcpResult } from '../mcp/parser.js';
import { preProcessArgs, postProcessResult } from '../mcp/hints.js';
import { getContentType, applyBeforeRequest, applyAfterResponse, getAdapterHeaders } from '../vendors/index.js';

// For successful responses, we only need a brief summary for the LLM
// The UI renders the full data - no need to send it all back to the LLM
const MAX_LLM_SUMMARY_SIZE = 500; // Brief summary for LLM
const MAX_ERROR_SIZE = 2 * 1024; // More detail for errors

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
    // Skip empty values - don't send empty strings or empty arrays to APIs
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;

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
      if (Array.isArray(value) && value.length === 0) continue;
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
    if (Array.isArray(value) && value.length === 0) continue;
    body[key] = value;
  }
  return Object.keys(body).length > 0 ? body : null;
}

/**
 * Build form-urlencoded body from object.
 * Handles nested objects using Stripe's bracket notation (e.g., metadata[key]=value)
 *
 * @param {object} body - Body object to encode
 * @returns {string} URL-encoded body string
 */
function buildFormEncodedBody(body) {
  const params = new URLSearchParams();

  function addParams(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const paramKey = prefix ? `${prefix}[${key}]` : key;

      if (value === null || value === undefined) {
        continue;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        addParams(value, paramKey);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            addParams(item, `${paramKey}[${index}]`);
          } else {
            params.append(`${paramKey}[${index}]`, String(item));
          }
        });
      } else {
        params.append(paramKey, String(value));
      }
    }
  }

  addParams(body);
  return params.toString();
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
 * Strip empty values from args object.
 * LLMs often pass empty strings for optional params - APIs don't want those.
 */
function cleanArgs(args) {
  const cleaned = {};
  for (const [key, value] of Object.entries(args || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Execute an MCP tool call.
 */
async function executeMcpTool({ tool, source, args, userCredentials }) {
  const startTime = Date.now();
  const toolName = tool.mcp_tool_name || tool.path;

  // Get hints from template (managed centrally, applied at runtime)
  const hints = source.template?.mcp_hints || {};

  // Clean empty values before sending to MCP
  const cleanedArgs = cleanArgs(args);

  // Apply hints to args (e.g., add default expand parameter)
  const processedArgs = preProcessArgs(cleanedArgs, toolName, hints);

  console.log('[MCP EXEC] ══════════════════════════════════════════');
  console.log('[MCP EXEC] Tool:', toolName);
  console.log('[MCP EXEC] Source:', source.name, '|', source.source_type);
  console.log('[MCP EXEC] Template:', source.template?.slug || '(none)');
  console.log('[MCP EXEC] Has hints:', Object.keys(hints).length > 0);
  console.log('[MCP EXEC] Server URI:', source.mcp_server_uri);
  console.log('[MCP EXEC] Raw args from LLM:', JSON.stringify(args, null, 2));
  console.log('[MCP EXEC] Cleaned args:', JSON.stringify(cleanedArgs, null, 2));
  console.log('[MCP EXEC] Processed args (with hints):', JSON.stringify(processedArgs, null, 2));
  if (Object.keys(hints).length > 0) {
    console.log('[MCP EXEC] Applied hints:', JSON.stringify(hints, null, 2));
  }
  console.log('[MCP EXEC] Has credentials:', !!userCredentials);
  console.log('[MCP EXEC] ══════════════════════════════════════════');

  try {
    console.log('[MCP EXEC] Calling callMCPTool...');
    const result = await callMCPTool(source, userCredentials, toolName, processedArgs);
    const duration_ms = Date.now() - startTime;

    console.log('[MCP EXEC] Raw result:', JSON.stringify(result, null, 2).slice(0, 8000));

    // Parse the MCP result
    const parsed = parseMcpResult(result);

    // Apply post-processing hints (detect thin data, unwrap, etc.)
    const processedData = postProcessResult(parsed.data, toolName, hints);

    console.log('[MCP EXEC] Parsed:', { isError: parsed.isError, hasData: !!parsed.data, textLen: parsed.text?.length });
    console.log('[MCP EXEC] Duration:', duration_ms, 'ms');

    // Debug: Log structure of returned data to help debug missing fields
    if (processedData) {
      const data = processedData;
      if (Array.isArray(data)) {
        console.log('[MCP EXEC] Data is array with', data.length, 'items');
        if (data[0]) {
          console.log('[MCP EXEC] First item keys:', Object.keys(data[0]));
          if (Object.keys(data[0]).length <= 2) {
            console.log('[MCP EXEC] ⚠️ THIN RESULT: Only got', Object.keys(data[0]).join(', '));
          }
        }
      } else if (data.data && Array.isArray(data.data)) {
        console.log('[MCP EXEC] Data.data is array with', data.data.length, 'items');
        if (data.data[0]) {
          console.log('[MCP EXEC] First item keys:', Object.keys(data.data[0]));
        }
      }
    }

    return {
      url: `mcp://${source.name}/${toolName}`,
      response_status: parsed.isError ? 500 : 200,
      response_body: processedData || { text: parsed.text },
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
 */
async function executeHttpTool({ tool, source, args, userCredentials, userId }) {
  const startTime = Date.now();

  console.log('[HTTP EXEC] ══════════════════════════════════════════');
  console.log('[HTTP EXEC] Tool:', tool.name, '|', tool.method, tool.path);
  console.log('[HTTP EXEC] Source:', source?.name, '| base_url:', source?.base_url);
  console.log('[HTTP EXEC] Source keys:', source ? Object.keys(source) : 'null');
  console.log('[HTTP EXEC] Raw args:', JSON.stringify(args, null, 2));
  console.log('[HTTP EXEC] ══════════════════════════════════════════');

  // Apply vendor adapter's beforeRequest transformation
  const processedArgs = applyBeforeRequest(args, tool, source);

  const url = buildUrl(source.base_url, tool.path, processedArgs, tool.parameters);
  console.log('[HTTP EXEC] Built URL:', url);

  // Get content type from vendor adapter (defaults to 'json')
  const contentType = getContentType(source);
  const useFormEncoded = contentType === 'form-urlencoded';

  try {
    const authHeaders = buildAuthHeaders(source, userCredentials);
    const adapterHeaders = getAdapterHeaders(source, userCredentials);

    const fetchOptions = {
      method: tool.method,
      headers: {
        'Content-Type': useFormEncoded ? 'application/x-www-form-urlencoded' : 'application/json',
        'Accept': 'application/json',
        ...authHeaders,
        ...adapterHeaders,
        // Pass user ID for per-user mock data isolation
        ...(userId ? { 'X-Mock-User': userId } : {}),
      },
    };

    // Add body for methods that support it
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(tool.method)) {
      const body = buildRequestBody(processedArgs, tool.parameters, tool.request_body);
      if (body) {
        if (useFormEncoded) {
          // Convert to form-urlencoded format (Stripe style)
          fetchOptions.body = buildFormEncodedBody(body);
        } else {
          fetchOptions.body = JSON.stringify(body);
        }
      }
    }

    const response = await fetch(url, fetchOptions);
    const duration_ms = Date.now() - startTime;

    let response_body;
    const responseContentType = response.headers.get('content-type') || '';
    if (responseContentType.includes('application/json')) {
      response_body = await response.json();
    } else {
      const text = await response.text();
      response_body = { text: text.slice(0, MAX_ERROR_SIZE) };
    }

    // Apply vendor adapter's afterResponse transformation
    const transformedBody = applyAfterResponse(response_body, tool, source);

    return {
      url,
      response_status: response.status,
      response_body: transformedBody,
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
 * Format tool result for LLM context.
 *
 * IMPORTANT: The UI renders full results. The LLM only needs a brief summary
 * to understand what happened - NOT the full data.
 *
 * For success: Brief summary (count, key identifiers)
 * For errors: More detail to help diagnose
 */
export function formatToolResult(result) {
  if (result.error_message && !result.response_body) {
    return `Error: ${result.error_message}`;
  }

  const status = result.response_status;
  const body = result.response_body;

  // Error responses - give more detail for debugging
  if (status < 200 || status >= 300) {
    let errorDetail;
    if (typeof body === 'string') {
      errorDetail = body;
    } else {
      errorDetail = JSON.stringify(body, null, 2);
    }
    if (errorDetail.length > MAX_ERROR_SIZE) {
      errorDetail = errorDetail.slice(0, MAX_ERROR_SIZE) + '... (truncated)';
    }
    return `HTTP ${status} Error:\n${errorDetail}`;
  }

  // Success - return a BRIEF summary, not the full data
  // The UI already displays the full response
  return summarizeForLLM(body);
}

/**
 * Create a brief summary of API response for LLM context.
 * The UI shows full data - LLM just needs to know what happened.
 */
function summarizeForLLM(body) {
  if (!body) return 'Success (empty response)';

  // String response
  if (typeof body === 'string') {
    if (body.length <= MAX_LLM_SUMMARY_SIZE) return body;
    return body.slice(0, MAX_LLM_SUMMARY_SIZE) + '...';
  }

  // Stripe-style list response: { data: [...], has_more: bool }
  if (body.data && Array.isArray(body.data)) {
    const count = body.data.length;
    const hasMore = body.has_more ? ' (has_more: true)' : '';
    const firstItem = body.data[0];

    // Include first item's key identifiers for context
    if (firstItem) {
      const id = firstItem.id || '';
      const type = firstItem.object || '';
      const name = firstItem.name || firstItem.email || firstItem.description || '';
      const preview = [type, name].filter(Boolean).join(': ');
      return `Success: ${count} items returned${hasMore}. First: ${id}${preview ? ` (${preview})` : ''}`;
    }
    return `Success: ${count} items returned${hasMore}`;
  }

  // Single object response
  if (body.id) {
    const type = body.object || 'object';
    const name = body.name || body.email || body.description || '';
    return `Success: ${type} ${body.id}${name ? ` (${name})` : ''}`;
  }

  // Generic object - just confirm success with minimal info
  const keys = Object.keys(body);
  if (keys.length <= 5) {
    return `Success: {${keys.join(', ')}}`;
  }
  return `Success: object with ${keys.length} fields`;
}

export default {
  executeTool,
  formatToolResult,
  buildUrl,
  buildAuthHeaders,
  buildRequestBody,
};
