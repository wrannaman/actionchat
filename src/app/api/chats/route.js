import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chats - List user's chats
 *
 * Query params:
 *   - limit (default 50)
 *   - offset (default 0)
 *   - agent_id (optional filter)
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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const agentId = searchParams.get('agent_id');

    let query = supabase
      .from('chats')
      .select('id, title, agent_id, source_ids, created_at, updated_at')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data: chats, error } = await query;

    if (error) throw error;

    return NextResponse.json({ ok: true, chats: chats || [] });
  } catch (error) {
    console.error('[CHATS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to list chats', details: error.message },
      { status: 500 }
    );
  }
}
