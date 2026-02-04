/**
 * Tool Embeddings Module
 *
 * Thin wrapper around @/lib/ai embedding functions for tool-specific operations.
 * All provider logic lives in ai.js - this module just adds tool/query formatting.
 *
 * Platform-level config via env vars (see ai.js):
 *   EMBEDDING_PROVIDER=openai|google|ollama (default: openai)
 *   EMBEDDING_MODEL=text-embedding-3-small (provider-specific default)
 *   EMBEDDING_API_KEY=... (uses OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY as fallback)
 *   EMBEDDING_BASE_URL=... (for Ollama, e.g., http://localhost:11434/v1)
 *
 * Dual-column support:
 *   - OpenAI uses embedding_1536 column (1536 dimensions)
 *   - Google/Ollama use embedding_768 column (768 dimensions)
 *   Both columns can coexist - switching providers just requires re-syncing.
 */

import {
  generateEmbedding as aiGenerateEmbedding,
  getEmbeddingConfig,
} from '@/lib/ai';

// Re-export getEmbeddingConfig for consumers that import from here
export { getEmbeddingConfig };

/**
 * Get the embedding dimension and column name for the current provider.
 * Delegates to getEmbeddingConfig() from ai.js.
 */
export function getEmbeddingDimension() {
  const { dimension, column } = getEmbeddingConfig();
  return { dimension, column };
}

/**
 * Generate embedding for a tool (called during sync).
 *
 * @param {object} tool - Tool object with name, description, method, path
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function embedTool(tool) {
  const text = `${tool.name}: ${tool.description || ''} (${tool.method} ${tool.path})`;
  return aiGenerateEmbedding(text);
}

/**
 * Generate embedding for a user query (called during chat).
 *
 * @param {string} query - User's natural language query
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function embedQuery(query) {
  return aiGenerateEmbedding(query);
}

/**
 * Search tools by semantic similarity.
 * Automatically uses the correct RPC function based on configured provider.
 *
 * @param {object} supabase - Supabase client
 * @param {string[]} sourceIds - Source UUIDs to search within
 * @param {string} query - User's natural language query
 * @param {number} limit - Max tools to return (default 64)
 * @returns {Promise<string[]>} - Array of matching tool IDs
 */
export async function searchTools(supabase, sourceIds, query, limit = 64) {
  const embedding = await embedQuery(query);
  const { dimension } = getEmbeddingDimension();

  // Use the dimension-specific RPC function
  const rpcName = dimension === 768
    ? 'search_tools_semantic_768'
    : 'search_tools_semantic_1536';

  const { data: matches, error } = await supabase.rpc(rpcName, {
    p_source_ids: sourceIds,
    p_embedding: embedding,
    p_limit: limit,
  });

  if (error) {
    console.error('[EMBEDDINGS] Search error:', error);
    return [];
  }

  return matches?.map(m => m.tool_id) || [];
}

/**
 * Check if enough tools have embeddings to use semantic search.
 *
 * @param {object} supabase - Supabase client
 * @param {string[]} sourceIds - Source UUIDs to check
 * @returns {Promise<{total: number, withEmbeddings: number}>}
 */
export async function getEmbeddingCoverage(supabase, sourceIds) {
  const { column } = getEmbeddingDimension();

  // Run both queries in parallel
  const [{ count: total }, { count: withEmbeddings }] = await Promise.all([
    supabase
      .from('tools')
      .select('id', { count: 'exact', head: true })
      .in('source_id', sourceIds)
      .eq('is_active', true),
    supabase
      .from('tools')
      .select('id', { count: 'exact', head: true })
      .in('source_id', sourceIds)
      .eq('is_active', true)
      .not(column, 'is', null),
  ]);

  return { total: total || 0, withEmbeddings: withEmbeddings || 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE TOOLS: Functions for global template_tools table
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search template tools by semantic similarity.
 *
 * @param {object} supabase - Supabase client
 * @param {string[]} templateIds - Template UUIDs to search within
 * @param {string} query - User's natural language query
 * @param {number} limit - Max tools to return (default 64)
 * @returns {Promise<string[]>} - Array of matching tool IDs
 */
export async function searchTemplateTools(supabase, templateIds, query, limit = 64) {
  const embedding = await embedQuery(query);
  const { dimension } = getEmbeddingDimension();

  const rpcName = dimension === 768
    ? 'search_template_tools_semantic_768'
    : 'search_template_tools_semantic_1536';

  const { data: matches, error } = await supabase.rpc(rpcName, {
    p_template_ids: templateIds,
    p_embedding: embedding,
    p_limit: limit,
  });

  if (error) {
    console.error('[EMBEDDINGS] Template search error:', error);
    return [];
  }

  return matches?.map(m => m.tool_id) || [];
}

/**
 * Check if enough template tools have embeddings to use semantic search.
 *
 * @param {object} supabase - Supabase client
 * @param {string[]} templateIds - Template UUIDs to check
 * @returns {Promise<{total: number, withEmbeddings: number}>}
 */
export async function getTemplateEmbeddingCoverage(supabase, templateIds) {
  const { column } = getEmbeddingDimension();

  // Run both queries in parallel
  const [{ count: total }, { count: withEmbeddings }] = await Promise.all([
    supabase
      .from('template_tools')
      .select('id', { count: 'exact', head: true })
      .in('template_id', templateIds)
      .eq('is_active', true),
    supabase
      .from('template_tools')
      .select('id', { count: 'exact', head: true })
      .in('template_id', templateIds)
      .eq('is_active', true)
      .not(column, 'is', null),
  ]);

  return { total: total || 0, withEmbeddings: withEmbeddings || 0 };
}
