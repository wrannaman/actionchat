import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getPermissions, requireMember, requireAdmin } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sources/[id] — Get source detail with tools
 */
export async function GET(request, { params }) {
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
    const memberErr = requireMember(perms);
    if (memberErr) {
      return NextResponse.json({ error: memberErr.error }, { status: memberErr.status });
    }

    // Get source (RLS will enforce org membership)
    const { data: source, error } = await supabase
      .from('api_sources')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Get tools for this source
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('id, operation_id, name, description, method, path, parameters, request_body, risk_level, requires_confirmation, tags, is_active, created_at')
      .eq('source_id', id)
      .order('method')
      .order('path');

    if (toolsError) throw toolsError;

    // Strip spec_content from response (can be large)
    const { spec_content, ...sourceMeta } = source;

    return NextResponse.json({
      ok: true,
      source: {
        ...sourceMeta,
        has_spec: !!spec_content,
        tool_count: tools?.length || 0,
      },
      tools: tools || [],
    });
  } catch (error) {
    console.error('[SOURCES] GET [id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get source', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sources/[id] — Update source metadata
 * Body: { name?, description?, base_url?, auth_type?, auth_config?, is_active? }
 */
export async function PUT(request, { params }) {
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

    const body = await request.json();
    const allowedFields = ['name', 'description', 'base_url', 'auth_type', 'auth_config', 'is_active', 'spec_url'];
    const updates = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // RLS enforces owner/admin can write
    const { data: source, error } = await supabase
      .from('api_sources')
      .update(updates)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('id, name, description, base_url, spec_url, auth_type, is_active, updated_at')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Source not found or no permission' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, source });
  } catch (error) {
    console.error('[SOURCES] PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update source', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sources/[id] — Delete source (cascades to tools)
 */
export async function DELETE(request, { params }) {
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

    // RLS enforces owner/admin can delete
    const { error } = await supabase
      .from('api_sources')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[SOURCES] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete source', details: error.message },
      { status: 500 }
    );
  }
}
