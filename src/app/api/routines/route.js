import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { generateEmbedding } from '@/lib/ai';

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
      .select('id, name, prompt, description, parameters, is_shared, use_count, last_used_at, source_chat_id, created_by, created_at, tool_chain, tool_chain_names, success_count, failure_count')
      .or(`created_by.eq.${user.id},and(is_shared.eq.true,org_id.eq.${orgId})`)
      .order('use_count', { ascending: false });

    if (error) throw error;

    // Add is_mine flag and dedupe (a shared routine I created shouldn't appear twice)
    const seen = new Set();
    const deduped = (routines || [])
      .map(r => ({ ...r, is_mine: r.created_by === user.id }))
      .filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

    return NextResponse.json({
      ok: true,
      routines: deduped,
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
 * Body: { name, prompt, description?, parameters?, source_chat_id?, is_shared?, tool_chain?, tool_chain_names? }
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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { name, prompt, description, parameters, source_chat_id, is_shared, tool_chain, tool_chain_names } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    // Normalize name (lowercase, no spaces)
    const normalizedName = name.trim().toLowerCase().replace(/\s+/g, '-');

    // Check for duplicate name in org
    const { data: existing } = await supabase
      .from('routines')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', normalizedName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `A routine named "/${normalizedName}" already exists` },
        { status: 409 }
      );
    }

    // Validate tool_chain if provided (must be array of valid UUIDs)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (tool_chain && Array.isArray(tool_chain)) {
      for (const id of tool_chain) {
        if (typeof id !== 'string' || !uuidRegex.test(id)) {
          return NextResponse.json(
            { error: 'tool_chain must contain valid UUIDs' },
            { status: 400 }
          );
        }
      }
    }

    // If source_chat_id provided, verify it belongs to this org
    if (source_chat_id) {
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('id', source_chat_id)
        .eq('org_id', orgId)
        .single();

      if (chatError || !chat) {
        return NextResponse.json({ error: 'Source chat not found' }, { status: 400 });
      }
    }

    // Generate embedding for semantic matching of queries to this routine
    let embedding = null;
    try {
      // Embed the prompt + description for semantic matching
      const textToEmbed = `${prompt.trim()} ${description?.trim() || ''}`;
      embedding = await generateEmbedding(textToEmbed);
    } catch (embErr) {
      console.warn('[ROUTINES] Failed to generate embedding:', embErr.message);
      // Continue without embedding - routine matching will fall back to text search
    }

    const insertData = {
      org_id: orgId,
      created_by: user.id,
      name: normalizedName,
      prompt: prompt.trim(),
      description: description?.trim() || null,
      parameters: parameters || {},
      source_chat_id: source_chat_id || null,
      is_shared: is_shared || false,
      tool_chain: tool_chain || [],
      tool_chain_names: tool_chain_names || [],
    };

    // Add embedding if generated successfully
    if (embedding) {
      insertData.embedding_1536 = embedding;
    }

    const { data: routine, error } = await supabase
      .from('routines')
      .insert(insertData)
      .select('id, name, prompt, description, parameters, is_shared, source_chat_id, tool_chain, tool_chain_names, created_at')
      .single();

    if (error) throw error;

    console.log('[ROUTINES] Created routine:', routine.name, 'with', routine.tool_chain?.length || 0, 'tools in chain');

    return NextResponse.json({ ok: true, routine }, { status: 201 });
  } catch (error) {
    console.error('[ROUTINES] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create routine', details: error.message },
      { status: 500 }
    );
  }
}
