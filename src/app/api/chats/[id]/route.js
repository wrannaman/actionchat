import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chats/[id] - Get a chat with its messages
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

    // Get chat
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, title, agent_id, source_ids, created_at, updated_at')
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Get messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, role, content, tool_calls, metadata, created_at')
      .eq('chat_id', id)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    // Get source details if source_ids exist
    let sources = [];
    if (chat.source_ids?.length > 0) {
      const { data: sourcesData } = await supabase
        .from('api_sources')
        .select('id, name, description, base_url')
        .in('id', chat.source_ids);
      sources = sourcesData || [];
    }

    return NextResponse.json({
      ok: true,
      chat: {
        ...chat,
        sources,
        messages: messages || [],
      },
    });
  } catch (error) {
    console.error('[CHATS] GET [id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get chat', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chats/[id] - Delete a chat and its messages
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

    // Verify ownership
    const { data: chat } = await supabase
      .from('chats')
      .select('id')
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Delete messages first (cascade should handle this, but explicit is safer)
    await supabase.from('messages').delete().eq('chat_id', id);

    // Delete chat
    const { error } = await supabase.from('chats').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[CHATS] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete chat', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chats/[id] - Update chat title
 */
export async function PATCH(request, { params }) {
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

    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const { data: chat, error } = await supabase
      .from('chats')
      .update({ title: title.slice(0, 200) })
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .select('id, title')
      .single();

    if (error) throw error;
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, chat });
  } catch (error) {
    console.error('[CHATS] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to update chat', details: error.message },
      { status: 500 }
    );
  }
}
