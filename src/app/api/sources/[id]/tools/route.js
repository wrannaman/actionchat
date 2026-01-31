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

    // Verify user has access to this source
    const { data: source } = await supabase
      .from('api_sources')
      .select('id, name')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Get tools for this source
    const { data: tools, error } = await supabase
      .from('tools')
      .select('id, name, description, method, path, parameters, risk_level, requires_confirmation, tags')
      .eq('source_id', id)
      .eq('is_active', true)
      .order('path', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      source_id: id,
      tools: tools || []
    });
  } catch (error) {
    console.error('[TOOLS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get tools', details: error.message },
      { status: 500 }
    );
  }
}
