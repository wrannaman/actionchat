import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { getPermissions, requireMember } from '@/utils/permissions';
import { executeTool } from '@/lib/tools';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tools/execute - Execute a tool directly (for slash commands)
 * Body: { toolId: string, params: object }
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

    const { toolId, params } = await request.json();
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

    // Get user credentials for this source (active credential only)
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
      args: params || {},
      userCredentials: credentials?.credentials,
      userId: user.id,
    });

    return NextResponse.json({
      ok: !result.error_message,
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
