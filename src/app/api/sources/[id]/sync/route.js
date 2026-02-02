import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserOrgId } from '@/utils/supabase/server';
import { parseOpenApiSpec } from '@/lib/openapi-parser';
import { convertTools as convertMcpTools } from '@/lib/mcp-parser';
import * as mcpManager from '@/lib/mcp-manager';
import { cookies } from 'next/headers';
import { getPermissions, requireAdmin } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

/**
 * Sync an MCP source - reconnect and refresh tools list
 */
async function syncMcpSource(supabase, source, userId) {
  try {
    // Get user credentials for the MCP connection
    const { data: creds } = await supabase
      .from('user_api_credentials')
      .select('credentials')
      .eq('user_id', userId)
      .eq('source_id', source.id)
      .eq('is_active', true)
      .single();

    // Build MCP config
    const mcpAuthToken = creds?.credentials?.token || creds?.credentials?.api_key;

    const mcpConfig = {
      mcp_server_uri: source.mcp_server_uri,
      mcp_transport: source.mcp_transport || 'stdio',
      mcp_auth_token: mcpAuthToken,
      mcp_env: source.mcp_env || {},
    };

    console.log('[MCP SYNC] ══════════════════════════════════════════');
    console.log('[MCP SYNC] Source:', source.name);
    console.log('[MCP SYNC] Server URI:', source.mcp_server_uri);
    console.log('[MCP SYNC] Transport:', source.mcp_transport);
    console.log('[MCP SYNC] Has auth token:', !!mcpAuthToken);
    console.log('[MCP SYNC] ══════════════════════════════════════════');

    // Disconnect any existing connection to force fresh data
    mcpManager.disconnect(source.id);

    // List tools from MCP server
    const mcpTools = await mcpManager.listTools(source.id, mcpConfig);

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

    if (toInsert.length > 0) {
      const { data } = await supabase.from('tools').insert(toInsert).select('id');
      insertedCount = data?.length || 0;
    }

    for (const tool of toUpdate) {
      const { id: toolId, ...updates } = tool;
      await supabase.from('tools').update(updates).eq('id', toolId);
      updatedCount++;
    }

    if (removedOpIds.length > 0) {
      for (const opId of removedOpIds) {
        await supabase
          .from('tools')
          .update({ is_active: false })
          .eq('source_id', source.id)
          .eq('operation_id', opId);
      }
      removedCount = removedOpIds.length;
    }

    // Update source last_synced_at
    await supabase
      .from('api_sources')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', source.id);

    // Disconnect temp connection
    mcpManager.disconnect(source.id);

    return NextResponse.json({
      ok: true,
      changed: true,
      inserted: insertedCount,
      updated: updatedCount,
      removed: removedCount,
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

    // Handle MCP sources
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

    if (toInsert.length > 0) {
      const { data } = await supabase.from('tools').insert(toInsert).select('id');
      insertedCount = data?.length || 0;
    }

    for (const tool of toUpdate) {
      const { id: toolId, ...updates } = tool;
      await supabase.from('tools').update(updates).eq('id', toolId);
      updatedCount++;
    }

    if (removedOpIds.length > 0) {
      for (const opId of removedOpIds) {
        await supabase
          .from('tools')
          .update({ is_active: false })
          .eq('source_id', id)
          .eq('operation_id', opId);
      }
      removedCount = removedOpIds.length;
    }

    return NextResponse.json({
      ok: true,
      changed: true,
      inserted: insertedCount,
      updated: updatedCount,
      removed: removedCount,
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
