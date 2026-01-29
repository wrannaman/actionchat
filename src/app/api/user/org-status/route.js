import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value || null;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    // Get org onboarding status
    const { data: org } = await serviceClient
      .from('org')
      .select('is_onboarded')
      .eq('id', orgId)
      .single();

    // Get user onboarding (if they've filled the form)
    const { data: userOnboarding } = await serviceClient
      .from('user_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const isOnboarded = org?.is_onboarded === true;
    const hasCompletedForm = !!userOnboarding;

    return NextResponse.json({ 
      org_id: orgId,
      can_access: isOnboarded,
      show_onboarding_form: !isOnboarded && !hasCompletedForm,
      show_waiting_message: !isOnboarded && hasCompletedForm,
    });
  } catch (error) {
    console.error('[ORG-STATUS] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
