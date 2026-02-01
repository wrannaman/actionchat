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

    console.log('[LOAD CHAT] ════════════════════════════════════════');
    console.log('[LOAD CHAT] chatId:', chatId);
    console.log('[LOAD CHAT] messages found:', messages?.length || 0);
    console.log('[LOAD CHAT] msgError:', msgError);
    console.log('[LOAD CHAT] RAW messages from DB:', JSON.stringify(messages, null, 2));
    console.log('[LOAD CHAT] ════════════════════════════════════════');

    if (msgError) {
      console.error('[CHAT] Failed to load messages:', msgError);
      return Response.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    // Convert to AI SDK UIMessage format
    // IMPORTANT: For historical messages, we use TEXT-ONLY parts for useChat
    // (to avoid AI SDK errors about missing tool results), but we ALSO include
    // the stored tool_calls data so ChatMessage can render rich displays.
    const formattedMessages = (messages || []).map(msg => {
      // Build content string for the AI
      let content = msg.content || '';

      // For assistant messages with tool calls but no text content,
      // generate a brief summary for the AI context
      if (msg.role === 'assistant' && msg.tool_calls?.length && !content) {
        const toolSummary = msg.tool_calls.map(tc => {
          const resultInfo = tc.result?.body
            ? (Array.isArray(tc.result.body) ? `${tc.result.body.length} items` : 'done')
            : 'executed';
          return `${tc.tool_name} (${resultInfo})`;
        }).join(', ');
        content = `Called: ${toolSummary}`;
      }

      return {
        id: msg.id,
        role: msg.role,
        content,
        // Text-only parts for useChat (avoids AI SDK errors)
        parts: [{ type: 'text', text: content }],
        // Include stored tool_calls for ChatMessage to render rich displays
        toolCalls: msg.tool_calls || null,
        createdAt: msg.created_at,
      };
    });

    console.log('[ROUTE] Formatted messages to return:', JSON.stringify(formattedMessages, null, 2));

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
