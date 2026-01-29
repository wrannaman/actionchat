import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { getPermissions, requireMember, requireAdmin } from '@/utils/permissions';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/[id]/embed — List embed configs for this agent
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
    const memberErr = requireMember(perms);
    if (memberErr) return NextResponse.json({ error: memberErr.error }, { status: memberErr.status });

    const { data: configs, error } = await supabase
      .from('embed_configs')
      .select('id, name, embed_token, allowed_origins, theme, settings, is_active, created_at')
      .eq('agent_id', id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, configs });
  } catch (error) {
    console.error('[AGENT EMBED] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to list embed configs', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[id]/embed — Create an embed config
 * Body: { name?, allowed_origins?, theme?, settings? }
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

    // Verify agent belongs to org
    const { data: agent } = await supabase
      .from('agents')
      .select('id, org_id')
      .eq('id', id)
      .single();

    if (!agent || agent.org_id !== orgId) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, allowed_origins, theme, settings } = body;

    const configData = {
      org_id: orgId,
      agent_id: id,
      name: name || 'Default Widget',
      allowed_origins: allowed_origins || [],
      theme: theme || {},
      settings: settings || {},
      is_active: true,
    };

    const { data: config, error } = await supabase
      .from('embed_configs')
      .insert(configData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, config }, { status: 201 });
  } catch (error) {
    console.error('[AGENT EMBED] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create embed config', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agents/[id]/embed — Update an embed config
 * Body: { config_id, name?, allowed_origins?, theme?, settings?, is_active? }
 */
export async function PUT(request, { params }) {
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
    const { config_id, ...fields } = body;

    if (!config_id) {
      return NextResponse.json({ error: 'config_id is required' }, { status: 400 });
    }

    const allowedFields = ['name', 'allowed_origins', 'theme', 'settings', 'is_active'];
    const update = {};
    for (const key of allowedFields) {
      if (key in fields) update[key] = fields[key];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: config, error } = await supabase
      .from('embed_configs')
      .update(update)
      .eq('id', config_id)
      .eq('agent_id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, config });
  } catch (error) {
    console.error('[AGENT EMBED] PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update embed config', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]/embed — Delete an embed config
 * Body: { config_id }
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
    const { config_id } = body;

    if (!config_id) {
      return NextResponse.json({ error: 'config_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('embed_configs')
      .delete()
      .eq('id', config_id)
      .eq('agent_id', id)
      .eq('org_id', orgId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[AGENT EMBED] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete embed config', details: error.message },
      { status: 500 }
    );
  }
}
