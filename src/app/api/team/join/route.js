import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Join an organization via invite link
 * POST /api/team/join
 * Body: { token: string }
 * 
 * Supports two types of invites:
 *   1. Org-level invite (project_id = null): Adds user to org with viewer access to ALL projects
 *   2. Project-scoped invite (project_id = UUID): Adds user to org + specific project + makes them evaluator
 */
export async function POST(request) {
  try {
    const userClient = await createClient();
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const { token, tags } = body;

    if (!token) {
      return NextResponse.json({ message: 'Token is required' }, { status: 400 });
    }

    // Tags come from URL query params, not from database
    const evaluatorTags = tags && tags.length > 0 ? tags : null;

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    // Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from('org_invites')
      .select('id, organization_id, project_id, expires_at, max_uses, use_count, is_active')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ message: 'Invalid invite link' }, { status: 404 });
    }

    // Validate invite
    if (!invite.is_active) {
      return NextResponse.json({ message: 'This invite link has been deactivated' }, { status: 400 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ message: 'This invite link has expired' }, { status: 400 });
    }

    if (invite.max_uses && invite.use_count >= invite.max_uses) {
      return NextResponse.json({ message: 'This invite link has reached its maximum uses' }, { status: 400 });
    }

    // Get org name and project name (if project-scoped)
    const { data: org } = await supabase
      .from('org')
      .select('name')
      .eq('id', invite.organization_id)
      .single();

    let projectName = null;
    if (invite.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', invite.project_id)
        .single();
      projectName = project?.name;
    }

    // Check if user is already a member of the org
    const { data: existingMember } = await supabase
      .from('org_members')
      .select('id, role')
      .eq('org_id', invite.organization_id)
      .eq('user_id', user.id)
      .single();

    let memberId = existingMember?.id;
    let wasAlreadyMember = !!existingMember;

    // Add to org if not already a member
    if (!existingMember) {
      const { data: newMember, error: memberError } = await supabase
        .from('org_members')
        .insert({
          org_id: invite.organization_id,
          user_id: user.id,
          role: 'member',
        })
        .select('id')
        .single();

      if (memberError) {
        throw memberError;
      }
      memberId = newMember.id;
    }

    // Handle project access
    if (invite.project_id) {
      // PROJECT-SCOPED INVITE: Add access to specific project only
      
      // Check if already has access
      const { data: existingAccess } = await supabase
        .from('member_project_access')
        .select('id')
        .eq('member_id', memberId)
        .eq('project_id', invite.project_id)
        .single();

      // Add project access if needed (and not an owner)
      if (!existingAccess && existingMember?.role !== 'owner') {
        await supabase
          .from('member_project_access')
          .insert({
            member_id: memberId,
            project_id: invite.project_id,
            access_level: 'viewer',
          });
      }

      // Add as evaluator (the key part - this makes evals appear in their queue)
      // Apply any tag filters from the URL query params
      await supabase
        .from('project_evaluators')
        .upsert({
          project_id: invite.project_id,
          user_id: user.id,
          tags: evaluatorTags, // null = see all, array = filtered (from ?tags= URL param)
        }, { onConflict: 'project_id,user_id' });

    } else {
      // ORG-LEVEL INVITE: Add viewer access to ALL projects but NOT as evaluator
      // Evaluator status must be explicitly set per project via project invite or toggle
      if (!wasAlreadyMember) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('org_id', invite.organization_id);

        if (projects && projects.length > 0) {
          const accessEntries = projects.map(p => ({
            member_id: memberId,
            project_id: p.id,
            access_level: 'viewer',
          }));

          await supabase
            .from('member_project_access')
            .insert(accessEntries);

          // NOTE: We do NOT add them as evaluators here - must be explicit
        }
      }
    }

    // Increment use count
    await supabase
      .from('org_invites')
      .update({ use_count: invite.use_count + 1 })
      .eq('id', invite.id);

    // Clean up phantom personal orgs
    const { data: userOrgs } = await supabase
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id);

    if (userOrgs && userOrgs.length > 1) {
      for (const membership of userOrgs) {
        if (membership.org_id === invite.organization_id) continue;
        if (membership.role !== 'owner') continue;

        const { count: memberCount } = await supabase
          .from('org_members')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', membership.org_id);

        if (memberCount === 1) {
          const { count: projectCount } = await supabase
            .from('projects')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', membership.org_id);

          if (projectCount === 0) {
            await supabase
              .from('org')
              .delete()
              .eq('id', membership.org_id);
            console.log('[TEAM/JOIN] Cleaned up phantom org', { orgId: membership.org_id, userId: user.id });
          }
        }
      }
    }

    // Build response message
    let message;
    if (wasAlreadyMember && invite.project_id) {
      message = `You're now an evaluator for ${projectName || 'this project'}!`;
    } else if (wasAlreadyMember) {
      message = `You're already a member of ${org?.name || 'this organization'}`;
    } else if (invite.project_id) {
      message = `Welcome! You've joined ${org?.name || 'the organization'} as an evaluator for ${projectName || 'the project'}.`;
    } else {
      message = `Successfully joined ${org?.name || 'the organization'}!`;
    }

    // Set org_id cookie in response
    const response = NextResponse.json({
      ok: true,
      message,
      org_id: invite.organization_id,
      org_name: org?.name,
      project_id: invite.project_id,
      project_name: projectName,
      already_member: wasAlreadyMember && !invite.project_id,
    });

    response.cookies.set('org_id', invite.organization_id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error('[TEAM/JOIN] Error:', error);
    return NextResponse.json(
      { message: 'Failed to join organization', details: error.message },
      { status: 500 }
    );
  }
}
