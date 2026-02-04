/**
 * POST /api/admin/templates/[id]/sync — Sync tools for a global template
 *
 * This endpoint syncs tools from a template's spec into the template_tools table.
 * Uses service role to bypass RLS. Requires admin authentication.
 *
 * Template tools are shared across all orgs - sync once, use everywhere.
 */

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { parseOpenApiSpec, embedTool, getEmbeddingDimension } from '@/lib/tools';
import { convertTools as convertMcpTools, listMCPTools, closeMCPClient } from '@/lib/mcp';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large specs with embedding generation

/**
 * Sync MCP template tools
 */
async function syncMcpTemplate(serviceClient, template) {
  // For MCP templates, we need to list tools from the MCP server
  // This requires a test connection - we'll use a placeholder credential structure
  const source = {
    id: template.id,
    name: template.name,
    mcp_server_uri: template.mcp_server_url,
    mcp_transport: template.mcp_transport || 'http',
  };

  // MCP templates need credentials to connect - for now, skip if no server URL
  if (!template.mcp_server_url) {
    return {
      ok: false,
      error: 'MCP template has no server URL configured',
    };
  }

  // Note: MCP tools are typically loaded live at runtime, not pre-synced
  // For now, return a message indicating this
  return {
    ok: true,
    message: 'MCP templates load tools at runtime - no sync needed',
    tool_count: 0,
  };
}

/**
 * Sync OpenAPI template tools
 */
async function syncOpenApiTemplate(serviceClient, template) {
  // Get spec content (from template or fetch from URL)
  let specContent = template.spec_content;

  if (!specContent && template.spec_url) {
    try {
      const fetchRes = await fetch(template.spec_url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      if (!fetchRes.ok) {
        return {
          ok: false,
          error: `Failed to fetch spec from URL: ${fetchRes.status} ${fetchRes.statusText}`,
        };
      }
      specContent = await fetchRes.json();
    } catch (fetchError) {
      return {
        ok: false,
        error: 'Failed to fetch spec from URL',
        details: fetchError.message,
      };
    }
  }

  if (!specContent) {
    return {
      ok: false,
      error: 'Template has no spec content or URL',
    };
  }

  // Parse the OpenAPI spec
  let parsed;
  try {
    parsed = parseOpenApiSpec(specContent);
  } catch (parseError) {
    return {
      ok: false,
      error: 'Failed to parse OpenAPI spec',
      details: parseError.message,
    };
  }

  console.log('[TEMPLATE SYNC] Parsed', parsed.tools.length, 'tools from template:', template.name);

  // Get existing template tools
  const { data: existingTools } = await serviceClient
    .from('template_tools')
    .select('id, operation_id')
    .eq('template_id', template.id);

  const existingByOpId = new Map();
  for (const t of existingTools || []) {
    if (t.operation_id) existingByOpId.set(t.operation_id, t.id);
  }

  // Separate into inserts and updates
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
        template_id: template.id,
        operation_id: tool.operation_id,
        ...toolData,
      });
    }
  }

  // Deactivate tools no longer in spec
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
    const { data, error } = await serviceClient
      .from('template_tools')
      .insert(toInsert)
      .select('id, name, description, method, path');

    if (error) {
      console.error('[TEMPLATE SYNC] Insert error:', error);
      return { ok: false, error: 'Failed to insert tools', details: error.message };
    }
    insertedCount = data?.length || 0;
    toolsToEmbed.push(...(data || []));
  }

  for (const tool of toUpdate) {
    const { id: toolId, ...updates } = tool;
    const { error } = await serviceClient
      .from('template_tools')
      .update(updates)
      .eq('id', toolId);

    if (error) {
      console.warn('[TEMPLATE SYNC] Update error for tool', toolId, ':', error);
    } else {
      updatedCount++;
      toolsToEmbed.push({ id: toolId, ...updates });
    }
  }

  // Batch deactivate tools no longer in spec (single query instead of N+1)
  if (removedOpIds.length > 0) {
    await serviceClient
      .from('template_tools')
      .update({ is_active: false })
      .eq('template_id', template.id)
      .in('operation_id', removedOpIds);
    removedCount = removedOpIds.length;
  }

  // Generate embeddings for new/updated tools (parallel with concurrency limit)
  const { column: embeddingColumn } = getEmbeddingDimension();
  console.log('[TEMPLATE SYNC] Generating embeddings for', toolsToEmbed.length, 'tools using column:', embeddingColumn);
  const CONCURRENCY = 10;
  for (let i = 0; i < toolsToEmbed.length; i += CONCURRENCY) {
    const batch = toolsToEmbed.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (tool) => {
        try {
          const embedding = await embedTool(tool);
          await serviceClient
            .from('template_tools')
            .update({ [embeddingColumn]: embedding })
            .eq('id', tool.id);
          return true;
        } catch (e) {
          console.warn('[TEMPLATE SYNC] Failed to embed tool:', tool.name, e.message);
          return false;
        }
      })
    );
    embeddedCount += results.filter(Boolean).length;

    // Log progress every 50 tools
    if (embeddedCount % 50 === 0 || i + CONCURRENCY >= toolsToEmbed.length) {
      console.log('[TEMPLATE SYNC] Embedded', embeddedCount, '/', toolsToEmbed.length, 'tools');
    }
  }

  // Update template's spec_content if we fetched from URL
  if (!template.spec_content && specContent) {
    await serviceClient
      .from('source_templates')
      .update({ spec_content: specContent })
      .eq('id', template.id);
  }

  return {
    ok: true,
    changed: true,
    inserted: insertedCount,
    updated: updatedCount,
    removed: removedCount,
    embedded: embeddedCount,
    tool_count: insertedCount + updatedCount,
  };
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // Authenticate user (must be logged in)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, any authenticated user can sync templates
    // TODO: Add admin-only check once we have superadmin roles

    // Use service client to bypass RLS
    const serviceClient = createServiceClient();

    // Get the template
    const { data: template, error: templateError } = await serviceClient
      .from('source_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    console.log('[TEMPLATE SYNC] ══════════════════════════════════════════');
    console.log('[TEMPLATE SYNC] Template:', template.name);
    console.log('[TEMPLATE SYNC] Type:', template.source_type);
    console.log('[TEMPLATE SYNC] ══════════════════════════════════════════');

    // Sync based on template type
    let result;
    if (template.source_type === 'mcp') {
      result = await syncMcpTemplate(serviceClient, template);
    } else if (template.source_type === 'openapi') {
      result = await syncOpenApiTemplate(serviceClient, template);
    } else {
      return NextResponse.json(
        { error: `Unknown template type: ${template.source_type}` },
        { status: 400 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[TEMPLATE SYNC] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync template', details: error.message },
      { status: 500 }
    );
  }
}
