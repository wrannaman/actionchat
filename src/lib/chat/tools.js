/**
 * Chat tools module.
 *
 * Handles loading and converting tools for an agent.
 *
 * For HTTP MCP sources (Stripe, Notion, etc.): Uses @ai-sdk/mcp directly
 * For OpenAPI sources: Uses database-backed tools with our converter
 */

import { convertToolsToAISDK, searchTools, searchTemplateTools, getEmbeddingCoverage, getTemplateEmbeddingCoverage } from '@/lib/tools';
import { getWrappedMCPTools } from '@/lib/mcp';

// OpenAI has a max of 128 tools. Other providers may have different limits.
// When we exceed this, we'll truncate and warn.
const MAX_TOOLS = 128;

// Threshold for using semantic search (if tool count exceeds this, use RAG)
const SEMANTIC_SEARCH_THRESHOLD = 64;

/**
 * Load tools from global template_tools table for template-based sources.
 */
async function loadTemplateTools(supabase, templateSources, userQuery = null) {
  if (!templateSources.length) return [];

  const templateIds = [...new Set(templateSources.map(s => s.template_id))];
  const sourceByTemplateId = new Map();
  for (const s of templateSources) {
    if (!sourceByTemplateId.has(s.template_id)) {
      sourceByTemplateId.set(s.template_id, s);
    }
  }

  // Count total template tools
  const { count: totalCount } = await supabase
    .from('template_tools')
    .select('id', { count: 'exact', head: true })
    .in('template_id', templateIds)
    .eq('is_active', true);

  console.log('[TOOLS] Template tools count:', totalCount, 'for', templateIds.length, 'templates');

  let toolRows = [];

  // If too many tools and we have a query, use semantic search
  if (totalCount > SEMANTIC_SEARCH_THRESHOLD && userQuery) {
    const coverage = await getTemplateEmbeddingCoverage(supabase, templateIds);
    const coveragePercent = coverage.total > 0 ? (coverage.withEmbeddings / coverage.total) * 100 : 0;

    console.log('[TOOLS] Template embeddings:', coverage.withEmbeddings, '/', coverage.total, `(${coveragePercent.toFixed(0)}%)`);

    if (coveragePercent > 50) {
      console.log('[TOOLS] Using semantic search for template tools, query:', userQuery.slice(0, 100));

      const relevantToolIds = await searchTemplateTools(supabase, templateIds, userQuery, SEMANTIC_SEARCH_THRESHOLD);

      if (relevantToolIds.length > 0) {
        const { data: rows } = await supabase
          .from('template_tools')
          .select(`
            id, name, description, method, path, parameters, request_body,
            risk_level, requires_confirmation, mcp_tool_name, template_id
          `)
          .in('id', relevantToolIds);

        toolRows = (rows || []).map(t => {
          const source = sourceByTemplateId.get(t.template_id);
          return {
            tool_id: t.id,
            tool_name: t.name,
            description: t.description,
            method: t.method,
            path: t.path,
            parameters: t.parameters,
            request_body: t.request_body,
            risk_level: t.risk_level,
            requires_confirmation: t.requires_confirmation,
            mcp_tool_name: t.mcp_tool_name,
            source_name: source?.name,
            base_url: source?.base_url,
            permission: 'read_write',
            is_template_tool: true,
          };
        });

        console.log('[TOOLS] Semantic search returned', toolRows.length, 'template tools');
        return toolRows;
      }
    }
  }

  // Load all template tools (no semantic search)
  const { data: rows } = await supabase
    .from('template_tools')
    .select(`
      id, name, description, method, path, parameters, request_body,
      risk_level, requires_confirmation, mcp_tool_name, template_id
    `)
    .in('template_id', templateIds)
    .eq('is_active', true);

  toolRows = (rows || []).map(t => {
    const source = sourceByTemplateId.get(t.template_id);
    return {
      tool_id: t.id,
      tool_name: t.name,
      description: t.description,
      method: t.method,
      path: t.path,
      parameters: t.parameters,
      request_body: t.request_body,
      risk_level: t.risk_level,
      requires_confirmation: t.requires_confirmation,
      mcp_tool_name: t.mcp_tool_name,
      source_name: source?.name,
      base_url: source?.base_url,
      permission: 'read_write',
      is_template_tool: true,
    };
  });

  console.log('[TOOLS] Loaded', toolRows.length, 'template tools');
  return toolRows;
}

/**
 * Load all tools available to an agent.
 *
 * Uses AI SDK MCP for HTTP MCP sources, database-backed for others.
 *
 * @param {object} supabase - Supabase client
 * @param {string} agentId - Agent UUID
 * @param {string} userId - User ID (for credentials)
 * @param {object} options - Optional settings
 * @param {string[]} options.enabledSourceIds - If provided, only load tools from these sources
 * @param {string} options.userQuery - User's query for semantic tool search
 * @returns {Promise<{tools, toolRows, sourceIds, sourcesWithHints}>}
 */
export async function loadAgentTools(supabase, agentId, userId, options = {}) {
  const { enabledSourceIds, userQuery } = options;

  // Get agent-source links
  const { data: links } = await supabase
    .from('agent_sources')
    .select('source_id, permission')
    .eq('agent_id', agentId);

  let sourceIds = links?.map(l => l.source_id) || [];

  // Filter to only enabled sources if specified
  if (enabledSourceIds?.length > 0) {
    const enabledSet = new Set(enabledSourceIds);
    sourceIds = sourceIds.filter(id => enabledSet.has(id));
  }

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

  // Separate sources into three categories:
  // 1. HTTP MCP sources (live load via AI SDK)
  // 2. Template-based sources (load from global template_tools)
  // 3. Custom sources (load from per-org tools table)
  const httpMcpSources = sourcesWithHints.filter(
    s => s.source_type === 'mcp' && s.mcp_transport === 'http'
  );
  const templateSources = sourcesWithHints.filter(
    s => s.template_id && !(s.source_type === 'mcp' && s.mcp_transport === 'http')
  );
  const customSources = sourcesWithHints.filter(
    s => !s.template_id && !(s.source_type === 'mcp' && s.mcp_transport === 'http')
  );

  console.log('[TOOLS] HTTP MCP sources:', httpMcpSources.map(s => s.name));
  console.log('[TOOLS] Template sources:', templateSources.map(s => s.name));
  console.log('[TOOLS] Custom sources:', customSources.map(s => s.name));

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
  let usedSemanticSearch = false;

  // ─────────────────────────────────────────────────────────────────────────
  // 1. TEMPLATE TOOLS: Load from global template_tools table
  // ─────────────────────────────────────────────────────────────────────────
  let templateToolRows = [];
  if (templateSources.length > 0) {
    templateToolRows = await loadTemplateTools(supabase, templateSources, userQuery);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. CUSTOM TOOLS: Load from per-org tools table
  // ─────────────────────────────────────────────────────────────────────────
  let customToolRows = [];
  if (customSources.length > 0) {
    const customSourceIds = customSources.map(s => s.id);

    // Check tool count for these sources
    const { count: toolCount } = await supabase
      .from('tools')
      .select('id', { count: 'exact', head: true })
      .in('source_id', customSourceIds)
      .eq('is_active', true);

    // If tool count exceeds threshold and we have a query, try semantic search
    if (toolCount > SEMANTIC_SEARCH_THRESHOLD && userQuery) {
      const coverage = await getEmbeddingCoverage(supabase, customSourceIds);
      const coveragePercent = coverage.total > 0 ? (coverage.withEmbeddings / coverage.total) * 100 : 0;

      console.log('[TOOLS] Custom tool count:', toolCount, '| Embeddings:', coverage.withEmbeddings, '/', coverage.total, `(${coveragePercent.toFixed(0)}%)`);

      // Use semantic search if we have decent embedding coverage (>50%)
      if (coveragePercent > 50) {
        console.log('[TOOLS] Using semantic search for custom tools, query:', userQuery.slice(0, 100));

        const relevantToolIds = await searchTools(supabase, customSourceIds, userQuery, SEMANTIC_SEARCH_THRESHOLD);

        if (relevantToolIds.length > 0) {
          usedSemanticSearch = true;

          // Load only the relevant tools
          const { data: rows } = await supabase
            .from('tools')
            .select(`
              id, name, description, method, path, parameters, request_body,
              risk_level, requires_confirmation, source_id
            `)
            .in('id', relevantToolIds);

          // Enrich with source info
          const sourceById = new Map(customSources.map(s => [s.id, s]));
          customToolRows = (rows || []).map(t => ({
            tool_id: t.id,
            tool_name: t.name,
            description: t.description,
            method: t.method,
            path: t.path,
            parameters: t.parameters,
            request_body: t.request_body,
            risk_level: t.risk_level,
            requires_confirmation: t.requires_confirmation,
            source_name: sourceById.get(t.source_id)?.name,
            base_url: sourceById.get(t.source_id)?.base_url,
            permission: 'read_write',
          }));

          console.log('[TOOLS] Semantic search returned', customToolRows.length, 'custom tools');
        }
      } else {
        console.log('[TOOLS] Insufficient embedding coverage for semantic search, falling back to full load');
      }
    }

    // Fallback: Load all custom tools via RPC (existing behavior)
    if (!usedSemanticSearch && customSources.length > 0) {
      const { data: rows } = await supabase.rpc('get_agent_tools', {
        agent_uuid: agentId,
      });
      const allRows = rows || [];

      // Filter to only custom source tools (not template-based)
      const customSourceNames = new Set(customSources.map(s => s.name));
      customToolRows = allRows.filter(t => customSourceNames.has(t.source_name));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. MERGE: Combine template tools + custom tools
  // ─────────────────────────────────────────────────────────────────────────
  toolRows = [...templateToolRows, ...customToolRows];

  const sourceMap = new Map(sourcesWithHints.map(s => [s.name, s]));

  dbTools = convertToolsToAISDK(toolRows, {
    sourceMap,
    userCredentialsMap: credentialsMap,
    userId,
  });

  // Merge MCP tools (AI SDK) with database tools
  let tools = { ...dbTools, ...mcpTools };

  const totalCount = Object.keys(tools).length;
  console.log('[TOOLS] Total tools:', totalCount);
  console.log('[TOOLS] MCP tools:', Object.keys(mcpTools).length);
  console.log('[TOOLS] DB tools:', Object.keys(dbTools).length, '(template:', templateToolRows.length, '+ custom:', customToolRows.length, ')');
  if (usedSemanticSearch) {
    console.log('[TOOLS] Used semantic search to filter tools');
  }

  // Check if we exceed the max tools limit
  let toolsWarning = null;
  if (totalCount > MAX_TOOLS) {
    console.warn(`[TOOLS] WARNING: ${totalCount} tools exceeds limit of ${MAX_TOOLS}. Truncating to most common endpoints.`);

    // Prioritize tools by usefulness:
    // 1. GET endpoints (read operations, most common)
    // 2. POST endpoints (create operations)
    // 3. Others (PUT, PATCH, DELETE)
    const toolEntries = Object.entries(tools);

    // Sort by priority: GET first, then POST, then others
    // Also prefer shorter paths (more general endpoints)
    toolEntries.sort(([nameA, toolA], [nameB, toolB]) => {
      const descA = toolA.description || '';
      const descB = toolB.description || '';

      // Extract method from name or description
      const isGetA = nameA.toLowerCase().startsWith('get') || descA.includes('GET ');
      const isGetB = nameB.toLowerCase().startsWith('get') || descB.includes('GET ');
      const isPostA = nameA.toLowerCase().startsWith('post') || nameA.toLowerCase().startsWith('create') || descA.includes('POST ');
      const isPostB = nameB.toLowerCase().startsWith('post') || nameB.toLowerCase().startsWith('create') || descB.includes('POST ');

      // Priority: GET (0) > POST (1) > others (2)
      const priorityA = isGetA ? 0 : isPostA ? 1 : 2;
      const priorityB = isGetB ? 0 : isPostB ? 1 : 2;

      if (priorityA !== priorityB) return priorityA - priorityB;

      // Same priority: prefer shorter names (usually more general)
      return nameA.length - nameB.length;
    });

    // Take top MAX_TOOLS
    const limitedEntries = toolEntries.slice(0, MAX_TOOLS);
    tools = Object.fromEntries(limitedEntries);

    toolsWarning = `API has ${totalCount} endpoints but only ${MAX_TOOLS} can be used at once. Using most common endpoints. Consider filtering which endpoints are enabled.`;
  }

  return { tools, toolRows, sourceIds, sourcesWithHints, toolsWarning };
}
