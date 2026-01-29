import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getPermissions, requireAdmin } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agents/[id]/sources — Link a source to this agent
 * Body: { source_id, permission? }
 */
export async function POST(request, { params }) {
  try {
    const { id: agentId } = await params;
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

    // Verify agent belongs to org
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .eq('org_id', orgId)
      .single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const body = await request.json();
    const { source_id, permission = 'read' } = body;

    if (!source_id) {
      return NextResponse.json({ error: 'source_id is required' }, { status: 400 });
    }

    if (!['read', 'read_write'].includes(permission)) {
      return NextResponse.json({ error: 'permission must be "read" or "read_write"' }, { status: 400 });
    }

    // Verify source belongs to same org
    const { data: source } = await supabase
      .from('api_sources')
      .select('id')
      .eq('id', source_id)
      .eq('org_id', orgId)
      .single();

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Upsert the link (update permission if already linked)
    const { data: link, error } = await supabase
      .from('agent_sources')
      .upsert({
        agent_id: agentId,
        source_id,
        permission,
      }, {
        onConflict: 'agent_id,source_id',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, link });
  } catch (error) {
    console.error('[AGENTS] LINK SOURCE Error:', error);
    return NextResponse.json(
      { error: 'Failed to link source', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]/sources — Unlink a source from this agent
 * Body: { source_id }
 */
export async function DELETE(request, { params }) {
  try {
    const { id: agentId } = await params;
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
    const { source_id } = body;

    if (!source_id) {
      return NextResponse.json({ error: 'source_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('agent_sources')
      .delete()
      .eq('agent_id', agentId)
      .eq('source_id', source_id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[AGENTS] UNLINK SOURCE Error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink source', details: error.message },
      { status: 500 }
    );
  }
}
