import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

/**
 * POST /api/workspace/chats — Create a new chat
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const body = await request.json();
    const { agentId, title } = body;

    if (!agentId) {
      return Response.json({ error: 'agentId is required' }, { status: 400 });
    }

    console.log('[CHATS POST] Creating chat for agent:', agentId, 'title:', title);

    // Create the chat
    const { data: chat, error } = await supabase
      .from('chats')
      .insert({
        org_id: orgId,
        agent_id: agentId,
        user_id: user.id,
        title: title || 'New chat',
      })
      .select('id, title, created_at')
      .single();

    if (error) {
      console.error('[CHATS POST] Failed to create chat:', error);
      return Response.json({ error: 'Failed to create chat' }, { status: 500 });
    }

    console.log('[CHATS POST] Created chat:', chat.id);
    return Response.json({ chat });
  } catch (error) {
    console.error('[CHATS] Error:', error);
    return Response.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}

/**
 * GET /api/workspace/chats — List user's chats
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    // Get user's chats, most recent first
    const { data: chats, error } = await supabase
      .from('chats')
      .select('id, title, created_at, updated_at, agent_id')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[CHATS] Failed to load chats:', error);
      return Response.json({ error: 'Failed to load chats' }, { status: 500 });
    }

    return Response.json({ chats: chats || [] });
  } catch (error) {
    console.error('[CHATS] Error:', error);
    return Response.json({ error: 'Failed to load chats' }, { status: 500 });
  }
}
