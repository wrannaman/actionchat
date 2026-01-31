import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

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
