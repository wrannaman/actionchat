import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { getPermissions, requireAdmin } from '@/utils/permissions';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/[id]/access — List members with access to this agent
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
    const adminErr = requireAdmin(perms);
    if (adminErr) return NextResponse.json({ error: adminErr.error }, { status: adminErr.status });

    // Get current access grants for this agent
    const { data: access, error } = await supabase
      .from('member_agent_access')
      .select('id, member_id, access_level, created_at')
      .eq('agent_id', id);

    if (error) throw error;

    // Get member details
    const memberIds = access.map(a => a.member_id);
    let memberDetails = {};
    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from('org_members')
        .select('id, user_id, role')
        .in('id', memberIds);

      if (members) {
        // Get user emails
        for (const m of members) {
          const { data: userData } = await supabase.auth.admin.getUserById(m.user_id);
          memberDetails[m.id] = {
            user_id: m.user_id,
            role: m.role,
            email: userData?.user?.email || 'Unknown',
          };
        }
      }
    }

    // Get all org members for the "grant access" dropdown
    const { data: allMembers } = await supabase
      .from('org_members')
      .select('id, user_id, role')
      .eq('org_id', orgId);

    let allMemberDetails = [];
    if (allMembers) {
      for (const m of allMembers) {
        // Skip owners/admins — they already have access via RLS
        if (m.role === 'owner' || m.role === 'admin') continue;
        const { data: userData } = await supabase.auth.admin.getUserById(m.user_id);
        allMemberDetails.push({
          member_id: m.id,
          user_id: m.user_id,
          role: m.role,
          email: userData?.user?.email || 'Unknown',
          has_access: memberIds.includes(m.id),
        });
      }
    }

    const result = access.map(a => ({
      ...a,
      ...memberDetails[a.member_id],
    }));

    return NextResponse.json({
      ok: true,
      access: result,
      available_members: allMemberDetails,
    });
  } catch (error) {
    console.error('[AGENT ACCESS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to list access', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[id]/access — Grant a member access to this agent
 * Body: { member_id, access_level? }
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
    if (adminErr) return NextResponse.json({ error: adminErr.error }, { status: adminErr.status });

    const body = await request.json();
    const { member_id, access_level = 'operator' } = body;

    if (!member_id) {
      return NextResponse.json({ error: 'member_id is required' }, { status: 400 });
    }

    if (!['operator', 'viewer'].includes(access_level)) {
      return NextResponse.json({ error: 'access_level must be operator or viewer' }, { status: 400 });
    }

    // Upsert access grant
    const { data, error } = await supabase
      .from('member_agent_access')
      .upsert({
        member_id,
        agent_id: id,
        access_level,
      }, { onConflict: 'member_id,agent_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, access: data }, { status: 201 });
  } catch (error) {
    console.error('[AGENT ACCESS] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to grant access', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]/access — Revoke a member's access
 * Body: { member_id }
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
    if (adminErr) return NextResponse.json({ error: adminErr.error }, { status: adminErr.status });

    const body = await request.json();
    const { member_id } = body;

    if (!member_id) {
      return NextResponse.json({ error: 'member_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('member_agent_access')
      .delete()
      .eq('member_id', member_id)
      .eq('agent_id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[AGENT ACCESS] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke access', details: error.message },
      { status: 500 }
    );
  }
}
