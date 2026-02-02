/**
 * MCP Client - Single MCP implementation using @ai-sdk/mcp
 *
 * This is the only MCP client in the codebase. All MCP operations go through here.
 * 
 * Uses @ai-sdk/mcp which provides:
 * - Tools in AI SDK format (for streamText)
 * - Raw listTools/callTool for sync and direct execution
 * - HTTP transport support
 * 
 * Only HTTP MCP is supported - stdio doesn't scale for multi-tenant.
 */

import { createMCPClient } from '@ai-sdk/mcp';

// Cache active MCP clients per source + credential
const clientCache = new Map();

/**
 * Generate cache key for connection pooling.
 * Each user's credentials get their own connection.
 */
function getCacheKey(sourceId, credentials) {
  const tokenSuffix = credentials?.token?.slice(-8) || credentials?.api_key?.slice(-8) || 'anon';
  return `${sourceId}:${tokenSuffix}`;
}

/**
 * Create or retrieve an MCP client for a source.
 *
 * @param {object} source - Source config with mcp_server_uri
 * @param {object} credentials - User credentials (token, api_key, etc.)
 * @returns {Promise<MCPClient>}
 */
export async function getMCPClient(source, credentials) {
  const cacheKey = getCacheKey(source.id, credentials);

  // Return cached client if available
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }

  const { mcp_server_uri } = source;
  const authToken = credentials?.token || credentials?.api_key;

  // Validate HTTP transport
  const isHttpUrl = mcp_server_uri?.startsWith('http://') || mcp_server_uri?.startsWith('https://');
  if (!isHttpUrl) {
    throw new Error(
      `Only HTTP MCP transport is supported. Got: ${mcp_server_uri}. ` +
      `Stdio MCP servers cannot run in multi-tenant deployments.`
    );
  }

  console.log('[MCP] ════════════════════════════════════════════');
  console.log('[MCP] Creating client for:', source.name);
  console.log('[MCP] URL:', mcp_server_uri);
  console.log('[MCP] Has auth:', !!authToken);
  console.log('[MCP] Cache key:', cacheKey);
  console.log('[MCP] ════════════════════════════════════════════');

  const transportConfig = {
    type: 'http',
    url: mcp_server_uri,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  };

  const client = await createMCPClient({ transport: transportConfig });

  clientCache.set(cacheKey, client);

  return client;
}

/**
 * Get AI SDK formatted tools from an MCP source.
 * These can be passed directly to streamText().
 *
 * @param {object} source - Source config
 * @param {object} credentials - User credentials
 * @returns {Promise<object>} Tools object for AI SDK
 */
export async function getMCPTools(source, credentials) {
  const client = await getMCPClient(source, credentials);
  const tools = await client.tools();

  console.log('[MCP] Loaded', Object.keys(tools).length, 'AI SDK tools from', source.name);

  return tools;
}

/**
 * List raw tools from an MCP source (for sync/discovery).
 * Returns the MCP protocol format, not AI SDK format.
 *
 * @param {object} source - Source config with mcp_server_uri
 * @param {object} credentials - User credentials
 * @returns {Promise<Array>} Array of tool definitions in MCP format
 */
export async function listMCPTools(source, credentials) {
  const client = await getMCPClient(source, credentials);
  const result = await client.listTools({});
  const tools = result.tools || [];

  console.log('[MCP] ═══════ TOOLS LIST ═══════');
  console.log('[MCP] Found', tools.length, 'tools from', source.name);
  for (const tool of tools.slice(0, 10)) {
    console.log('[MCP] Tool:', tool.name);
    console.log('[MCP]   Description:', tool.description?.slice(0, 100));
  }
  if (tools.length > 10) {
    console.log('[MCP]   ... and', tools.length - 10, 'more');
  }
  console.log('[MCP] ═══════════════════════════');

  return tools;
}

/**
 * Call a tool on an MCP server.
 *
 * @param {object} source - Source config
 * @param {object} credentials - User credentials
 * @param {string} toolName - The MCP tool name to call
 * @param {object} args - Arguments for the tool
 * @returns {Promise<object>} Tool result with content array
 */
export async function callMCPTool(source, credentials, toolName, args) {
  const client = await getMCPClient(source, credentials);

  console.log('[MCP] ────────────────────────────────────────');
  console.log('[MCP] Calling tool:', toolName);
  console.log('[MCP] Source:', source.name);
  console.log('[MCP] Args:', JSON.stringify(args, null, 2));
  console.log('[MCP] ────────────────────────────────────────');

  const result = await client.callTool({
    name: toolName,
    args: args,
  });

  console.log('[MCP] Tool result:', JSON.stringify(result, null, 2).slice(0, 2000));

  return result;
}

/**
 * Close an MCP client connection.
 * 
 * @param {string} sourceId - Source ID (closes all credentials for this source)
 */
export async function closeMCPClient(sourceId) {
  for (const [key, client] of clientCache.entries()) {
    if (key.startsWith(`${sourceId}:`)) {
      try {
        await client.close();
      } catch (error) {
        console.error('[MCP] Error closing client:', error.message);
      }
      clientCache.delete(key);
      console.log('[MCP] Closed client:', key);
    }
  }
}

/**
 * Close all cached MCP clients.
 */
export async function closeAllMCPClients() {
  for (const [key, client] of clientCache.entries()) {
    try {
      await client.close();
    } catch (error) {
      console.error('[MCP] Error closing client:', error.message);
    }
  }
  clientCache.clear();
  console.log('[MCP] Closed all clients');
}

/**
 * Check if a source has an active connection.
 * 
 * @param {string} sourceId - Source ID
 * @returns {boolean}
 */
export function isConnected(sourceId) {
  for (const key of clientCache.keys()) {
    if (key.startsWith(`${sourceId}:`)) {
      return true;
    }
  }
  return false;
}

export default {
  getMCPClient,
  getMCPTools,
  listMCPTools,
  callMCPTool,
  closeMCPClient,
  closeAllMCPClients,
  isConnected,
};
