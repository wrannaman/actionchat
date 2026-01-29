import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserOrgId } from '@/utils/supabase/server';
import { parseOpenApiSpec } from '@/lib/openapi-parser';
import { cookies } from 'next/headers';
import { getPermissions, requireAdmin } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

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

    if (source.source_type !== 'openapi') {
      return NextResponse.json({ error: 'Only OpenAPI sources can be synced' }, { status: 400 });
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
