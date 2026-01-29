import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chats/[chatId]/messages — Load messages for a chat session
 * Used to resume a previous chat.
 */
export async function GET(request, { params }) {
  try {
    const { chatId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    // Verify chat belongs to user's org
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, agent_id, user_id, title')
      .eq('id', chatId)
      .eq('org_id', orgId)
      .single();

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Only the chat owner or admins can see messages
    if (chat.user_id !== user.id) {
      // Check if admin/owner
      const { data: membership } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .single();

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Load messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, role, content, tool_calls, metadata, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      chat: { id: chat.id, title: chat.title, agent_id: chat.agent_id },
      messages: messages || [],
    });
  } catch (error) {
    console.error('[CHAT MESSAGES] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to load messages', details: error.message },
      { status: 500 }
    );
  }
}
