import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { getPermissions, requireMember } from '@/utils/permissions';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspace/tools - List all tools available to the user
 * Query params: agent_id (optional), source_id (optional)
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
    const sourceId = searchParams.get('source_id');

    // If agent_id provided, get tools for that agent
    if (agentId) {
      const { data: tools, error } = await supabase
        .rpc('get_agent_tools', { agent_uuid: agentId });

      if (error) {
        console.error('[TOOLS] RPC error:', error);
        return NextResponse.json({ error: 'Failed to fetch tools' }, { status: 500 });
      }

      // Map to expected format
      const result = (tools || []).map(t => ({
        id: t.tool_id,
        name: t.tool_name,
        description: t.description,
        method: t.method,
        path: t.path,
        parameters: t.parameters,
        request_body: t.request_body,
        risk_level: t.risk_level,
        requires_confirmation: t.requires_confirmation,
        source_name: t.source_name,
        base_url: t.base_url,
      }));

      return NextResponse.json({ ok: true, tools: result });
    }

    // If source_id provided, get tools for that source
    if (sourceId) {
      const { data: tools, error } = await supabase
        .from('tools')
        .select('id, name, description, method, path, parameters, request_body, risk_level, requires_confirmation')
        .eq('source_id', sourceId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return NextResponse.json({ ok: true, tools: tools || [] });
    }

    // Otherwise, get all tools from active sources in the org
    const { data: sources, error: sourcesError } = await supabase
      .from('api_sources')
      .select('id, name, base_url')
      .eq('org_id', orgId)
      .eq('is_active', true);

    if (sourcesError) throw sourcesError;

    const sourceIds = (sources || []).map(s => s.id);
    if (sourceIds.length === 0) {
      return NextResponse.json({ ok: true, tools: [] });
    }

    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('id, source_id, name, description, method, path, parameters, request_body, risk_level, requires_confirmation')
      .in('source_id', sourceIds)
      .eq('is_active', true)
      .order('name');

    if (toolsError) throw toolsError;

    // Add source info to each tool
    const sourceMap = Object.fromEntries(sources.map(s => [s.id, s]));
    const result = (tools || []).map(t => ({
      ...t,
      source_name: sourceMap[t.source_id]?.name,
      base_url: sourceMap[t.source_id]?.base_url,
    }));

    return NextResponse.json({ ok: true, tools: result });
  } catch (error) {
    console.error('[TOOLS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tools', details: error.message },
      { status: 500 }
    );
  }
}
