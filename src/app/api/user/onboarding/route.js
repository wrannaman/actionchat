import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value || null;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    if (!orgId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const body = await request.json();
    const { heard_about, main_problem } = body;

    // Validate required fields
    if (!heard_about || !main_problem) {
      return NextResponse.json(
        { error: 'Both fields are required' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    // Insert onboarding response
    const { data: onboarding, error: insertError } = await serviceClient
      .from('user_onboarding')
      .insert({
        user_id: user.id,
        org_id: orgId,
        heard_about,
        main_problem,
      })
      .select()
      .single();

    if (insertError) {
      // Check if it's a unique constraint violation (user already submitted)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'You have already submitted onboarding' },
          { status: 409 }
        );
      }
      console.error('[ONBOARDING] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save onboarding response' },
        { status: 500 }
      );
    }

    // Check if user is org owner - if so, mark org as onboarded
    const { data: membership } = await serviceClient
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single();

    if (membership?.role === 'owner') {
      const { error: updateError } = await serviceClient
        .from('org')
        .update({ is_onboarded: true })
        .eq('id', orgId);

      if (updateError) {
        console.error('[ONBOARDING] Failed to update org:', updateError);
        // Don't fail the request - onboarding was saved
      }
    }

    return NextResponse.json({
      success: true,
      onboarding: {
        id: onboarding.id,
        created_at: onboarding.created_at,
      }
    });
  } catch (error) {
    console.error('[ONBOARDING] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
