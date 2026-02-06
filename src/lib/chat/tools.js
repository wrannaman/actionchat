/**
 * Chat tools module.
 *
 * Handles loading and converting tools for an agent.
 *
 * For HTTP MCP sources (Stripe, Notion, etc.): Uses @ai-sdk/mcp directly
 * For OpenAPI sources: Uses database-backed tools with our converter
 */

import { convertToolsToAISDK, searchTools, searchTemplateTools, getEmbeddingCoverage, getTemplateEmbeddingCoverage, createSystemTools, embedQuery } from '@/lib/tools';
import { getWrappedMCPTools } from '@/lib/mcp';

// OpenAI has a max of 128 tools. Other providers may have different limits.
// When we exceed this, we'll truncate and warn.
const MAX_TOOLS = 128;

// Default number of tools to return per source when using RAG.
// With multiple sources, each gets a quota to ensure balanced representation.
// AI can use search_tools to discover more if needed.
const DEFAULT_TOOLS_PER_SOURCE = 15;

// Minimum total tools before semantic search kicks in.
// Below this, just load all tools.
const MIN_TOOLS_FOR_RAG = 20;

// Minimum similarity threshold for routine matching
const ROUTINE_MATCH_THRESHOLD = 0.65;

/**
 * Match user query against saved routines.
 *
 * @param {object} supabase - Supabase client
 * @param {string} orgId - Organization ID
 * @param {string} userQuery - User's natural language query
 * @returns {Promise<{routine: object|null, confidence: number}>} Matched routine or null
 */
async function matchRoutine(supabase, orgId, userQuery) {
  if (!userQuery?.trim()) {
    return { routine: null, confidence: 0 };
  }

  try {
    // Generate embedding for the query
    const embedding = await embedQuery(userQuery);

    // Search routines by similarity
    const { data: matches, error } = await supabase.rpc('search_routines_semantic_1536', {
      p_org_id: orgId,
      p_embedding: embedding,
      p_limit: 3,
    });

    if (error) {
      console.error('[TOOLS] Routine search error:', error);
      return { routine: null, confidence: 0 };
    }

    if (!matches?.length) {
      return { routine: null, confidence: 0 };
    }

    // Check if top match exceeds threshold
    const topMatch = matches[0];
    if (topMatch.similarity < ROUTINE_MATCH_THRESHOLD) {
      console.log('[TOOLS] Routine match below threshold:', topMatch.similarity.toFixed(3));
      return { routine: null, confidence: 0 };
    }

    // Fetch full routine details
    const { data: routine, error: fetchError } = await supabase
      .from('routines')
      .select('id, name, prompt, tool_chain, tool_chain_names, success_count, failure_count')
      .eq('id', topMatch.routine_id)
      .single();

    if (fetchError || !routine) {
      console.error('[TOOLS] Failed to fetch matched routine:', fetchError);
      return { routine: null, confidence: 0 };
    }

    // Compute confidence from success rate
    const confidence = computeRoutineConfidence(routine);

    console.log('[TOOLS] Routine match:', routine.name, '| similarity:', topMatch.similarity.toFixed(3), '| confidence:', confidence.toFixed(3));

    return { routine, confidence, similarity: topMatch.similarity };
  } catch (err) {
    console.error('[TOOLS] Error matching routine:', err);
    return { routine: null, confidence: 0 };
  }
}

/**
 * Compute confidence score for a routine based on success/failure history.
 * Uses Bayesian smoothing: (successes + 1) / (total + 2)
 */
function computeRoutineConfidence(routine) {
  const total = (routine.success_count || 0) + (routine.failure_count || 0);
  if (total < 3) return 0.5; // Not enough data, neutral confidence
  return ((routine.success_count || 0) + 1) / (total + 2);
}

/**
 * Load tools from a routine's tool_chain.
 *
 * Fetches the specific tools by their IDs, supporting both template_tools and tools tables.
 *
 * @param {object} supabase - Supabase client
 * @param {string[]} toolChain - Array of tool UUIDs
 * @param {Map} sourceMap - Map of source name to source object
 * @param {Map} credentialsMap - Map of source_id to credentials
 * @returns {Promise<{toolRows: Array, success: boolean}>}
 */
async function loadRoutineTools(supabase, toolChain, sourceMap, credentialsMap) {
  if (!toolChain?.length) {
    return { toolRows: [], success: false };
  }

  console.log('[TOOLS] Loading routine tool chain:', toolChain.length, 'tools');

  // Load from both tables in parallel (tools could be in either)
  const [templateResult, customResult] = await Promise.all([
    supabase
      .from('template_tools')
      .select(`
        id, name, description, method, path, parameters, request_body,
        risk_level, requires_confirmation, mcp_tool_name, template_id
      `)
      .in('id', toolChain),
    supabase
      .from('tools')
      .select(`
        id, name, description, method, path, parameters, request_body,
        risk_level, requires_confirmation, source_id
      `)
      .in('id', toolChain),
  ]);

  const { data: templateRows, error: templateError } = templateResult;
  const { data: customRows, error: customError } = customResult;

  if (templateError && customError) {
    console.error('[TOOLS] Failed to load routine tools:', templateError, customError);
    return { toolRows: [], success: false };
  }

  // Process template tools
  const templateToolRows = (templateRows || []).map(t => {
    // Find the source that uses this template
    let sourceName = null;
    let baseUrl = null;
    for (const [name, source] of sourceMap.entries()) {
      if (source.template_id === t.template_id) {
        sourceName = name;
        baseUrl = source.base_url;
        break;
      }
    }

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
      source_name: sourceName,
      base_url: baseUrl,
      permission: 'read_write',
      is_template_tool: true,
    };
  });

  // Process custom tools
  const customToolRows = (customRows || []).map(t => {
    // Find source by ID
    let sourceName = null;
    let baseUrl = null;
    for (const [name, source] of sourceMap.entries()) {
      if (source.id === t.source_id) {
        sourceName = name;
        baseUrl = source.base_url;
        break;
      }
    }

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
      source_name: sourceName,
      base_url: baseUrl,
      permission: 'read_write',
      is_template_tool: false,
    };
  });

  const allToolRows = [...templateToolRows, ...customToolRows];

  // Preserve the order from tool_chain
  const orderMap = new Map(toolChain.map((id, i) => [id, i]));
  allToolRows.sort((a, b) => (orderMap.get(a.tool_id) ?? 999) - (orderMap.get(b.tool_id) ?? 999));

  const foundCount = allToolRows.length;
  const requestedCount = toolChain.length;

  if (foundCount < requestedCount) {
    console.warn('[TOOLS] Routine tool chain incomplete:', foundCount, '/', requestedCount, 'tools found');
    // If we're missing more than half, consider it a failure
    if (foundCount < requestedCount / 2) {
      return { toolRows: [], success: false };
    }
  }

  console.log('[TOOLS] Loaded routine tools:', allToolRows.map(t => `${t.method} ${t.path}`).join(', '));

  return { toolRows: allToolRows, success: true };
}

/**
 * Load tools from global template_tools table for template-based sources.
 *
 * @param {object} supabase - Supabase client
 * @param {Array} templateSources - Template-based sources
 * @param {string|null} userQuery - User's query for semantic search
 * @param {number} quota - Max tools to return (per-source quota)
 */
async function loadTemplateTools(supabase, templateSources, userQuery = null, quota = DEFAULT_TOOLS_PER_SOURCE) {
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
  console.log('[TOOLS] Semantic search check: count', totalCount, '> threshold', MIN_TOOLS_FOR_RAG, '?', totalCount > MIN_TOOLS_FOR_RAG, '| query:', userQuery ? `"${userQuery.slice(0, 50)}..."` : '(empty)', '| quota:', quota);

  let toolRows = [];

  // If too many tools and we have a query, use semantic search (pure RAG)
  if (totalCount > MIN_TOOLS_FOR_RAG && userQuery) {
    const coverage = await getTemplateEmbeddingCoverage(supabase, templateIds);
    const coveragePercent = coverage.total > 0 ? (coverage.withEmbeddings / coverage.total) * 100 : 0;

    console.log('[TOOLS] Template embeddings:', coverage.withEmbeddings, '/', coverage.total, `(${coveragePercent.toFixed(0)}%)`);

    if (coveragePercent > 50) {
      console.log('[TOOLS] Using RAG semantic search for template tools');
      console.log('[TOOLS] Query:', userQuery);

      // Pure RAG: semantic search with embeddings
      const matches = await searchTemplateTools(supabase, templateIds, userQuery, quota);

      if (matches.length > 0) {
        // Log top results with similarity scores
        console.log('[TOOLS] RAG results (top 15 by similarity):');
        matches.slice(0, 15).forEach((m, i) => {
          console.log(`  ${i + 1}. [${(m.similarity * 100).toFixed(1)}%] ${m.tool_id}`);
        });

        const toolIds = matches.map(m => m.tool_id);
        const similarityMap = new Map(matches.map(m => [m.tool_id, m.similarity]));

        const { data: rows } = await supabase
          .from('template_tools')
          .select(`
            id, name, description, method, path, parameters, request_body,
            risk_level, requires_confirmation, mcp_tool_name, template_id
          `)
          .in('id', toolIds);

        // Preserve semantic ranking order
        const idOrder = new Map(toolIds.map((id, i) => [id, i]));
        const sortedRows = (rows || []).sort((a, b) =>
          (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999)
        );

        // Log final tools with names and similarity
        console.log('[TOOLS] RAG final selection:');
        sortedRows.slice(0, 15).forEach((t, i) => {
          const sim = similarityMap.get(t.id);
          console.log(`  ${i + 1}. [${(sim * 100).toFixed(1)}%] ${t.method} ${t.path} - ${t.name}`);
        });
        if (sortedRows.length > 15) {
          console.log(`  ... and ${sortedRows.length - 15} more`);
        }

        toolRows = sortedRows.map(t => {
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

        console.log('[TOOLS] RAG returned', toolRows.length, 'template tools');
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
  const { enabledSourceIds, userQuery, orgId } = options;

  // ─────────────────────────────────────────────────────────────────────────
  // 0. CHECK FOR ROUTINE MATCH (if we have orgId and a query)
  // ─────────────────────────────────────────────────────────────────────────
  let matchedRoutine = null;
  if (orgId && userQuery) {
    const { routine, confidence, similarity } = await matchRoutine(supabase, orgId, userQuery);
    if (routine && confidence >= 0.5 && routine.tool_chain?.length > 0) {
      console.log('[TOOLS] Using routine:', routine.name, '| tools:', routine.tool_chain.length);
      matchedRoutine = { ...routine, confidence, similarity };
    }
  }

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
  let usedRoutineToolChain = false;

  // Build sourceMap for routine tool loading
  const sourceMap = new Map(sourcesWithHints.map(s => [s.name, s]));

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK: If we matched a routine with tool_chain, try loading those tools directly
  // ─────────────────────────────────────────────────────────────────────────
  if (matchedRoutine?.tool_chain?.length > 0) {
    console.log('[TOOLS] ════ ROUTINE SHORTCUT ════');
    console.log('[TOOLS] Matched routine:', matchedRoutine.name);
    console.log('[TOOLS] Tool chain:', matchedRoutine.tool_chain_names?.join(' → ') || matchedRoutine.tool_chain.join(', '));
    console.log('[TOOLS] Confidence:', (matchedRoutine.confidence * 100).toFixed(1) + '%');

    const { toolRows: routineToolRows, success } = await loadRoutineTools(
      supabase,
      matchedRoutine.tool_chain,
      sourceMap,
      credentialsMap
    );

    if (success && routineToolRows.length > 0) {
      console.log('[TOOLS] ✓ Loaded', routineToolRows.length, 'tools from routine chain (skipping RAG)');
      toolRows = routineToolRows;
      usedRoutineToolChain = true;
    } else {
      console.log('[TOOLS] ✗ Routine tool chain load failed, falling back to RAG');
      matchedRoutine = null; // Clear so we don't report it as used
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NORMAL FLOW: Only if we didn't use routine tool chain
  // ─────────────────────────────────────────────────────────────────────────
  if (!usedRoutineToolChain) {
    // ─────────────────────────────────────────────────────────────────────────
    // CALCULATE PER-SOURCE QUOTAS
    // ─────────────────────────────────────────────────────────────────────────
    // Total sources that will provide tools (excluding MCP which is live-loaded)
    const totalDbSources = templateSources.length + customSources.length;

    // Calculate quotas: ensure at least 5 per source, but try to distribute evenly
    // Single source gets full quota, multiple sources share proportionally
    const perSourceQuota = totalDbSources > 0
      ? Math.max(5, Math.floor(DEFAULT_TOOLS_PER_SOURCE / totalDbSources))
      : DEFAULT_TOOLS_PER_SOURCE;

    // Quota for template sources (proportional to their count)
    const templateQuota = templateSources.length > 0
      ? (totalDbSources === 1 ? DEFAULT_TOOLS_PER_SOURCE : perSourceQuota * templateSources.length)
      : 0;

    // Quota for custom sources (proportional to their count)
    const customQuotaForAll = customSources.length > 0
      ? (totalDbSources === 1 ? DEFAULT_TOOLS_PER_SOURCE : perSourceQuota * customSources.length)
      : 0;

    console.log('[TOOLS] Source quotas:', {
      totalDbSources,
      templateSources: templateSources.length,
      customSources: customSources.length,
      templateQuota,
      customQuota: customQuotaForAll,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1. TEMPLATE TOOLS: Load from global template_tools table
    // ─────────────────────────────────────────────────────────────────────────
    let templateToolRows = [];
    if (templateSources.length > 0) {
      templateToolRows = await loadTemplateTools(supabase, templateSources, userQuery, templateQuota);
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

      // Use calculated quota for custom sources
      const customQuota = customQuotaForAll;

      // If tool count exceeds threshold and we have a query, use RAG semantic search
      if (toolCount > MIN_TOOLS_FOR_RAG && userQuery) {
        const coverage = await getEmbeddingCoverage(supabase, customSourceIds);
        const coveragePercent = coverage.total > 0 ? (coverage.withEmbeddings / coverage.total) * 100 : 0;

        console.log('[TOOLS] Custom tool count:', toolCount, '| Embeddings:', coverage.withEmbeddings, '/', coverage.total, `(${coveragePercent.toFixed(0)}%)`);

        // Use RAG if we have decent embedding coverage (>50%)
        if (coveragePercent > 50) {
          console.log('[TOOLS] Using RAG semantic search for custom tools');
          console.log('[TOOLS] Query:', userQuery);

          const matches = await searchTools(supabase, customSourceIds, userQuery, customQuota);

          if (matches.length > 0) {
            usedSemanticSearch = true;

            // Log top results with similarity
            console.log('[TOOLS] RAG results (custom tools, top 15):');
            matches.slice(0, 15).forEach((m, i) => {
              console.log(`  ${i + 1}. [${(m.similarity * 100).toFixed(1)}%] ${m.tool_id}`);
            });

            const toolIds = matches.map(m => m.tool_id);
            const similarityMap = new Map(matches.map(m => [m.tool_id, m.similarity]));

            // Load only the relevant tools
            const { data: rows } = await supabase
              .from('tools')
              .select(`
                id, name, description, method, path, parameters, request_body,
                risk_level, requires_confirmation, source_id
              `)
              .in('id', toolIds);

            // Preserve semantic ranking order
            const idOrder = new Map(toolIds.map((id, i) => [id, i]));
            const sortedRows = (rows || []).sort((a, b) =>
              (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999)
            );

            // Enrich with source info and log
            const sourceById = new Map(customSources.map(s => [s.id, s]));

            console.log('[TOOLS] RAG final selection (custom):');
            sortedRows.slice(0, 15).forEach((t, i) => {
              const sim = similarityMap.get(t.id);
              console.log(`  ${i + 1}. [${(sim * 100).toFixed(1)}%] ${t.method} ${t.path} - ${t.name}`);
            });

            customToolRows = sortedRows.map(t => ({
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

            console.log('[TOOLS] RAG returned', customToolRows.length, 'custom tools');
          }
        } else {
          console.log('[TOOLS] Insufficient embedding coverage for RAG, falling back to full load');
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
  } // End of !usedRoutineToolChain block

  // ─────────────────────────────────────────────────────────────────────────
  // CONVERT TOOLS TO AI SDK FORMAT
  // ─────────────────────────────────────────────────────────────────────────
  dbTools = convertToolsToAISDK(toolRows, {
    sourceMap,
    userCredentialsMap: credentialsMap,
    userId,
  });

  // Merge MCP tools (AI SDK) with database tools
  let tools = { ...dbTools, ...mcpTools };

  // ─────────────────────────────────────────────────────────────────────────
  // 4. SYSTEM TOOLS: Add built-in tools for AI self-sufficiency
  // ─────────────────────────────────────────────────────────────────────────
  // Collect IDs for system tools to search
  const allTemplateIds = [...new Set(templateSources.map(s => s.template_id))];
  const allCustomSourceIds = customSources.map(s => s.id);

  const systemTools = createSystemTools({
    supabase,
    templateIds: allTemplateIds,
    customSourceIds: allCustomSourceIds,
  });

  // Add system tools (they don't count against API tool limits)
  tools = { ...tools, ...systemTools };

  const apiToolCount = Object.keys(dbTools).length + Object.keys(mcpTools).length;
  const systemToolCount = Object.keys(systemTools).length;
  const totalCount = Object.keys(tools).length;

  console.log('[TOOLS] Total tools:', totalCount, `(API: ${apiToolCount}, system: ${systemToolCount})`);
  console.log('[TOOLS] MCP tools:', Object.keys(mcpTools).length);
  console.log('[TOOLS] DB tools:', Object.keys(dbTools).length);
  console.log('[TOOLS] System tools:', Object.keys(systemTools));
  if (usedRoutineToolChain) {
    console.log('[TOOLS] ✓ Used routine tool chain (skipped RAG)');
  } else if (usedSemanticSearch) {
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

  return { tools, toolRows, sourceIds, sourcesWithHints, toolsWarning, matchedRoutine };
}
