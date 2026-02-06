import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sources/[id]/tools — List all tools for a source
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

    // Verify user has access to this source and get template_id
    const { data: source } = await supabase
      .from('api_sources')
      .select('id, name, template_id')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    let tools = [];

    // Template-based sources use global template_tools
    if (source.template_id) {
      const { data, error } = await supabase
        .from('template_tools')
        .select('id, name, description, method, path, parameters, risk_level, requires_confirmation, tags')
        .eq('template_id', source.template_id)
        .eq('is_active', true)
        .order('path', { ascending: true });

      if (error) throw error;
      tools = data || [];
    } else {
      // Custom sources use per-org tools table
      const { data, error } = await supabase
        .from('tools')
        .select('id, name, description, method, path, parameters, risk_level, requires_confirmation, tags')
        .eq('source_id', id)
        .eq('is_active', true)
        .order('path', { ascending: true });

      if (error) throw error;
      tools = data || [];
    }

    return NextResponse.json({
      ok: true,
      source_id: id,
      tools
    });
  } catch (error) {
    console.error('[TOOLS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get tools', details: error.message },
      { status: 500 }
    );
  }
}
