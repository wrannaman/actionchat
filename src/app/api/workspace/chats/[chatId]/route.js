import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

/**
 * GET /api/workspace/chats/[chatId] — Load a specific chat with messages
 */
export async function GET(request, { params }) {
  try {
    const { chatId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    // Get the chat
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, title, created_at, agent_id')
      .eq('id', chatId)
      .eq('org_id', orgId)
      .single();

    if (chatError || !chat) {
      return Response.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Get messages for this chat
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, role, content, tool_calls, metadata, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('[CHAT] Failed to load messages:', msgError);
      return Response.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    // Convert to AI SDK message format
    const formattedMessages = (messages || []).map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.created_at,
    }));

    return Response.json({
      chat,
      messages: formattedMessages,
    });
  } catch (error) {
    console.error('[CHAT] Error:', error);
    return Response.json({ error: 'Failed to load chat' }, { status: 500 });
  }
}

/**
 * DELETE /api/workspace/chats/[chatId] — Delete a chat
 */
export async function DELETE(request, { params }) {
  try {
    const { chatId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    // Delete the chat (messages will cascade)
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('org_id', orgId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[CHAT] Failed to delete chat:', error);
      return Response.json({ error: 'Failed to delete chat' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[CHAT] Error:', error);
    return Response.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}
