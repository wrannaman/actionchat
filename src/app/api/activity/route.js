import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { getPermissions, requireMember } from '@/utils/permissions';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/activity — List action_log entries for the org
 * Query params: agent_id, status, limit (default 50), offset (default 0)
 */
export async function GET(request) {
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
    if (memberErr) return NextResponse.json({ error: memberErr.error }, { status: memberErr.status });

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('action_log')
      .select('id, agent_id, user_id, tool_id, tool_name, method, url, request_body, status, response_status, duration_ms, requires_confirmation, confirmed_by, error_message, created_at, confirmed_at, executed_at, completed_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentId) query = query.eq('agent_id', agentId);
    if (status) query = query.eq('status', status);

    // Non-admins only see their own actions (RLS enforces this too)
    if (!perms.isAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data: actions, error } = await query;
    if (error) throw error;

    // Get agent names for display
    const agentIds = [...new Set(actions.map(a => a.agent_id).filter(Boolean))];
    let agentNames = {};
    if (agentIds.length > 0) {
      const { data: agents } = await supabase
        .from('agents')
        .select('id, name')
        .in('id', agentIds);
      if (agents) {
        for (const a of agents) agentNames[a.id] = a.name;
      }
    }

    const result = actions.map(a => ({
      ...a,
      agent_name: agentNames[a.agent_id] || null,
    }));

    return NextResponse.json({ ok: true, actions: result });
  } catch (error) {
    console.error('[ACTIVITY] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to list activity', details: error.message },
      { status: 500 }
    );
  }
}
