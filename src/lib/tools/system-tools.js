/**
 * System Tools Module
 *
 * Built-in tools that are always available to the AI, independent of API sources.
 * These tools help the AI discover and manage available API tools.
 */

import { tool, jsonSchema } from 'ai';
import { searchTemplateTools, searchTools } from './embeddings.js';

/**
 * Create the search_tools system tool.
 *
 * This tool allows the AI to discover additional tools mid-conversation
 * when it needs functionality not in its current tool set.
 *
 * @param {object} options
 * @param {object} options.supabase - Supabase client
 * @param {string[]} options.templateIds - Template IDs for template-based sources
 * @param {string[]} options.customSourceIds - Source IDs for custom (per-org) sources
 * @returns {object} AI SDK tool definition
 */
export function createSearchToolsTool({ supabase, templateIds, customSourceIds }) {
  return tool({
    description: 'Search for available API tools by describing what you need. Use this when you need a tool that is not in your current set. Returns matching tools with their names, descriptions, methods, and paths.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language description of what tool you need (e.g., "cancel a subscription", "get customer details", "create a refund")',
        },
      },
      required: ['query'],
    }),
    execute: async ({ query }) => {
      console.log('[SYSTEM TOOLS] search_tools called with query:', query);

      const results = [];
      const limit = 10;

      // Search template tools if we have template sources
      if (templateIds?.length > 0) {
        try {
          const templateMatches = await searchTemplateTools(supabase, templateIds, query, limit);

          if (templateMatches.length > 0) {
            // Fetch tool details for matches
            const toolIds = templateMatches.map(m => m.tool_id);
            const { data: tools } = await supabase
              .from('template_tools')
              .select('id, name, description, method, path')
              .in('id', toolIds);

            if (tools) {
              // Preserve similarity order
              const toolMap = new Map(tools.map(t => [t.id, t]));
              for (const match of templateMatches) {
                const t = toolMap.get(match.tool_id);
                if (t) {
                  results.push({
                    name: t.name,
                    description: t.description || '',
                    method: t.method,
                    path: t.path,
                    similarity: Math.round(match.similarity * 100),
                    source: 'template',
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error('[SYSTEM TOOLS] Template search error:', err);
        }
      }

      // Search custom tools if we have custom sources
      if (customSourceIds?.length > 0) {
        try {
          const customMatches = await searchTools(supabase, customSourceIds, query, limit);

          if (customMatches.length > 0) {
            // Fetch tool details for matches
            const toolIds = customMatches.map(m => m.tool_id);
            const { data: tools } = await supabase
              .from('tools')
              .select('id, name, description, method, path')
              .in('id', toolIds);

            if (tools) {
              // Preserve similarity order
              const toolMap = new Map(tools.map(t => [t.id, t]));
              for (const match of customMatches) {
                const t = toolMap.get(match.tool_id);
                if (t) {
                  results.push({
                    name: t.name,
                    description: t.description || '',
                    method: t.method,
                    path: t.path,
                    similarity: Math.round(match.similarity * 100),
                    source: 'custom',
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error('[SYSTEM TOOLS] Custom search error:', err);
        }
      }

      // Sort by similarity and take top 10
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, limit);

      console.log('[SYSTEM TOOLS] Returning', topResults.length, 'matching tools');

      if (topResults.length === 0) {
        return {
          message: 'No matching tools found. Try a different search query or check if the required API source is connected.',
          tools: [],
        };
      }

      return {
        message: `Found ${topResults.length} matching tools. You can now call any of these tools directly.`,
        tools: topResults.map(t => ({
          name: t.name,
          description: t.description,
          method: t.method,
          path: t.path,
          match: `${t.similarity}%`,
        })),
      };
    },
  });
}

/**
 * Create all system tools for an agent.
 *
 * @param {object} options
 * @param {object} options.supabase - Supabase client
 * @param {string[]} options.templateIds - Template IDs for template-based sources
 * @param {string[]} options.customSourceIds - Source IDs for custom (per-org) sources
 * @returns {object} Object with all system tools keyed by name
 */
export function createSystemTools({ supabase, templateIds, customSourceIds }) {
  const tools = {};

  // Only add search_tools if there are sources to search
  if ((templateIds?.length > 0) || (customSourceIds?.length > 0)) {
    tools.search_tools = createSearchToolsTool({ supabase, templateIds, customSourceIds });
  }

  return tools;
}
