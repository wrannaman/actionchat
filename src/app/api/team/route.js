import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const BLOCKED_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.co.uk',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'protonmail.com', 'proton.me', 'zoho.com', 'mail.com',
  'yandex.com', 'gmx.com', 'gmx.net', 'fastmail.com', 'tutanota.com', 'hey.com',
]);

/**
 * GET /api/team — Get team members, invite link, domain config
 */
export async function GET() {
  try {
    const userClient = await createClient();
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const orgId = cookieStore.get('org_id')?.value;

    if (!orgId) {
      return NextResponse.json({ message: 'No organization selected' }, { status: 400 });
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    // Verify membership and get role
    const { data: membership, error: memberError } = await supabase
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single();

    if (memberError || !membership) {
      return NextResponse.json({ message: 'Not a member of this organization' }, { status: 403 });
    }

    const isAdmin = ['owner', 'admin'].includes(membership.role);

    // Get org
    const { data: org } = await supabase
      .from('org')
      .select('allowed_domain')
      .eq('id', orgId)
      .single();

    // Get user's email domain
    const userDomain = user.email ? user.email.split('@')[1]?.toLowerCase() : null;
    const isBlockedDomain = userDomain ? BLOCKED_EMAIL_DOMAINS.has(userDomain) : false;

    // Get team members
    const { data: members, error: membersError } = await supabase
      .from('org_members')
      .select('id, user_id, role, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (membersError) throw membersError;

    // Get user details for each member
    const userIds = members.map(m => m.user_id);
    const { data: users } = await supabase.auth.admin.listUsers();
    const userMap = new Map();
    if (users?.users) {
      for (const u of users.users) {
        if (userIds.includes(u.id)) {
          userMap.set(u.id, {
            email: u.email,
            name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Unknown',
          });
        }
      }
    }

    const teamMembers = members.map(m => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      email: userMap.get(m.user_id)?.email || 'Unknown',
      name: userMap.get(m.user_id)?.name || 'Unknown',
      joined_at: m.created_at,
      is_current_user: m.user_id === user.id,
    }));

    // Get or create invite link (only for admins)
    let inviteUrl = null;
    let inviteToken = null;
    let inviteCreatedAt = null;

    if (isAdmin) {
      const { data: existingInvite, error: fetchError } = await supabase
        .from('org_invites')
        .select('token, created_at')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows, that's fine
      }

      if (existingInvite) {
        inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join/${existingInvite.token}`;
        inviteToken = existingInvite.token;
        inviteCreatedAt = existingInvite.created_at;
      } else {
        const { data: newInvite, error: createError } = await supabase
          .from('org_invites')
          .insert({
            org_id: orgId,
            created_by: user.id,
          })
          .select('token, created_at')
          .single();

        if (createError) throw createError;

        inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join/${newInvite.token}`;
        inviteToken = newInvite.token;
        inviteCreatedAt = newInvite.created_at;
      }
    }

    return NextResponse.json({
      ok: true,
      members: teamMembers,
      invite_url: inviteUrl,
      token: inviteToken,
      created_at: inviteCreatedAt,
      allowed_domain: org?.allowed_domain || null,
      user_domain: userDomain,
      can_edit: isAdmin,
      is_owner: membership.role === 'owner',
      is_blocked_domain: isBlockedDomain,
    });
  } catch (error) {
    console.error('[TEAM] GET Error:', error);
    return NextResponse.json(
      { message: 'Failed to get team settings', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team — Team management actions
 * Body: { action: 'regenerate-link' | 'update-domain' | 'update-role' | 'invite', ... }
 */
export async function POST(request) {
  try {
    const userClient = await createClient();
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const orgId = cookieStore.get('org_id')?.value;

    if (!orgId) {
      return NextResponse.json({ message: 'No organization selected' }, { status: 400 });
    }

    let body = {};
    try { body = await request.json(); } catch {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const { action } = body;

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    // Verify admin
    const { data: membership, error: memberError } = await supabase
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single();

    if (memberError || !membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    // --- Regenerate invite link ---
    if (action === 'regenerate-link') {
      await supabase
        .from('org_invites')
        .update({ is_active: false })
        .eq('org_id', orgId);

      const { data: newInvite, error: createError } = await supabase
        .from('org_invites')
        .insert({ org_id: orgId, created_by: user.id })
        .select('token, created_at')
        .single();

      if (createError) throw createError;

      return NextResponse.json({
        ok: true,
        invite_url: `${process.env.NEXT_PUBLIC_APP_URL}/join/${newInvite.token}`,
        token: newInvite.token,
        created_at: newInvite.created_at,
      });
    }

    // --- Update domain auto-join ---
    if (action === 'update-domain') {
      const { domain } = body;

      if (domain) {
        const userDomain = user.email ? user.email.split('@')[1]?.toLowerCase() : null;
        if (!userDomain || domain.toLowerCase() !== userDomain) {
          return NextResponse.json({
            message: 'You can only set the domain to match your own email domain',
          }, { status: 400 });
        }

        if (BLOCKED_EMAIL_DOMAINS.has(domain.toLowerCase())) {
          return NextResponse.json({
            message: 'Domain auto-join is not available for generic email providers',
          }, { status: 400 });
        }
      }

      await supabase
        .from('org')
        .update({ allowed_domain: domain ? domain.toLowerCase() : null })
        .eq('id', orgId);

      return NextResponse.json({
        ok: true,
        allowed_domain: domain ? domain.toLowerCase() : null,
        message: domain
          ? `Users with @${domain} email will automatically join on signup`
          : 'Domain auto-join disabled',
      });
    }

    // --- Update role ---
    if (action === 'update-role') {
      if (membership.role !== 'owner') {
        return NextResponse.json({ message: 'Only owners can change roles' }, { status: 403 });
      }

      const { memberId, role } = body;
      if (!memberId || !role || !['owner', 'admin', 'member'].includes(role)) {
        return NextResponse.json({ message: 'Invalid memberId or role' }, { status: 400 });
      }

      const { data: targetMember } = await supabase
        .from('org_members')
        .select('id, user_id, role')
        .eq('id', memberId)
        .eq('org_id', orgId)
        .single();

      if (!targetMember) {
        return NextResponse.json({ message: 'Member not found' }, { status: 404 });
      }

      // Can't demote yourself if only owner
      if (targetMember.user_id === user.id && role !== 'owner') {
        const { data: ownerCount } = await supabase
          .from('org_members')
          .select('id', { count: 'exact' })
          .eq('org_id', orgId)
          .eq('role', 'owner');

        if ((ownerCount?.length || 0) <= 1) {
          return NextResponse.json({
            message: 'Cannot demote yourself - you are the only owner',
          }, { status: 400 });
        }
      }

      await supabase
        .from('org_members')
        .update({ role })
        .eq('id', memberId);

      return NextResponse.json({ ok: true, message: `Role updated to ${role}` });
    }

    // --- Invite by email ---
    if (action === 'invite') {
      if (membership.role !== 'owner') {
        return NextResponse.json({ message: 'Only owners can invite' }, { status: 403 });
      }

      const { email } = body;
      if (!email?.trim()) {
        return NextResponse.json({ message: 'Email is required' }, { status: 400 });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check if user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

      if (existingUser) {
        // Check if already in org
        const { data: existingMember } = await supabase
          .from('org_members')
          .select('id')
          .eq('user_id', existingUser.id)
          .eq('org_id', orgId)
          .single();

        if (existingMember) {
          return NextResponse.json({
            ok: true,
            message: `${normalizedEmail} is already on your team`,
            already_member: true,
          });
        }

        // Add to org
        await supabase
          .from('org_members')
          .insert({ org_id: orgId, user_id: existingUser.id, role: 'member' });

        return NextResponse.json({
          ok: true,
          message: `Added ${normalizedEmail} to your team`,
        });
      }

      // User doesn't exist — send invite
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?org=${orgId}`,
      });

      if (inviteError) {
        return NextResponse.json({
          message: inviteError.message || 'Failed to send invite',
        }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: `Invite sent to ${normalizedEmail}`,
        invited: true,
      });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[TEAM] POST Error:', error);
    return NextResponse.json(
      { message: 'Failed to update team settings', details: error.message },
      { status: 500 }
    );
  }
}
