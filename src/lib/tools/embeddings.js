/**
 * Tool Embeddings Module
 *
 * Generates embeddings for tools and user queries for semantic search.
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions).
 */

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate embedding for a tool (called during sync).
 *
 * @param {object} tool - Tool object with name, description, method, path
 * @returns {Promise<number[]>} - 1536-dimension embedding vector
 */
export async function embedTool(tool) {
  const text = `${tool.name}: ${tool.description || ''} (${tool.method} ${tool.path})`;
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // Limit to avoid token issues
  });
  return response.data[0].embedding;
}

/**
 * Generate embedding for a user query (called during chat).
 *
 * @param {string} query - User's natural language query
 * @returns {Promise<number[]>} - 1536-dimension embedding vector
 */
export async function embedQuery(query) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  return response.data[0].embedding;
}

/**
 * Search tools by semantic similarity.
 *
 * @param {object} supabase - Supabase client
 * @param {string[]} sourceIds - Source UUIDs to search within
 * @param {string} query - User's natural language query
 * @param {number} limit - Max tools to return (default 64)
 * @returns {Promise<string[]>} - Array of matching tool IDs
 */
export async function searchTools(supabase, sourceIds, query, limit = 64) {
  const embedding = await embedQuery(query);

  const { data: matches, error } = await supabase.rpc('search_tools_semantic', {
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
  const { count: total } = await supabase
    .from('tools')
    .select('id', { count: 'exact', head: true })
    .in('source_id', sourceIds)
    .eq('is_active', true);

  const { count: withEmbeddings } = await supabase
    .from('tools')
    .select('id', { count: 'exact', head: true })
    .in('source_id', sourceIds)
    .eq('is_active', true)
    .not('embedding', 'is', null);

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

  const { data: matches, error } = await supabase.rpc('search_template_tools_semantic', {
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
  const { count: total } = await supabase
    .from('template_tools')
    .select('id', { count: 'exact', head: true })
    .in('template_id', templateIds)
    .eq('is_active', true);

  const { count: withEmbeddings } = await supabase
    .from('template_tools')
    .select('id', { count: 'exact', head: true })
    .in('template_id', templateIds)
    .eq('is_active', true)
    .not('embedding', 'is', null);

  return { total: total || 0, withEmbeddings: withEmbeddings || 0 };
}
