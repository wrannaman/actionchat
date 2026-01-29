import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { getPermissions, requireMember, requireAdmin } from '@/utils/permissions';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sources/[id]/tools — List tools for a source
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

    // Verify source belongs to org
    const { data: source } = await supabase
      .from('api_sources')
      .select('id, org_id')
      .eq('id', id)
      .single();

    if (!source || source.org_id !== orgId) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const { data: tools, error } = await supabase
      .from('tools')
      .select('id, name, description, method, path, parameters, request_body, risk_level, requires_confirmation, tags, is_active, operation_id, created_at, updated_at')
      .eq('source_id', id)
      .order('method')
      .order('path');

    if (error) throw error;

    return NextResponse.json({ ok: true, tools });
  } catch (error) {
    console.error('[SOURCE TOOLS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to list tools', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sources/[id]/tools — Create a manual tool
 * Body: { name, method, path, description?, parameters?, request_body?, risk_level?, requires_confirmation?, tags? }
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

    // Verify source belongs to org and is manual type
    const { data: source } = await supabase
      .from('api_sources')
      .select('id, org_id, source_type')
      .eq('id', id)
      .single();

    if (!source || source.org_id !== orgId) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    if (source.source_type !== 'manual') {
      return NextResponse.json(
        { error: 'Can only add tools to manual sources. Use sync for OpenAPI sources.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, method, path, description, parameters, request_body, risk_level, requires_confirmation, tags } = body;

    if (!name || !method || !path) {
      return NextResponse.json({ error: 'name, method, and path are required' }, { status: 400 });
    }

    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(method.toUpperCase())) {
      return NextResponse.json({ error: `method must be one of: ${validMethods.join(', ')}` }, { status: 400 });
    }

    const validRiskLevels = ['safe', 'moderate', 'dangerous'];
    const resolvedRisk = risk_level || (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? 'safe' : 'dangerous');
    if (!validRiskLevels.includes(resolvedRisk)) {
      return NextResponse.json({ error: `risk_level must be one of: ${validRiskLevels.join(', ')}` }, { status: 400 });
    }

    const toolData = {
      source_id: id,
      name,
      method: method.toUpperCase(),
      path,
      description: description || null,
      parameters: parameters || {},
      request_body: request_body || null,
      risk_level: resolvedRisk,
      requires_confirmation: requires_confirmation ?? (resolvedRisk === 'dangerous'),
      tags: tags || [],
      is_active: true,
    };

    const { data: tool, error } = await supabase
      .from('tools')
      .insert(toolData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, tool }, { status: 201 });
  } catch (error) {
    console.error('[SOURCE TOOLS] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create tool', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sources/[id]/tools — Update a tool
 * Body: { tool_id, ...fields }
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
    const { tool_id, ...fields } = body;

    if (!tool_id) {
      return NextResponse.json({ error: 'tool_id is required' }, { status: 400 });
    }

    // Verify tool belongs to this source and source to org
    const { data: tool } = await supabase
      .from('tools')
      .select('id, source_id, source:api_sources!inner(org_id, source_type)')
      .eq('id', tool_id)
      .eq('source_id', id)
      .single();

    if (!tool || tool.source.org_id !== orgId) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    const allowedFields = ['name', 'description', 'method', 'path', 'parameters', 'request_body', 'risk_level', 'requires_confirmation', 'tags', 'is_active'];
    const update = {};
    for (const key of allowedFields) {
      if (key in fields) update[key] = fields[key];
    }

    if (update.method) update.method = update.method.toUpperCase();

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('tools')
      .update(update)
      .eq('id', tool_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, tool: updated });
  } catch (error) {
    console.error('[SOURCE TOOLS] PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update tool', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sources/[id]/tools — Delete a tool
 * Body: { tool_id }
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
    const { tool_id } = body;

    if (!tool_id) {
      return NextResponse.json({ error: 'tool_id is required' }, { status: 400 });
    }

    // Verify tool belongs to this source and source to org
    const { data: tool } = await supabase
      .from('tools')
      .select('id, source_id, source:api_sources!inner(org_id)')
      .eq('id', tool_id)
      .eq('source_id', id)
      .single();

    if (!tool || tool.source.org_id !== orgId) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('tools')
      .delete()
      .eq('id', tool_id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[SOURCE TOOLS] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete tool', details: error.message },
      { status: 500 }
    );
  }
}
