/**
 * MCP Tools Wrapper - Apply hints to AI SDK MCP tools
 *
 * The AI SDK's mcpClient.tools() returns tools that execute directly.
 * This wrapper adds our hint system (preProcessArgs, postProcessResult)
 * without reimplementing the MCP protocol.
 */

import { getMCPTools } from './client.js';
import { preProcessArgs, postProcessResult } from './hints.js';

/**
 * Clean empty values from args before sending to MCP.
 * The LLM often generates empty strings for optional params which
 * can cause unexpected filtering (e.g., email: "" filters to no results).
 */
function cleanArgs(args) {
  if (!args || typeof args !== 'object') return args;
  
  const cleaned = {};
  for (const [key, value] of Object.entries(args)) {
    // Skip undefined, null, and empty strings
    if (value === undefined || value === null || value === '') continue;
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Get MCP tools with hints applied.
 *
 * @param {object} source - Source config with template hints
 * @param {object} credentials - User credentials
 * @returns {Promise<object>} Wrapped tools for AI SDK
 */
export async function getWrappedMCPTools(source, credentials) {
  // Get raw tools from AI SDK MCP client
  const rawTools = await getMCPTools(source, credentials);

  // Get hints from template
  const hints = source.template?.mcp_hints || {};
  const hasHints = Object.keys(hints).length > 0;

  console.log('[MCP WRAP] Source:', source.name);
  console.log('[MCP WRAP] Template:', source.template?.slug || '(none)');
  console.log('[MCP WRAP] Has hints:', hasHints);
  console.log('[MCP WRAP] Tools:', Object.keys(rawTools).join(', '));

  // Always wrap tools to clean args (LLM generates empty strings)
  // Also apply hints if available
  const wrappedTools = {};

  for (const [toolName, tool] of Object.entries(rawTools)) {
    wrappedTools[toolName] = {
      ...tool,
      execute: async (args, options) => {
        // Clean empty values (LLM often generates email: "" which breaks filtering)
        const cleanedArgs = cleanArgs(args);
        
        // Pre-process args with hints (e.g., add default expand)
        const processedArgs = hasHints 
          ? preProcessArgs(cleanedArgs, toolName, hints)
          : cleanedArgs;

        console.log('[MCP WRAP] Executing:', toolName);
        console.log('[MCP WRAP] Original args:', JSON.stringify(args));
        console.log('[MCP WRAP] Cleaned args:', JSON.stringify(cleanedArgs));
        if (hasHints) {
          console.log('[MCP WRAP] Processed args:', JSON.stringify(processedArgs));
        }

        // Execute the original tool
        const result = await tool.execute(processedArgs, options);

        // Post-process result with hints (e.g., detect thin data)
        const processedResult = hasHints
          ? postProcessResult(result, toolName, hints)
          : result;

        return processedResult;
      },
    };
  }

  return wrappedTools;
}

/**
 * Load MCP tools for all MCP sources of an agent.
 *
 * @param {Array} sources - Sources with template data
 * @param {Map} credentialsMap - Source ID → credentials
 * @returns {Promise<object>} Combined tools object
 */
export async function loadAllMCPTools(sources, credentialsMap) {
  const allTools = {};

  // Filter to HTTP MCP sources only
  const mcpSources = sources.filter(
    (s) => s.source_type === 'mcp' && s.mcp_transport === 'http'
  );

  console.log('[MCP WRAP] Loading tools from', mcpSources.length, 'HTTP MCP sources');

  for (const source of mcpSources) {
    const credentials = credentialsMap.get(source.id);

    if (!credentials) {
      console.log('[MCP WRAP] Skipping', source.name, '- no credentials');
      continue;
    }

    try {
      const tools = await getWrappedMCPTools(source, credentials);

      // Prefix tool names with source name to avoid collisions
      for (const [name, tool] of Object.entries(tools)) {
        // Use original name (most MCP servers have unique names)
        allTools[name] = tool;
      }

      console.log('[MCP WRAP] Loaded', Object.keys(tools).length, 'tools from', source.name);
    } catch (error) {
      console.error('[MCP WRAP] Error loading tools from', source.name, ':', error.message);
    }
  }

  return allTools;
}

export default {
  getWrappedMCPTools,
  loadAllMCPTools,
};
