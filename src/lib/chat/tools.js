/**
 * Chat tools module.
 *
 * Handles loading and converting tools for an agent.
 */

import { convertToolsToAISDK } from '@/lib/tools-to-ai-sdk';

/**
 * Load all tools available to an agent.
 *
 * @param {object} supabase - Supabase client
 * @param {string} agentId - Agent UUID
 * @param {string} userId - User ID (for credentials)
 * @returns {Promise<{tools, toolRows, sourceIds, sourcesWithHints}>}
 */
export async function loadAgentTools(supabase, agentId, userId) {
  // Get tools via RPC (joins agent_sources + tools)
  const { data: toolRows } = await supabase.rpc('get_agent_tools', {
    agent_uuid: agentId,
  });

  if (!toolRows?.length) {
    return { tools: {}, toolRows: [], sourceIds: [], sourcesWithHints: [] };
  }

  // Get agent-source links
  const { data: links } = await supabase
    .from('agent_sources')
    .select('source_id, permission')
    .eq('agent_id', agentId);

  const sourceIds = links?.map(l => l.source_id) || [];

  if (!sourceIds.length) {
    return { tools: {}, toolRows, sourceIds: [], sourcesWithHints: [] };
  }

  // Load sources with full config (including MCP and template_id)
  const { data: sources } = await supabase
    .from('api_sources')
    .select(`
      id, name, base_url, auth_type, auth_config,
      source_type, mcp_server_uri, mcp_transport, mcp_env,
      template_id
    `)
    .in('id', sourceIds);

  // Load templates for these sources (to get mcp_hints)
  const templateIds = sources?.filter(s => s.template_id).map(s => s.template_id) || [];
  let templates = [];
  if (templateIds.length > 0) {
    const { data: templateData } = await supabase
      .from('source_templates')
      .select('id, slug, mcp_hints, llm_guidance')
      .in('id', templateIds);
    templates = templateData || [];
  }
  const templateMap = new Map(templates.map(t => [t.id, t]));

  // Attach template hints to sources
  const sourcesWithHints = sources?.map(s => ({
    ...s,
    template: s.template_id ? templateMap.get(s.template_id) : null,
  })) || [];

  // Load user credentials for these sources (only active ones)
  const { data: creds } = await supabase
    .from('user_api_credentials')
    .select('source_id, credentials')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('source_id', sourceIds);

  // Build lookup maps
  const sourceMap = new Map(sourcesWithHints.map(s => [s.name, s]));
  const credentialsMap = new Map(creds?.map(c => [c.source_id, c.credentials]) || []);

  // Convert to AI SDK format (now includes template hints)
  const tools = convertToolsToAISDK(toolRows, {
    sourceMap,
    userCredentialsMap: credentialsMap,
    userId,
  });

  return { tools, toolRows, sourceIds, sourcesWithHints };
}
