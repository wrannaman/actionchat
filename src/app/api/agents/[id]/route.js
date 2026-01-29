import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getPermissions, requireMember, requireAdmin } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/[id] — Get agent detail with linked sources
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

    // Get agent (RLS enforces visibility)
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get linked sources with permission level
    const { data: links } = await supabase
      .from('agent_sources')
      .select('id, source_id, permission, created_at')
      .eq('agent_id', id);

    // Get source details for linked sources
    let linkedSources = [];
    if (links && links.length > 0) {
      const sourceIds = links.map(l => l.source_id);
      const { data: sources } = await supabase
        .from('api_sources')
        .select('id, name, description, base_url, source_type, is_active')
        .in('id', sourceIds);

      if (sources) {
        const sourceMap = new Map(sources.map(s => [s.id, s]));
        linkedSources = links.map(l => ({
          link_id: l.id,
          permission: l.permission,
          linked_at: l.created_at,
          ...sourceMap.get(l.source_id),
        })).filter(s => s.id); // filter out any orphaned links
      }
    }

    // Get all available sources (for the linking UI)
    const { data: allSources } = await supabase
      .from('api_sources')
      .select('id, name, base_url, source_type, is_active')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('name');

    return NextResponse.json({
      ok: true,
      agent,
      linked_sources: linkedSources,
      available_sources: allSources || [],
    });
  } catch (error) {
    console.error('[AGENTS] GET [id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get agent', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agents/[id] — Update agent configuration
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
    const allowedFields = ['name', 'description', 'system_prompt', 'model_provider', 'model_name', 'temperature', 'is_active', 'settings'];
    const updates = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (updates.temperature !== undefined) {
      updates.temperature = Math.min(2, Math.max(0, parseFloat(updates.temperature) || 0.1));
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: agent, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Agent not found or no permission' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, agent });
  } catch (error) {
    console.error('[AGENTS] PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update agent', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id] — Delete agent
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

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[AGENTS] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent', details: error.message },
      { status: 500 }
    );
  }
}
