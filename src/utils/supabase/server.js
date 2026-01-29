import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE;

export const createClient = async () => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  const cookieStore = await cookies();
  
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Ignore - called from Server Component
        }
      },
    },
  });
};

export const createServiceClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role key');
  }
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
};

export async function getUserOrgId(supabase, cookieOrgId = null) {
  // Get current user for membership verification
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // If we have a cookie org_id, verify user is actually a member of that org
  if (cookieOrgId) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('org_id', cookieOrgId)
      .eq('user_id', user.id)
      .single();

    if (membership) {
      return cookieOrgId;
    }
    // If not a member, fall through to default org
  }

  // Use RPC to get user's first org (fallback)
  const { data: orgId, error } = await supabase.rpc('get_my_org_id');

  if (error || !orgId) {
    throw new Error('User is not a member of any organization');
  }

  return orgId;
}
