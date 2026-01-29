import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { getPermissions, requireAdmin } from '@/utils/permissions';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/api-keys — List API keys for the org
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

    const perms = await getPermissions(user.id, orgId);
    const adminErr = requireAdmin(perms);
    if (adminErr) return NextResponse.json({ error: adminErr.error }, { status: adminErr.status });

    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, agent_ids, is_active, expires_at, last_used_at, created_by, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, keys });
  } catch (error) {
    console.error('[API KEYS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to list API keys', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/api-keys — Create a new API key
 * Body: { name, agent_ids?, expires_at? }
 * Returns the raw key ONCE — it's never stored or retrievable again.
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

    const perms = await getPermissions(user.id, orgId);
    const adminErr = requireAdmin(perms);
    if (adminErr) return NextResponse.json({ error: adminErr.error }, { status: adminErr.status });

    const body = await request.json();
    const { name, agent_ids, expires_at } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Generate a secure random key: ac_<32 random hex chars>
    const rawBytes = crypto.randomBytes(32);
    const rawKey = `ac_${rawBytes.toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 10) + '...';
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const keyData = {
      org_id: orgId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      agent_ids: agent_ids || null,
      is_active: true,
      expires_at: expires_at || null,
      created_by: user.id,
    };

    const { data: apiKey, error } = await supabase
      .from('api_keys')
      .insert(keyData)
      .select('id, name, key_prefix, agent_ids, is_active, expires_at, created_at')
      .single();

    if (error) throw error;

    // Return the raw key — this is the only time it's visible
    return NextResponse.json({
      ok: true,
      key: apiKey,
      raw_key: rawKey,
      warning: 'Save this key now. It cannot be retrieved again.',
    }, { status: 201 });
  } catch (error) {
    console.error('[API KEYS] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create API key', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/api-keys — Revoke an API key
 * Body: { key_id }
 */
export async function DELETE(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const perms = await getPermissions(user.id, orgId);
    const adminErr = requireAdmin(perms);
    if (adminErr) return NextResponse.json({ error: adminErr.error }, { status: adminErr.status });

    const body = await request.json();
    const { key_id } = body;

    if (!key_id) {
      return NextResponse.json({ error: 'key_id is required' }, { status: 400 });
    }

    // Soft-revoke: set is_active = false (keep for audit trail)
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', key_id)
      .eq('org_id', orgId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API KEYS] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key', details: error.message },
      { status: 500 }
    );
  }
}
