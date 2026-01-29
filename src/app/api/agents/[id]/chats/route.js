import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { getPermissions, requireMember } from '@/utils/permissions';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/[id]/chats — List chat sessions for an agent
 * Returns recent chats with message counts and last activity.
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

    // Verify agent belongs to org
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get chats with message counts
    const { data: chats, error } = await supabase
      .from('chats')
      .select('id, title, created_at, updated_at, is_archived')
      .eq('agent_id', id)
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Get message counts for these chats
    const chatIds = (chats || []).map(c => c.id);
    let messageCounts = {};

    if (chatIds.length > 0) {
      const { data: counts } = await supabase
        .from('messages')
        .select('chat_id')
        .in('chat_id', chatIds);

      if (counts) {
        for (const row of counts) {
          messageCounts[row.chat_id] = (messageCounts[row.chat_id] || 0) + 1;
        }
      }
    }

    const result = (chats || []).map(chat => ({
      ...chat,
      message_count: messageCounts[chat.id] || 0,
    }));

    return NextResponse.json({ ok: true, chats: result });
  } catch (error) {
    console.error('[AGENT CHATS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to list chats', details: error.message },
      { status: 500 }
    );
  }
}
