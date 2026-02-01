import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getPermissions, requireMember, requireAdmin } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents — List all agents for the current org
 */
export async function GET() {
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
    if (memberErr) {
      return NextResponse.json({ error: memberErr.error }, { status: memberErr.status });
    }

    // Get agents (RLS handles visibility — admin sees all, members see granted)
    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, name, description, model_provider, model_name, temperature, is_active, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get source counts per agent
    const agentIds = (agents || []).map(a => a.id);
    let sourceCounts = {};
    if (agentIds.length > 0) {
      const { data: links } = await supabase
        .from('agent_sources')
        .select('agent_id')
        .in('agent_id', agentIds);

      if (links) {
        for (const l of links) {
          sourceCounts[l.agent_id] = (sourceCounts[l.agent_id] || 0) + 1;
        }
      }
    }

    const result = (agents || []).map(a => ({
      ...a,
      source_count: sourceCounts[a.id] || 0,
    }));

    return NextResponse.json({ ok: true, agents: result });
  } catch (error) {
    console.error('[AGENTS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to list agents', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents — Create a new agent
 * Body: { name, description?, system_prompt?, model_provider?, model_name?, temperature?, source_ids?: [{source_id, permission}] }
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
    const adminErr = requireAdmin(perms);
    if (adminErr) {
      return NextResponse.json({ error: adminErr.error }, { status: adminErr.status });
    }

    const body = await request.json();
    const {
      name,
      description = '',
      system_prompt,
      model_provider = 'openai',
      model_name = 'gpt-5-mini',
      temperature = 0.1,
      source_links = [],
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Insert agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert({
        org_id: orgId,
        name: name.trim(),
        description: description || '',
        system_prompt: system_prompt || 'You are a helpful operations assistant. Be concise. Always include IDs in your responses.',
        model_provider,
        model_name,
        temperature: Math.min(2, Math.max(0, parseFloat(temperature) || 0.1)),
      })
      .select()
      .single();

    if (agentError) throw agentError;

    // Link sources if provided
    let linkedCount = 0;
    if (source_links.length > 0) {
      const linkRows = source_links.map(sl => ({
        agent_id: agent.id,
        source_id: sl.source_id,
        permission: sl.permission || 'read',
      }));

      const { data: inserted, error: linkError } = await supabase
        .from('agent_sources')
        .insert(linkRows)
        .select('id');

      if (linkError) {
        console.error('[AGENTS] Source link error:', linkError);
      } else {
        linkedCount = inserted?.length || 0;
      }
    }

    return NextResponse.json({
      ok: true,
      agent: { ...agent, source_count: linkedCount },
    }, { status: 201 });
  } catch (error) {
    console.error('[AGENTS] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create agent', details: error.message },
      { status: 500 }
    );
  }
}
