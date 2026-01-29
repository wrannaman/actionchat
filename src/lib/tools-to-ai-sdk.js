import { tool, jsonSchema } from 'ai';
import { executeTool, formatToolResult } from './tool-executor';

/**
 * Convert database tool rows (from get_agent_tools RPC) into AI SDK tool definitions.
 *
 * All tools get execute functions (server-side execution).
 * Dangerous/confirmation-required tools also get needsApproval: true,
 * which triggers the approval flow on the client before execution.
 *
 * @param {Array} toolRows - Rows from get_agent_tools RPC
 * @param {object} opts
 * @param {Map} opts.sourceMap - Map of source name → source config (auth_type, auth_config, base_url)
 * @param {string|null} opts.userAuthToken - User's passthrough API token
 * @returns {object} AI SDK tools object keyed by tool identifier
 */
export function convertToolsToAISDK(toolRows, { sourceMap, userAuthToken }) {
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

    // Build merged parameter schema for the LLM
    const inputSchema = buildInputSchema(row);

    const description = [
      row.description,
      `(${row.method} ${row.path})`,
      needsConfirmation ? '[requires confirmation]' : '',
    ].filter(Boolean).join(' ');

    const toolDef = {
      description,
      parameters: inputSchema,
      execute: async (args) => {
        const result = await executeTool({
          tool: row,
          source,
          args,
          userAuthToken,
        });
        return {
          _actionchat: {
            tool_id: row.tool_id,
            tool_name: row.tool_name,
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

  // Add path/query parameters (strip the `in` field — LLM doesn't need it)
  if (toolRow.parameters?.properties) {
    for (const [name, schema] of Object.entries(toolRow.parameters.properties)) {
      const { in: _in, ...rest } = schema;
      properties[name] = {
        ...rest,
        description: rest.description || `${_in} parameter: ${name}`,
      };
    }
    if (toolRow.parameters.required) {
      required.push(...toolRow.parameters.required);
    }
  }

  // Add request body properties
  if (toolRow.request_body?.properties) {
    for (const [name, schema] of Object.entries(toolRow.request_body.properties)) {
      properties[name] = schema;
    }
    if (toolRow.request_body.required) {
      required.push(...toolRow.request_body.required);
    }
  }

  if (Object.keys(properties).length === 0) {
    return jsonSchema({ type: 'object', properties: {} });
  }

  return jsonSchema({
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  });
}

/**
 * Create a safe, unique key for a tool. AI SDK tool keys must be valid identifiers.
 */
function sanitizeToolKey(toolName, toolId) {
  const key = toolName
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);

  const shortId = toolId.slice(0, 8);
  return `${key}_${shortId}`;
}
