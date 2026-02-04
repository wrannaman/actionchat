import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserOrgId } from '@/utils/supabase/server';
import { parseOpenApiSpec, embedTool, getEmbeddingDimension } from '@/lib/tools';
import { convertTools as convertMcpTools, listMCPTools, closeMCPClient } from '@/lib/mcp';
import { cookies } from 'next/headers';
import { getPermissions, requireAdmin } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

/**
 * Sync an MCP source - reconnect and refresh tools list
 */
async function syncMcpSource(supabase, source, userId) {
  try {
    // Only HTTP MCP is supported
    const isHttpMcp = source.mcp_server_uri?.startsWith('http://') || source.mcp_server_uri?.startsWith('https://');
    if (!isHttpMcp) {
      return NextResponse.json(
        {
          error: 'This source uses stdio MCP which is not supported.',
          details: 'Only HTTP MCP integrations can be synced. Stdio MCP does not scale for multi-tenant deployments.',
        },
        { status: 400 }
      );
    }

    // Get user credentials for the MCP connection
    const { data: creds } = await supabase
      .from('user_api_credentials')
      .select('credentials')
      .eq('user_id', userId)
      .eq('source_id', source.id)
      .eq('is_active', true)
      .single();

    const credentials = creds?.credentials;

    console.log('[MCP SYNC] ══════════════════════════════════════════');
    console.log('[MCP SYNC] Source:', source.name);
    console.log('[MCP SYNC] Server URI:', source.mcp_server_uri);
    console.log('[MCP SYNC] Has credentials:', !!credentials);
    console.log('[MCP SYNC] ══════════════════════════════════════════');

    // Disconnect any existing connection to force fresh data
    await closeMCPClient(source.id);

    // List tools from MCP server
    const mcpTools = await listMCPTools(source, credentials);

    console.log('[MCP SYNC] Found', mcpTools.length, 'tools from MCP server');

    // Log full tool definitions
    for (const tool of mcpTools) {
      console.log('[MCP SYNC] Tool:', tool.name);
      console.log('[MCP SYNC]   Description:', tool.description);
      console.log('[MCP SYNC]   InputSchema:', JSON.stringify(tool.inputSchema, null, 2));
    }

    // Convert to ActionChat format
    const parsedTools = convertMcpTools(mcpTools, source.id);

    // Get existing tools
    const { data: existingTools } = await supabase
      .from('tools')
      .select('id, operation_id')
      .eq('source_id', source.id);

    const existingByOpId = new Map();
    for (const t of (existingTools || [])) {
      if (t.operation_id) existingByOpId.set(t.operation_id, t.id);
    }

    // Separate into inserts and updates
    const toInsert = [];
    const toUpdate = [];
    const seenOpIds = new Set();

    for (const tool of parsedTools) {
      seenOpIds.add(tool.operation_id);
      const existingId = existingByOpId.get(tool.operation_id);

      const toolData = {
        name: tool.name,
        description: tool.description,
        method: tool.method,
        path: tool.path,
        parameters: tool.parameters || {},
        request_body: tool.request_body || null,
        mcp_tool_name: tool.mcp_tool_name,
        risk_level: tool.risk_level,
        requires_confirmation: tool.requires_confirmation,
        tags: tool.tags || [],
        is_active: true,
      };

      if (existingId) {
        toUpdate.push({ id: existingId, ...toolData });
      } else {
        toInsert.push({
          source_id: source.id,
          operation_id: tool.operation_id,
          ...toolData,
        });
      }
    }

    // Deactivate tools no longer in MCP
    const removedOpIds = [];
    for (const [opId] of existingByOpId) {
      if (!seenOpIds.has(opId)) {
        removedOpIds.push(opId);
      }
    }

    // Execute DB operations
    let insertedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;
    let embeddedCount = 0;
    const toolsToEmbed = [];

    if (toInsert.length > 0) {
      const { data } = await supabase.from('tools').insert(toInsert).select('id, name, description, method, path');
      insertedCount = data?.length || 0;
      toolsToEmbed.push(...(data || []));
    }

    for (const tool of toUpdate) {
      const { id: toolId, ...updates } = tool;
      await supabase.from('tools').update(updates).eq('id', toolId);
      updatedCount++;
      toolsToEmbed.push({ id: toolId, ...updates });
    }

    // Batch deactivate tools no longer in MCP (single query instead of N+1)
    if (removedOpIds.length > 0) {
      await supabase
        .from('tools')
        .update({ is_active: false })
        .eq('source_id', source.id)
        .in('operation_id', removedOpIds);
      removedCount = removedOpIds.length;
    }

    // Generate embeddings for new/updated tools (parallel with concurrency limit)
    const { column: embeddingColumn } = getEmbeddingDimension();
    console.log('[MCP SYNC] Generating embeddings for', toolsToEmbed.length, 'tools using column:', embeddingColumn);
    const CONCURRENCY = 10;
    for (let i = 0; i < toolsToEmbed.length; i += CONCURRENCY) {
      const batch = toolsToEmbed.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (tool) => {
          try {
            const embedding = await embedTool(tool);
            await supabase
              .from('tools')
              .update({ [embeddingColumn]: embedding })
              .eq('id', tool.id);
            return true;
          } catch (e) {
            console.warn('[MCP SYNC] Failed to embed tool:', tool.name, e.message);
            return false;
          }
        })
      );
      embeddedCount += results.filter(Boolean).length;
    }
    console.log('[MCP SYNC] Embedded', embeddedCount, '/', toolsToEmbed.length, 'tools');

    // Update source last_synced_at
    await supabase
      .from('api_sources')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', source.id);

    // Disconnect temp connection
    await closeMCPClient(source.id);

    return NextResponse.json({
      ok: true,
      changed: true,
      inserted: insertedCount,
      updated: updatedCount,
      removed: removedCount,
      embedded: embeddedCount,
      tool_count: insertedCount + updatedCount,
    });
  } catch (error) {
    console.error('[MCP SYNC] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync MCP source', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sources/[id]/sync — Re-parse the OpenAPI spec and upsert tools
 * Optionally accepts { spec_content } in body to update the spec before syncing.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const perms = await getPermissions(user.id, orgId);
    const adminErr = requireAdmin(perms);
    if (adminErr) {
      return NextResponse.json({ error: adminErr.error }, { status: adminErr.status });
    }

    // Get existing source
    const { data: source, error: sourceError } = await supabase
      .from('api_sources')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEMPLATE-BASED SOURCES: Use global template_tools instead of per-org tools
    // ─────────────────────────────────────────────────────────────────────────
    if (source.template_id) {
      // Check if template has tools synced
      const { count: templateToolCount } = await supabase
        .from('template_tools')
        .select('id', { count: 'exact', head: true })
        .eq('template_id', source.template_id)
        .eq('is_active', true);

      if (templateToolCount > 0) {
        // Template tools exist - no sync needed for this source
        console.log('[SYNC] Source uses template with', templateToolCount, 'pre-synced tools');
        return NextResponse.json({
          ok: true,
          message: `This source uses a global template with ${templateToolCount} pre-synced tools. No sync needed.`,
          changed: false,
          tool_count: templateToolCount,
          uses_template: true,
        });
      }

      // Template has no tools - inform user to sync the template
      return NextResponse.json({
        ok: false,
        error: 'Template tools not synced',
        message: 'This source uses a template that has not been synced yet. Please sync the template first via POST /api/admin/templates/{template_id}/sync',
        template_id: source.template_id,
      }, { status: 400 });
    }

    // Handle MCP sources (custom, non-template)
    if (source.source_type === 'mcp') {
      return syncMcpSource(supabase, source, user.id);
    }

    if (source.source_type !== 'openapi') {
      return NextResponse.json({ error: 'Only OpenAPI and MCP sources can be synced' }, { status: 400 });
    }

    // Check if new spec was provided in body
    let body = {};
    try { body = await request.json(); } catch { /* empty body is fine */ }

    // Resolve spec: body > fetch from URL > stored spec
    let specContent = body.spec_content || null;
    let fetchedFromUrl = false;

    if (!specContent && source.spec_url) {
      try {
        const fetchRes = await fetch(source.spec_url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000),
        });
        if (!fetchRes.ok) {
          return NextResponse.json(
            { error: `Failed to fetch spec from URL: ${fetchRes.status} ${fetchRes.statusText}` },
            { status: 400 }
          );
        }
        specContent = await fetchRes.json();
        fetchedFromUrl = true;
      } catch (fetchError) {
        return NextResponse.json(
          { error: 'Failed to fetch spec from URL', details: fetchError.message },
          { status: 400 }
        );
      }
    }

    if (!specContent) {
      specContent = source.spec_content;
    }

    if (!specContent) {
      return NextResponse.json({ error: 'No spec content to sync. Add a spec URL or upload a spec.' }, { status: 400 });
    }

    // Parse spec
    let parsed;
    try {
      parsed = parseOpenApiSpec(specContent);
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Failed to parse OpenAPI spec', details: parseError.message },
        { status: 400 }
      );
    }

    // Check if spec actually changed
    if (parsed.source_meta.spec_hash === source.spec_hash && !body.spec_content) {
      return NextResponse.json({
        ok: true,
        message: 'Spec unchanged, no sync needed',
        changed: false,
        tool_count: 0,
      });
    }

    // Update source metadata
    const sourceUpdates = {
      spec_hash: parsed.source_meta.spec_hash,
      last_synced_at: new Date().toISOString(),
    };
    if (body.spec_content || fetchedFromUrl) {
      sourceUpdates.spec_content = specContent;
    }
    if (parsed.source_meta.base_url && !source.base_url) {
      sourceUpdates.base_url = parsed.source_meta.base_url;
    }

    await supabase
      .from('api_sources')
      .update(sourceUpdates)
      .eq('id', id);

    // Upsert tools by operation_id:
    // 1. Get existing tools
    const { data: existingTools } = await supabase
      .from('tools')
      .select('id, operation_id')
      .eq('source_id', id);

    const existingByOpId = new Map();
    for (const t of (existingTools || [])) {
      if (t.operation_id) existingByOpId.set(t.operation_id, t.id);
    }

    // 2. Separate into inserts and updates
    const toInsert = [];
    const toUpdate = [];
    const seenOpIds = new Set();

    for (const tool of parsed.tools) {
      seenOpIds.add(tool.operation_id);
      const existingId = existingByOpId.get(tool.operation_id);

      const toolData = {
        name: tool.name,
        description: tool.description,
        method: tool.method,
        path: tool.path,
        parameters: tool.parameters || {},
        request_body: tool.request_body || null,
        risk_level: tool.risk_level,
        requires_confirmation: tool.requires_confirmation,
        tags: tool.tags || [],
        is_active: true,
      };

      if (existingId) {
        toUpdate.push({ id: existingId, ...toolData });
      } else {
        toInsert.push({
          source_id: id,
          operation_id: tool.operation_id,
          ...toolData,
        });
      }
    }

    // 3. Deactivate tools no longer in spec
    const removedOpIds = [];
    for (const [opId] of existingByOpId) {
      if (!seenOpIds.has(opId)) {
        removedOpIds.push(opId);
      }
    }

    // Execute DB operations
    let insertedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;
    let embeddedCount = 0;
    const toolsToEmbed = [];

    if (toInsert.length > 0) {
      const { data } = await supabase.from('tools').insert(toInsert).select('id, name, description, method, path');
      insertedCount = data?.length || 0;
      toolsToEmbed.push(...(data || []));
    }

    for (const tool of toUpdate) {
      const { id: toolId, ...updates } = tool;
      await supabase.from('tools').update(updates).eq('id', toolId);
      updatedCount++;
      toolsToEmbed.push({ id: toolId, ...updates });
    }

    // Batch deactivate tools no longer in spec (single query instead of N+1)
    if (removedOpIds.length > 0) {
      await supabase
        .from('tools')
        .update({ is_active: false })
        .eq('source_id', id)
        .in('operation_id', removedOpIds);
      removedCount = removedOpIds.length;
    }

    // Generate embeddings for new/updated tools (parallel with concurrency limit)
    const { column: embeddingColumn } = getEmbeddingDimension();
    console.log('[SYNC] Generating embeddings for', toolsToEmbed.length, 'tools using column:', embeddingColumn);
    const CONCURRENCY = 10;
    for (let i = 0; i < toolsToEmbed.length; i += CONCURRENCY) {
      const batch = toolsToEmbed.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (tool) => {
          try {
            const embedding = await embedTool(tool);
            await supabase
              .from('tools')
              .update({ [embeddingColumn]: embedding })
              .eq('id', tool.id);
            return true;
          } catch (e) {
            console.warn('[SYNC] Failed to embed tool:', tool.name, e.message);
            return false;
          }
        })
      );
      embeddedCount += results.filter(Boolean).length;
    }
    console.log('[SYNC] Embedded', embeddedCount, '/', toolsToEmbed.length, 'tools');

    return NextResponse.json({
      ok: true,
      changed: true,
      inserted: insertedCount,
      updated: updatedCount,
      removed: removedCount,
      embedded: embeddedCount,
      tool_count: insertedCount + updatedCount,
    });
  } catch (error) {
    console.error('[SOURCES] SYNC Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync source', details: error.message },
      { status: 500 }
    );
  }
}
