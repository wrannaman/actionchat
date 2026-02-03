import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/routines/[id] - Get a single routine
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: routine, error } = await supabase
      .from('routines')
      .select('id, name, prompt, description, parameters, is_shared, use_count, last_used_at, source_chat_id, created_by, created_at')
      .eq('id', id)
      .single();

    if (error || !routine) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, routine });
  } catch (error) {
    console.error('[ROUTINES] GET [id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get routine', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/routines/[id] - Update a routine
 *
 * Body: { name?, prompt?, description?, parameters?, is_shared? }
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates = {};

    // Normalize name if provided
    if (body.name !== undefined) {
      const normalizedName = body.name.trim().toLowerCase().replace(/\s+/g, '-');
      updates.name = normalizedName;

      // Check for duplicate name (excluding current routine)
      const { data: currentRoutine } = await supabase
        .from('routines')
        .select('org_id')
        .eq('id', id)
        .single();

      if (currentRoutine) {
        const { data: existing } = await supabase
          .from('routines')
          .select('id')
          .eq('org_id', currentRoutine.org_id)
          .eq('name', normalizedName)
          .neq('id', id)
          .maybeSingle();

        if (existing) {
          return NextResponse.json(
            { error: `A routine named "/${normalizedName}" already exists` },
            { status: 409 }
          );
        }
      }
    }

    if (body.prompt !== undefined) updates.prompt = body.prompt.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.parameters !== undefined) updates.parameters = body.parameters;
    if (body.is_shared !== undefined) updates.is_shared = body.is_shared;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data: routine, error } = await supabase
      .from('routines')
      .update(updates)
      .eq('id', id)
      .eq('created_by', user.id) // only owner can update
      .select('id, name, prompt, description, parameters, is_shared')
      .single();

    if (error) throw error;
    if (!routine) {
      return NextResponse.json({ error: 'Routine not found or not owned by you' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, routine });
  } catch (error) {
    console.error('[ROUTINES] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to update routine', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/routines/[id] - Delete a routine
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('routines')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id); // only owner can delete

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ROUTINES] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete routine', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/routines/[id]/use - Track routine usage
 *
 * Call this when user selects a routine to track popularity.
 * Returns the routine prompt and parameters for convenience.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First get the routine (RLS handles access)
    const { data: routine, error: fetchError } = await supabase
      .from('routines')
      .select('id, name, prompt, parameters, use_count, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !routine) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    }

    // Only increment if user owns it (can't update shared routines' counts via RLS)
    if (routine.created_by === user.id) {
      await supabase
        .from('routines')
        .update({
          use_count: (routine.use_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', id);
    }

    return NextResponse.json({
      ok: true,
      routine: {
        id: routine.id,
        name: routine.name,
        prompt: routine.prompt,
        parameters: routine.parameters || {},
      },
    });
  } catch (error) {
    console.error('[ROUTINES] POST [id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to use routine', details: error.message },
      { status: 500 }
    );
  }
}
