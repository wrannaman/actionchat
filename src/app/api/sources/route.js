import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserOrgId } from '@/utils/supabase/server';
import { parseOpenApiSpec } from '@/lib/tools';
import { cookies } from 'next/headers';
import { getPermissions, requireMember, requireAdmin } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sources — List all API sources for the current org
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const perms = await getPermissions(user.id, orgId);
    const memberErr = requireMember(perms);
    if (memberErr) {
      return NextResponse.json({ error: memberErr.error }, { status: memberErr.status });
    }

    // Get sources with tool counts
    const { data: sources, error } = await supabase
      .from('api_sources')
      .select('id, name, description, source_type, base_url, spec_url, auth_type, is_active, last_synced_at, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get tool counts per source
    const sourceIds = sources.map(s => s.id);
    let toolCounts = {};
    if (sourceIds.length > 0) {
      const { data: tools, error: toolsError } = await supabase
        .from('tools')
        .select('source_id')
        .in('source_id', sourceIds)
        .eq('is_active', true);

      if (!toolsError && tools) {
        for (const t of tools) {
          toolCounts[t.source_id] = (toolCounts[t.source_id] || 0) + 1;
        }
      }
    }

    const result = sources.map(s => ({
      ...s,
      tool_count: toolCounts[s.id] || 0,
    }));

    return NextResponse.json({ ok: true, sources: result });
  } catch (error) {
    console.error('[SOURCES] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to list sources', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sources — Create a new API source
 * Body: { name, description?, base_url?, source_type?, auth_type?, auth_config?, spec_content? }
 */
export async function POST(request) {
  try {
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

    const body = await request.json();
    const {
      name,
      description = '',
      base_url = '',
      source_type = 'openapi',
      auth_type = 'passthrough',
      auth_config = {},
      spec_content = null,
      spec_url = null,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // If spec_url provided but no spec_content, fetch from URL
    let resolvedSpec = spec_content;
    if (spec_url && !resolvedSpec && source_type === 'openapi') {
      try {
        const fetchRes = await fetch(spec_url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000),
        });
        if (!fetchRes.ok) {
          return NextResponse.json(
            { error: `Failed to fetch spec from URL: ${fetchRes.status} ${fetchRes.statusText}` },
            { status: 400 }
          );
        }
        resolvedSpec = await fetchRes.json();
      } catch (fetchError) {
        return NextResponse.json(
          { error: 'Failed to fetch spec from URL', details: fetchError.message },
          { status: 400 }
        );
      }
    }

    // Parse OpenAPI spec if provided
    let parsedMeta = {};
    let parsedTools = [];
    let specHash = null;

    if (resolvedSpec && source_type === 'openapi') {
      try {
        const parsed = parseOpenApiSpec(resolvedSpec);
        parsedMeta = parsed.source_meta;
        parsedTools = parsed.tools;
        specHash = parsedMeta.spec_hash;
      } catch (parseError) {
        return NextResponse.json(
          { error: 'Failed to parse OpenAPI spec', details: parseError.message },
          { status: 400 }
        );
      }
    }

    // Insert source
    const { data: source, error: sourceError } = await supabase
      .from('api_sources')
      .insert({
        org_id: orgId,
        name: name.trim(),
        description: description || parsedMeta.description || '',
        base_url: base_url || parsedMeta.base_url || '',
        source_type,
        auth_type,
        auth_config,
        spec_content: resolvedSpec || null,
        spec_url: spec_url || null,
        spec_hash: specHash,
        last_synced_at: resolvedSpec ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (sourceError) throw sourceError;

    // Insert parsed tools
    let toolCount = 0;
    if (parsedTools.length > 0) {
      const toolRows = parsedTools.map(t => ({
        source_id: source.id,
        operation_id: t.operation_id,
        name: t.name,
        description: t.description,
        method: t.method,
        path: t.path,
        parameters: t.parameters || {},
        request_body: t.request_body || null,
        risk_level: t.risk_level,
        requires_confirmation: t.requires_confirmation,
        tags: t.tags || [],
      }));

      const { data: insertedTools, error: toolsError } = await supabase
        .from('tools')
        .insert(toolRows)
        .select('id');

      if (toolsError) {
        console.error('[SOURCES] Tools insert error:', toolsError);
      } else {
        toolCount = insertedTools?.length || 0;
      }
    }

    return NextResponse.json({
      ok: true,
      source: { ...source, tool_count: toolCount },
    }, { status: 201 });
  } catch (error) {
    console.error('[SOURCES] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create source', details: error.message },
      { status: 500 }
    );
  }
}
