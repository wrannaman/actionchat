/**
 * MCP Parser
 *
 * Converts MCP tool definitions to ActionChat tools format.
 * Handles risk level detection and confirmation requirements.
 */

/**
 * Keywords that indicate a potentially dangerous/destructive operation
 */
const DANGEROUS_KEYWORDS = [
  'delete', 'remove', 'destroy', 'drop', 'truncate', 'clear',
  'purge', 'wipe', 'reset', 'revoke', 'terminate', 'kill',
  'cancel', 'disable', 'deactivate', 'suspend', 'ban', 'block',
];

const MODERATE_KEYWORDS = [
  'update', 'modify', 'edit', 'change', 'set', 'patch',
  'write', 'create', 'insert', 'add', 'post', 'put',
  'send', 'execute', 'run', 'trigger', 'invoke',
];

const SAFE_KEYWORDS = [
  'get', 'list', 'read', 'fetch', 'query', 'search',
  'find', 'show', 'describe', 'inspect', 'view', 'check',
];

/**
 * Determine risk level based on tool name and description
 *
 * @param {string} name - Tool name
 * @param {string} description - Tool description
 * @returns {'safe' | 'moderate' | 'dangerous'}
 */
export function determineRiskLevel(name, description = '') {
  const text = `${name} ${description}`.toLowerCase();

  // Check for dangerous keywords first
  for (const keyword of DANGEROUS_KEYWORDS) {
    if (text.includes(keyword)) {
      return 'dangerous';
    }
  }

  // Check for safe keywords - if found, it's safe
  for (const keyword of SAFE_KEYWORDS) {
    if (text.startsWith(keyword) || name.toLowerCase().startsWith(keyword)) {
      return 'safe';
    }
  }

  // Check for moderate keywords
  for (const keyword of MODERATE_KEYWORDS) {
    if (text.includes(keyword)) {
      return 'moderate';
    }
  }

  // Default to safe for read-like operations
  return 'safe';
}

/**
 * Convert MCP input schema to ActionChat parameters format
 *
 * @param {object} inputSchema - MCP tool input schema (JSON Schema)
 * @returns {object} ActionChat parameters schema
 */
export function convertInputSchema(inputSchema) {
  if (!inputSchema) {
    return { type: 'object', properties: {} };
  }

  // MCP uses standard JSON Schema, which is compatible with ActionChat
  // We just need to ensure proper structure
  return {
    type: inputSchema.type || 'object',
    properties: inputSchema.properties || {},
    required: inputSchema.required || [],
    additionalProperties: inputSchema.additionalProperties,
  };
}

/**
 * Generate a human-readable name from a tool name
 *
 * @param {string} name - Original tool name (e.g., 'read_file', 'listUsers')
 * @returns {string} Human-readable name
 */
export function humanizeName(name) {
  // Handle snake_case
  let result = name.replace(/_/g, ' ');

  // Handle camelCase
  result = result.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Handle kebab-case
  result = result.replace(/-/g, ' ');

  // Capitalize first letter of each word
  result = result
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return result;
}

/**
 * Convert a single MCP tool to ActionChat tool format
 *
 * @param {object} mcpTool - MCP tool definition
 * @param {string} sourceId - The source UUID this tool belongs to
 * @returns {object} ActionChat tool record
 */
export function convertTool(mcpTool, sourceId) {
  const { name, description, inputSchema } = mcpTool;

  const riskLevel = determineRiskLevel(name, description);
  const requiresConfirmation = riskLevel === 'dangerous';

  return {
    source_id: sourceId,
    operation_id: name, // Use MCP tool name as operation_id for syncing
    name: humanizeName(name),
    description: description || `Execute ${name}`,
    method: 'MCP', // Special method type for MCP tools
    path: name, // Store the tool name in path for reference
    parameters: convertInputSchema(inputSchema),
    request_body: null, // MCP tools use inputSchema, not separate request_body
    mcp_tool_name: name,
    risk_level: riskLevel,
    requires_confirmation: requiresConfirmation,
    tags: extractTags(name, description),
    is_active: true,
  };
}

/**
 * Extract relevant tags from tool name and description
 *
 * @param {string} name - Tool name
 * @param {string} description - Tool description
 * @returns {string[]} Array of tags
 */
function extractTags(name, description = '') {
  const tags = new Set();
  const text = `${name} ${description}`.toLowerCase();

  // Common category tags
  const categoryKeywords = {
    file: ['file', 'directory', 'folder', 'path', 'read', 'write'],
    database: ['database', 'db', 'sql', 'query', 'table', 'record'],
    git: ['git', 'commit', 'branch', 'repository', 'repo'],
    api: ['api', 'http', 'request', 'response', 'endpoint'],
    auth: ['auth', 'token', 'credential', 'password', 'login'],
    search: ['search', 'find', 'query', 'filter'],
    notification: ['notify', 'alert', 'message', 'email', 'sms'],
  };

  for (const [tag, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        tags.add(tag);
        break;
      }
    }
  }

  // Add risk-based tag
  const riskLevel = determineRiskLevel(name, description);
  if (riskLevel === 'dangerous') {
    tags.add('destructive');
  }

  return Array.from(tags);
}

/**
 * Convert an array of MCP tools to ActionChat format
 *
 * @param {object[]} mcpTools - Array of MCP tool definitions
 * @param {string} sourceId - The source UUID these tools belong to
 * @returns {object[]} Array of ActionChat tool records
 */
export function convertTools(mcpTools, sourceId) {
  return mcpTools.map((tool) => convertTool(tool, sourceId));
}

/**
 * Parse MCP tool result content into a readable format
 *
 * @param {object} result - MCP tool call result
 * @returns {object} Parsed result with text and structured data
 */
export function parseToolResult(result) {
  if (!result || !result.content) {
    return { text: '', data: null };
  }

  const content = result.content;
  let text = '';
  let data = null;

  // MCP returns content as an array of content blocks
  for (const block of content) {
    if (block.type === 'text') {
      text += block.text;
    } else if (block.type === 'image') {
      text += `[Image: ${block.mimeType || 'image'}]`;
    } else if (block.type === 'resource') {
      text += `[Resource: ${block.uri}]`;
      if (block.text) {
        text += '\n' + block.text;
      }
    }
  }

  // Try to parse as JSON if it looks like JSON
  const trimmed = text.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      data = JSON.parse(trimmed);
    } catch {
      // Not valid JSON, keep as text
    }
  }

  return {
    text,
    data,
    isError: result.isError || false,
  };
}

export default {
  determineRiskLevel,
  convertInputSchema,
  humanizeName,
  convertTool,
  convertTools,
  parseToolResult,
};
