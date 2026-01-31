import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sources/[id]/credentials - Check if user has credentials for this source
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this source
    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const { data: source } = await supabase
      .from('api_sources')
      .select('id, name, auth_type')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Check if user has credentials
    const { data: creds } = await supabase
      .from('user_api_credentials')
      .select('id, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('source_id', id)
      .single();

    return NextResponse.json({
      ok: true,
      source_id: id,
      auth_type: source.auth_type,
      has_credentials: !!creds,
      credentials_updated_at: creds?.updated_at || null,
    });
  } catch (error) {
    console.error('[CREDENTIALS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get credentials', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sources/[id]/credentials - Save user credentials for this source
 *
 * Body depends on auth_type:
 *   bearer: { token: "xxx" }
 *   api_key: { api_key: "xxx", header_name?: "X-API-Key" }
 *   basic: { username: "xxx", password: "xxx" }
 *   header: { header_name: "X-Custom", header_value: "xxx" }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this source
    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const { data: source } = await supabase
      .from('api_sources')
      .select('id, auth_type')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate credentials based on auth_type
    const credentials = {};
    switch (source.auth_type) {
      case 'bearer':
        if (!body.token) {
          return NextResponse.json({ error: 'token is required for bearer auth' }, { status: 400 });
        }
        credentials.token = body.token;
        break;
      case 'api_key':
        if (!body.api_key) {
          return NextResponse.json({ error: 'api_key is required' }, { status: 400 });
        }
        credentials.api_key = body.api_key;
        credentials.header_name = body.header_name || 'X-API-Key';
        break;
      case 'basic':
        if (!body.username || !body.password) {
          return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
        }
        credentials.username = body.username;
        credentials.password = body.password;
        break;
      case 'header':
        if (!body.header_name || !body.header_value) {
          return NextResponse.json({ error: 'header_name and header_value are required' }, { status: 400 });
        }
        credentials.header_name = body.header_name;
        credentials.header_value = body.header_value;
        break;
      case 'none':
      case 'passthrough':
        // No credentials needed
        break;
      default:
        return NextResponse.json({ error: `Unknown auth_type: ${source.auth_type}` }, { status: 400 });
    }

    // Upsert credentials
    const { error } = await supabase
      .from('user_api_credentials')
      .upsert({
        user_id: user.id,
        source_id: id,
        credentials,
      }, {
        onConflict: 'user_id,source_id',
      });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[CREDENTIALS] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to save credentials', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sources/[id]/credentials - Remove user credentials for this source
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
      .from('user_api_credentials')
      .delete()
      .eq('user_id', user.id)
      .eq('source_id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[CREDENTIALS] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete credentials', details: error.message },
      { status: 500 }
    );
  }
}
