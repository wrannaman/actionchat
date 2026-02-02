/**
 * Tool Converter
 * 
 * Convert database tool rows (from get_agent_tools RPC) into AI SDK tool definitions.
 */

import { tool, jsonSchema } from 'ai';
import { executeTool, formatToolResult } from './executor.js';

/**
 * Convert database tool rows (from get_agent_tools RPC) into AI SDK tool definitions.
 *
 * All tools get execute functions (server-side execution).
 * Dangerous/confirmation-required tools also get needsApproval: true,
 * which triggers the approval flow on the client before execution.
 *
 * @param {Array} toolRows - Rows from get_agent_tools RPC
 * @param {object} opts
 * @param {Map} opts.sourceMap - Map of source name → source config (auth_type, base_url, name)
 * @param {Map} opts.userCredentialsMap - Map of source_id → user's credentials for that source
 * @param {string|null} opts.userId - User ID for per-user mock data isolation
 * @returns {object} AI SDK tools object keyed by tool identifier
 */
export function convertToolsToAISDK(toolRows, { sourceMap, userCredentialsMap, userId }) {
  const tools = {};

  for (const row of toolRows) {
    const toolKey = sanitizeToolKey(row.tool_name, row.tool_id);
    const source = sourceMap.get(row.source_name);
    const needsConfirmation = row.requires_confirmation || row.risk_level === 'dangerous';
    const isReadOnly = row.permission === 'read';

    // Skip write tools if agent only has read permission on this source
    if (isReadOnly && !['GET', 'HEAD', 'OPTIONS'].includes(row.method)) {
      continue;
    }

    if (!source) continue;

    // Get user's credentials for this source
    const userCredentials = userCredentialsMap?.get(source.id) || null;

    // Build merged parameter schema for the LLM
    const inputSchema = buildInputSchema(row);

    const description = [
      row.description,
      `(${row.method} ${row.path})`,
      needsConfirmation ? '[requires confirmation]' : '',
    ].filter(Boolean).join(' ');

    const toolDef = {
      description,
      inputSchema: inputSchema,
      execute: async (args) => {
        const result = await executeTool({
          tool: row,
          source,
          args,
          userCredentials,
          userId,
        });
        return {
          _actionchat: {
            tool_id: row.tool_id,
            tool_name: row.tool_name,
            source_id: source.id,
            source_name: source.name,
            method: row.method,
            url: result.url,
            request_body: args,
            response_status: result.response_status,
            response_body: result.response_body,
            duration_ms: result.duration_ms,
            error_message: result.error_message,
          },
          result: formatToolResult(result),
        };
      },
    };

    // Dangerous tools require user approval before execution
    if (needsConfirmation) {
      toolDef.needsApproval = true;
    }

    tools[toolKey] = tool(toolDef);
  }

  return tools;
}

/**
 * Build a merged JSON Schema for the LLM input, combining path/query parameters
 * and request body into a single schema.
 */
function buildInputSchema(toolRow) {
  const properties = {};
  const required = [];

  // Clean raw data first to remove "None" types at source
  const params = deepCleanSchema(toolRow.parameters || {});
  const body = deepCleanSchema(toolRow.request_body || {});

  // Add path/query parameters (strip the `in` field — LLM doesn't need it)
  if (params.properties && typeof params.properties === 'object') {
    for (const [name, schema] of Object.entries(params.properties)) {
      if (!schema || typeof schema !== 'object') continue;
      const { in: _in, ...rest } = schema;
      properties[name] = {
        ...rest,
        type: rest.type || 'string',
        description: rest.description || `${_in || 'query'} parameter: ${name}`,
      };
    }
    if (Array.isArray(params.required)) {
      required.push(...params.required);
    }
  }

  // Add request body properties - handle both wrapped and unwrapped schemas
  const bodyProps = body.properties || (body.type === 'object' ? {} : null);

  if (bodyProps && typeof bodyProps === 'object') {
    for (const [name, schema] of Object.entries(bodyProps)) {
      if (!schema || typeof schema !== 'object') continue;
      properties[name] = {
        ...schema,
        type: schema.type || 'string',
      };
    }
    if (Array.isArray(body.required)) {
      required.push(...body.required);
    }
  }

  // Always return a valid object schema - explicitly set type last to prevent overrides
  const schema = {
    properties: properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  // Force type: object - this must be last to prevent any override
  schema.type = 'object';

  // Final validation before wrapping
  const finalSchema = deepCleanSchema(schema);

  return jsonSchema(finalSchema);
}

/**
 * Deep clean a schema object to remove all "None" type values.
 */
function deepCleanSchema(obj) {
  if (obj === null || obj === undefined) {
    return { type: 'string' };
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepCleanSchema);
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'type' && (value === 'None' || value === 'null' || value === null)) {
      result[key] = 'string';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = deepCleanSchema(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}


/**
 * Create a safe, unique key for a tool. AI SDK tool keys must be valid identifiers.
 * OpenAI limits tool names to 64 characters, so we use: name (max 55) + "_" + id (8) = 64
 */
function sanitizeToolKey(toolName, toolId) {
  const key = toolName
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 55);  // 55 + 1 (underscore) + 8 (id) = 64 chars max

  const shortId = toolId.slice(0, 8);
  return `${key}_${shortId}`;
}

export default {
  convertToolsToAISDK,
};
