import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/routines/[id]/feedback - Record routine execution feedback
 *
 * Body: { outcome: 'success' | 'failure' }
 *
 * This endpoint allows the UI to record whether a routine execution was successful
 * or not. This powers the confidence scoring system.
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const { id: routineId } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { outcome } = body;

    if (!['success', 'failure'].includes(outcome)) {
      return NextResponse.json(
        { error: 'outcome must be "success" or "failure"' },
        { status: 400 }
      );
    }

    // Verify routine belongs to this org
    const { data: routine, error: fetchError } = await supabase
      .from('routines')
      .select('id, name, success_count, failure_count, org_id')
      .eq('id', routineId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !routine) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    }

    // Atomically increment the appropriate counter using RPC to avoid race conditions
    const isSuccess = outcome === 'success';
    const { data: updated, error: updateError } = await supabase.rpc('increment_routine_feedback', {
      p_routine_id: routineId,
      p_is_success: isSuccess,
    });

    // Fallback to regular update if RPC doesn't exist yet
    if (updateError?.code === '42883') {
      // Function doesn't exist, use regular update
      const updateField = isSuccess ? 'success_count' : 'failure_count';
      const currentCount = routine[updateField] || 0;
      await supabase
        .from('routines')
        .update({ [updateField]: currentCount + 1 })
        .eq('id', routineId);
    } else if (updateError) {
      console.error('[ROUTINES] Failed to update feedback:', updateError);
      return NextResponse.json(
        { error: 'Failed to record feedback' },
        { status: 500 }
      );
    }

    console.log('[ROUTINES] Recorded', outcome, 'for routine:', routine.name);

    // Calculate new confidence
    const newSuccessCount = isSuccess ? (routine.success_count || 0) + 1 : routine.success_count || 0;
    const newFailureCount = !isSuccess ? (routine.failure_count || 0) + 1 : routine.failure_count || 0;
    const total = newSuccessCount + newFailureCount;
    const confidence = total < 3 ? 0.5 : (newSuccessCount + 1) / (total + 2);

    return NextResponse.json({
      ok: true,
      routine: {
        id: routine.id,
        name: routine.name,
        success_count: newSuccessCount,
        failure_count: newFailureCount,
        confidence: Math.round(confidence * 100),
      },
    });
  } catch (error) {
    console.error('[ROUTINES] Feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to record feedback', details: error.message },
      { status: 500 }
    );
  }
}
