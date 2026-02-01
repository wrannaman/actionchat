import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { getPermissions, requireMember } from '@/utils/permissions';
import { executeTool } from '@/lib/tool-executor';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tools/redo - Re-execute a previous action
 * Body: { actionId: string }
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
    const memberErr = requireMember(perms);
    if (memberErr) return NextResponse.json({ error: memberErr.error }, { status: memberErr.status });

    const { actionId } = await request.json();
    if (!actionId) {
      return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
    }

    // Fetch the original action
    const { data: action, error: actionError } = await supabase
      .from('action_log')
      .select('*')
      .eq('id', actionId)
      .eq('org_id', orgId)
      .single();

    if (actionError || !action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // Ensure user owns this action or is admin
    if (action.user_id !== user.id && !perms.isAdmin) {
      return NextResponse.json({ error: 'Not authorized to redo this action' }, { status: 403 });
    }

    // Check if action can be redone (must have tool_id and request_body)
    if (!action.tool_id) {
      return NextResponse.json({ error: 'Cannot redo: original tool not found' }, { status: 400 });
    }

    // Fetch the tool and source
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .select('*, api_sources(*)')
      .eq('id', action.tool_id)
      .single();

    if (toolError || !tool) {
      return NextResponse.json({ error: 'Tool no longer exists' }, { status: 400 });
    }

    const source = tool.api_sources;

    // If tool requires confirmation and is dangerous, check if this is a confirmed redo
    if (tool.requires_confirmation && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(tool.method)) {
      // Create a pending action log entry and return it for confirmation
      const { data: newAction, error: insertError } = await supabase
        .from('action_log')
        .insert({
          org_id: orgId,
          agent_id: action.agent_id,
          user_id: user.id,
          tool_id: action.tool_id,
          tool_name: action.tool_name,
          method: action.method,
          url: action.url,
          request_body: action.request_body,
          status: 'pending_confirmation',
          requires_confirmation: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[REDO] Insert error:', insertError);
        return NextResponse.json({ error: 'Failed to create action' }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        requiresConfirmation: true,
        action: newAction,
      });
    }

    // Get user credentials for this source (active only)
    const { data: credentials } = await supabase
      .from('user_api_credentials')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('source_id', source.id)
      .eq('is_active', true)
      .single();

    // Execute the tool
    const result = await executeTool({
      tool,
      source,
      args: action.request_body || {},
      userCredentials: credentials?.credentials,
      userId: user.id,
    });

    // Log the new action
    const newStatus = result.error_message ? 'failed' : 'completed';
    const { data: newAction, error: logError } = await supabase
      .from('action_log')
      .insert({
        org_id: orgId,
        agent_id: action.agent_id,
        user_id: user.id,
        tool_id: action.tool_id,
        tool_name: action.tool_name,
        method: action.method,
        url: result.url,
        request_body: action.request_body,
        response_status: result.response_status,
        response_body: result.response_body,
        duration_ms: result.duration_ms,
        status: newStatus,
        requires_confirmation: false,
        error_message: result.error_message,
        executed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      console.error('[REDO] Log error:', logError);
    }

    return NextResponse.json({
      ok: true,
      action: newAction,
      result: {
        status: result.response_status,
        body: result.response_body,
        duration_ms: result.duration_ms,
        error: result.error_message,
      },
    });
  } catch (error) {
    console.error('[REDO] Error:', error);
    return NextResponse.json(
      { error: 'Failed to redo action', details: error.message },
      { status: 500 }
    );
  }
}
