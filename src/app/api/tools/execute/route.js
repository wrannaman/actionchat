import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { getPermissions, requireMember } from '@/utils/permissions';
import { executeTool } from '@/lib/tool-executor';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tools/execute - Execute a tool directly (for slash commands)
 * Body: { toolId: string, params: object, confirmed?: boolean }
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

    const { toolId, params, confirmed, agentId } = await request.json();
    if (!toolId) {
      return NextResponse.json({ error: 'toolId is required' }, { status: 400 });
    }

    // Fetch the tool and source
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .select('*, api_sources(*)')
      .eq('id', toolId)
      .single();

    if (toolError || !tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    const source = tool.api_sources;

    // Check if tool requires confirmation
    if (tool.requires_confirmation && !confirmed) {
      // Create a pending action and return for confirmation
      const { data: action, error: insertError } = await supabase
        .from('action_log')
        .insert({
          org_id: orgId,
          agent_id: agentId || null,
          user_id: user.id,
          tool_id: toolId,
          tool_name: tool.name,
          method: tool.method,
          url: source.base_url + tool.path,
          request_body: params,
          status: 'pending_confirmation',
          requires_confirmation: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[EXECUTE] Insert error:', insertError);
        return NextResponse.json({ error: 'Failed to create action' }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        requiresConfirmation: true,
        action,
        tool: {
          id: tool.id,
          name: tool.name,
          method: tool.method,
          path: tool.path,
        },
      });
    }

    // Get user credentials for this source
    const { data: credentials } = await supabase
      .from('user_api_credentials')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('source_id', source.id)
      .single();

    // Execute the tool
    const result = await executeTool({
      tool,
      source,
      args: params || {},
      userCredentials: credentials?.credentials,
      userId: user.id,
    });

    // Log the action
    const status = result.error_message ? 'failed' : 'completed';
    const { data: action, error: logError } = await supabase
      .from('action_log')
      .insert({
        org_id: orgId,
        agent_id: agentId || null,
        user_id: user.id,
        tool_id: toolId,
        tool_name: tool.name,
        method: tool.method,
        url: result.url,
        request_body: params,
        response_status: result.response_status,
        response_body: result.response_body,
        duration_ms: result.duration_ms,
        status,
        requires_confirmation: false,
        error_message: result.error_message,
        executed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      console.error('[EXECUTE] Log error:', logError);
    }

    return NextResponse.json({
      ok: true,
      action,
      result: {
        status: result.response_status,
        body: result.response_body,
        duration_ms: result.duration_ms,
        error: result.error_message,
      },
    });
  } catch (error) {
    console.error('[EXECUTE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute tool', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tools/execute - Confirm or reject a pending action
 * Body: { actionId: string, approved: boolean }
 */
export async function PUT(request) {
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

    const { actionId, approved } = await request.json();
    if (!actionId) {
      return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
    }

    // Fetch the action
    const { data: action, error: actionError } = await supabase
      .from('action_log')
      .select('*')
      .eq('id', actionId)
      .eq('org_id', orgId)
      .eq('status', 'pending_confirmation')
      .single();

    if (actionError || !action) {
      return NextResponse.json({ error: 'Action not found or already processed' }, { status: 404 });
    }

    // Check ownership or admin
    if (action.user_id !== user.id && !perms.isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (!approved) {
      // Reject the action
      const { error: updateError } = await supabase
        .from('action_log')
        .update({
          status: 'rejected',
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      if (updateError) throw updateError;

      return NextResponse.json({ ok: true, status: 'rejected' });
    }

    // Confirm and execute
    const { error: confirmError } = await supabase
      .from('action_log')
      .update({
        status: 'confirmed',
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', actionId);

    if (confirmError) throw confirmError;

    // Fetch tool and source
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .select('*, api_sources(*)')
      .eq('id', action.tool_id)
      .single();

    if (toolError || !tool) {
      // Mark as failed
      await supabase
        .from('action_log')
        .update({
          status: 'failed',
          error_message: 'Tool no longer exists',
        })
        .eq('id', actionId);

      return NextResponse.json({ error: 'Tool not found' }, { status: 400 });
    }

    const source = tool.api_sources;

    // Get user credentials
    const { data: credentials } = await supabase
      .from('user_api_credentials')
      .select('credentials')
      .eq('user_id', action.user_id)
      .eq('source_id', source.id)
      .single();

    // Update to executing
    await supabase
      .from('action_log')
      .update({ status: 'executing' })
      .eq('id', actionId);

    // Execute
    const result = await executeTool({
      tool,
      source,
      args: action.request_body || {},
      userCredentials: credentials?.credentials,
      userId: action.user_id,
    });

    // Update final status
    const finalStatus = result.error_message ? 'failed' : 'completed';
    await supabase
      .from('action_log')
      .update({
        status: finalStatus,
        response_status: result.response_status,
        response_body: result.response_body,
        duration_ms: result.duration_ms,
        error_message: result.error_message,
        url: result.url,
      })
      .eq('id', actionId);

    return NextResponse.json({
      ok: true,
      status: finalStatus,
      result: {
        status: result.response_status,
        body: result.response_body,
        duration_ms: result.duration_ms,
        error: result.error_message,
      },
    });
  } catch (error) {
    console.error('[EXECUTE] PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to process action', details: error.message },
      { status: 500 }
    );
  }
}
