/**
 * Chat tools module.
 *
 * Handles loading and converting tools for an agent.
 *
 * For HTTP MCP sources (Stripe, Notion, etc.): Uses @ai-sdk/mcp directly
 * For OpenAPI sources: Uses database-backed tools with our converter
 */

import { convertToolsToAISDK } from '@/lib/tools';
import { getWrappedMCPTools } from '@/lib/mcp';

/**
 * Load all tools available to an agent.
 *
 * Uses AI SDK MCP for HTTP MCP sources, database-backed for others.
 *
 * @param {object} supabase - Supabase client
 * @param {string} agentId - Agent UUID
 * @param {string} userId - User ID (for credentials)
 * @returns {Promise<{tools, toolRows, sourceIds, sourcesWithHints}>}
 */
export async function loadAgentTools(supabase, agentId, userId) {
  // Get agent-source links
  const { data: links } = await supabase
    .from('agent_sources')
    .select('source_id, permission')
    .eq('agent_id', agentId);

  const sourceIds = links?.map(l => l.source_id) || [];

  if (!sourceIds.length) {
    return { tools: {}, toolRows: [], sourceIds: [], sourcesWithHints: [] };
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
  console.log('[TOOLS] Sources with template_ids:', sources?.map(s => ({ name: s.name, template_id: s.template_id })));

  let templates = [];
  if (templateIds.length > 0) {
    const { data: templateData, error: templateError } = await supabase
      .from('source_templates')
      .select('id, slug, mcp_hints')
      .in('id', templateIds);
    console.log('[TOOLS] Fetched templates:', templateData?.map(t => ({ slug: t.slug, hasHints: !!t.mcp_hints })));
    if (templateError) console.log('[TOOLS] Template fetch error:', templateError);
    templates = templateData || [];
  }
  const templateMap = new Map(templates.map(t => [t.id, t]));

  // Attach template hints to sources
  const sourcesWithHints = sources?.map(s => {
    const template = s.template_id ? templateMap.get(s.template_id) : null;
    return { ...s, template };
  }) || [];

  // Load user credentials for these sources (only active ones)
  const { data: creds } = await supabase
    .from('user_api_credentials')
    .select('source_id, credentials')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('source_id', sourceIds);

  const credentialsMap = new Map(creds?.map(c => [c.source_id, c.credentials]) || []);

  // Separate MCP (HTTP) sources from others
  const httpMcpSources = sourcesWithHints.filter(
    s => s.source_type === 'mcp' && s.mcp_transport === 'http'
  );
  const otherSources = sourcesWithHints.filter(
    s => !(s.source_type === 'mcp' && s.mcp_transport === 'http')
  );

  console.log('[TOOLS] HTTP MCP sources:', httpMcpSources.map(s => s.name));
  console.log('[TOOLS] Other sources:', otherSources.map(s => s.name));

  // Load tools from HTTP MCP sources via AI SDK (live, no database sync needed)
  let mcpTools = {};
  for (const source of httpMcpSources) {
    const credentials = credentialsMap.get(source.id);
    if (!credentials) {
      console.log('[TOOLS] Skipping MCP source', source.name, '- no credentials');
      continue;
    }

    try {
      console.log('[TOOLS] Loading MCP tools from', source.name, 'via AI SDK...');
      const tools = await getWrappedMCPTools(source, credentials);
      mcpTools = { ...mcpTools, ...tools };
      console.log('[TOOLS] Loaded', Object.keys(tools).length, 'tools from', source.name);
    } catch (error) {
      console.error('[TOOLS] Failed to load MCP tools from', source.name, ':', error.message);
    }
  }

  // Load database-backed tools for non-MCP sources
  let dbTools = {};
  let toolRows = [];

  if (otherSources.length > 0) {
    // Get tools via RPC (joins agent_sources + tools)
    const { data: rows } = await supabase.rpc('get_agent_tools', {
      agent_uuid: agentId,
    });
    toolRows = rows || [];

    // Filter to only non-MCP source tools
    const otherSourceNames = new Set(otherSources.map(s => s.name));
    const filteredRows = toolRows.filter(t => otherSourceNames.has(t.source_name));

    const sourceMap = new Map(sourcesWithHints.map(s => [s.name, s]));

    dbTools = convertToolsToAISDK(filteredRows, {
      sourceMap,
      userCredentialsMap: credentialsMap,
      userId,
    });
  }

  // Merge MCP tools (AI SDK) with database tools
  const tools = { ...dbTools, ...mcpTools };

  console.log('[TOOLS] Total tools:', Object.keys(tools).length);
  console.log('[TOOLS] MCP tools:', Object.keys(mcpTools).length);
  console.log('[TOOLS] DB tools:', Object.keys(dbTools).length);

  return { tools, toolRows, sourceIds, sourcesWithHints };
}
