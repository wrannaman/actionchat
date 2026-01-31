import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const WORKSPACE_AGENT_NAME = '__workspace__';

/**
 * PUT /api/workspace/sources/[id] — Link an existing source to the workspace
 */
export async function PUT(request, { params }) {
  try {
    const { id: sourceId } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    // Verify source belongs to org
    const { data: source } = await supabase
      .from('api_sources')
      .select('id, name')
      .eq('id', sourceId)
      .eq('org_id', orgId)
      .single();

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Get or create workspace agent
    let { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', WORKSPACE_AGENT_NAME)
      .single();

    if (!agent) {
      const { data: newAgent, error } = await supabase
        .from('agents')
        .insert({
          org_id: orgId,
          name: WORKSPACE_AGENT_NAME,
          description: 'Default workspace agent',
          system_prompt: 'You are a helpful operations assistant.',
          model_provider: 'openai',
          model_name: 'gpt-4o',
          temperature: 0.1,
        })
        .select('id')
        .single();
      if (error) throw error;
      agent = newAgent;
    }

    // Upsert the link (in case it already exists)
    const { error } = await supabase
      .from('agent_sources')
      .upsert({
        agent_id: agent.id,
        source_id: sourceId,
        permission: 'read_write',
      }, {
        onConflict: 'agent_id,source_id',
      });

    if (error) throw error;

    // Get tool count for response
    const { data: tools } = await supabase
      .from('tools')
      .select('id')
      .eq('source_id', sourceId)
      .eq('is_active', true);

    return NextResponse.json({
      ok: true,
      source: {
        id: source.id,
        name: source.name,
        tool_count: tools?.length || 0,
      },
    });
  } catch (error) {
    console.error('[WORKSPACE] PUT source Error:', error);
    return NextResponse.json(
      { error: 'Failed to link source', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspace/sources/[id] — Remove an API source from the workspace
 *
 * This unlinks the source from the workspace agent (doesn't delete the source itself).
 */
export async function DELETE(request, { params }) {
  try {
    const { id: sourceId } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    // Get workspace agent
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', WORKSPACE_AGENT_NAME)
      .single();

    if (!agent) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Remove the link
    const { error } = await supabase
      .from('agent_sources')
      .delete()
      .eq('agent_id', agent.id)
      .eq('source_id', sourceId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[WORKSPACE] DELETE source Error:', error);
    return NextResponse.json(
      { error: 'Failed to remove source', details: error.message },
      { status: 500 }
    );
  }
}
