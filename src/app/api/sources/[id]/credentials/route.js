import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * Mask a credential value: show first 4 and last 4 chars
 */
function maskCredential(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * Build masked preview based on auth type
 */
function buildMaskedPreview(credentials, authType) {
  if (!credentials) return null;
  const c = credentials;
  switch (authType) {
    case 'bearer':
      return maskCredential(c.token);
    case 'api_key':
      return maskCredential(c.api_key);
    case 'basic':
      return c.username ? `${c.username}:****` : null;
    case 'header':
      return c.header_name ? `${c.header_name}: ${maskCredential(c.header_value)}` : null;
    default:
      return null;
  }
}

/**
 * GET /api/sources/[id]/credentials - List all credentials for this source
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

    // Get all credentials for this user+source
    const { data: allCreds } = await supabase
      .from('user_api_credentials')
      .select('id, label, credentials, is_active, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('source_id', id)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: true });

    // Build response with masked previews
    const credentials = (allCreds || []).map(cred => ({
      id: cred.id,
      label: cred.label,
      masked_preview: buildMaskedPreview(cred.credentials, source.auth_type),
      is_active: cred.is_active,
      updated_at: cred.updated_at,
    }));

    const activeCred = credentials.find(c => c.is_active);

    return NextResponse.json({
      ok: true,
      source_id: id,
      auth_type: source.auth_type,
      credentials,
      active_credential_id: activeCred?.id || null,
      has_credentials: credentials.length > 0,
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
 * POST /api/sources/[id]/credentials - Add or update a credential
 * Body: { label: "Production", token?: "xxx", api_key?: "xxx", ... }
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
    const label = (body.label || 'Default').trim();

    if (!label) {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 });
    }

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
        break;
      default:
        return NextResponse.json({ error: `Unknown auth_type: ${source.auth_type}` }, { status: 400 });
    }

    // Deactivate all other credentials for this user+source
    await supabase
      .from('user_api_credentials')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('source_id', id);

    // Upsert the new/updated credential (active by default)
    const { data: newCred, error } = await supabase
      .from('user_api_credentials')
      .upsert({
        user_id: user.id,
        source_id: id,
        label,
        credentials,
        is_active: true,
      }, {
        onConflict: 'user_id,source_id,label',
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      credential_id: newCred.id,
      label,
    });
  } catch (error) {
    console.error('[CREDENTIALS] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to save credentials', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sources/[id]/credentials - Set active credential
 * Body: { credential_id: "uuid" }
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
    const { credential_id } = body;

    if (!credential_id) {
      return NextResponse.json({ error: 'credential_id is required' }, { status: 400 });
    }

    // Verify this credential belongs to the user
    const { data: cred } = await supabase
      .from('user_api_credentials')
      .select('id')
      .eq('id', credential_id)
      .eq('user_id', user.id)
      .eq('source_id', id)
      .single();

    if (!cred) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    // Deactivate all, then activate the selected one
    await supabase
      .from('user_api_credentials')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('source_id', id);

    await supabase
      .from('user_api_credentials')
      .update({ is_active: true })
      .eq('id', credential_id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[CREDENTIALS] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to update credential', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sources/[id]/credentials - Remove a credential
 * Query: ?credential_id=uuid (optional, deletes specific one)
 * Without credential_id, deletes all for this source
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const credentialId = url.searchParams.get('credential_id');

    if (credentialId) {
      // Delete specific credential
      const { error } = await supabase
        .from('user_api_credentials')
        .delete()
        .eq('id', credentialId)
        .eq('user_id', user.id)
        .eq('source_id', id);

      if (error) throw error;

      // If we deleted the active one, activate the first remaining
      const { data: remaining } = await supabase
        .from('user_api_credentials')
        .select('id')
        .eq('user_id', user.id)
        .eq('source_id', id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (remaining?.length > 0) {
        await supabase
          .from('user_api_credentials')
          .update({ is_active: true })
          .eq('id', remaining[0].id);
      }
    } else {
      // Delete all credentials for this source
      const { error } = await supabase
        .from('user_api_credentials')
        .delete()
        .eq('user_id', user.id)
        .eq('source_id', id);

      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[CREDENTIALS] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete credentials', details: error.message },
      { status: 500 }
    );
  }
}
