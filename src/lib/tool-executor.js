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
 * Build Authorization/auth headers from source config.
 *
 * @param {object} source - Source with auth_type and auth_config
 * @param {string|null} userAuthToken - User-provided token for passthrough auth
 * @returns {object} Headers to add to the request
 */
export function buildAuthHeaders(source, userAuthToken) {
  const headers = {};

  switch (source.auth_type) {
    case 'bearer':
      if (source.auth_config?.token) {
        headers['Authorization'] = `Bearer ${source.auth_config.token}`;
      }
      break;

    case 'api_key': {
      const headerName = source.auth_config?.header_name || 'X-API-Key';
      const apiKey = source.auth_config?.api_key;
      if (apiKey) {
        headers[headerName] = apiKey;
      }
      break;
    }

    case 'basic': {
      const { username, password } = source.auth_config || {};
      if (username) {
        const encoded = Buffer.from(`${username}:${password || ''}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
      break;
    }

    case 'passthrough':
      if (userAuthToken) {
        headers['Authorization'] = `Bearer ${userAuthToken}`;
      } else {
        throw new Error(
          'This API requires your credentials. Provide your API token in the chat settings (gear icon).'
        );
      }
      break;

    case 'none':
    default:
      break;
  }

  return headers;
}

/**
 * Execute an API tool call against the target service.
 *
 * @param {object} params
 * @param {object} params.tool - Tool row from get_agent_tools
 * @param {object} params.source - Source with auth_type, auth_config, base_url
 * @param {object} params.args - LLM-generated arguments
 * @param {string|null} params.userAuthToken - User's passthrough token
 * @returns {{ response_status: number, response_body: any, duration_ms: number, url: string, error_message?: string }}
 */
export async function executeTool({ tool, source, args, userAuthToken }) {
  const startTime = Date.now();
  const url = buildUrl(source.base_url, tool.path, args, tool.parameters);

  try {
    const authHeaders = buildAuthHeaders(source, userAuthToken);

    const fetchOptions = {
      method: tool.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders,
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
