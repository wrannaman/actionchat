import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/routines - List routines (own + shared in org)
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

    // Get user's own routines + shared routines in org
    const { data: routines, error } = await supabase
      .from('routines')
      .select('id, name, prompt, description, is_shared, use_count, last_used_at, created_by, created_at')
      .or(`created_by.eq.${user.id},and(is_shared.eq.true,org_id.eq.${orgId})`)
      .order('use_count', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      routines: routines || [],
    });
  } catch (error) {
    console.error('[ROUTINES] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to list routines', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/routines - Create a routine
 *
 * Body: { name, prompt, description?, is_shared? }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const body = await request.json();
    const { name, prompt, description, is_shared } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const { data: routine, error } = await supabase
      .from('routines')
      .insert({
        org_id: orgId,
        created_by: user.id,
        name: name.trim(),
        prompt: prompt.trim(),
        description: description?.trim() || null,
        is_shared: is_shared || false,
      })
      .select('id, name, prompt, description, is_shared, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, routine });
  } catch (error) {
    console.error('[ROUTINES] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create routine', details: error.message },
      { status: 500 }
    );
  }
}
