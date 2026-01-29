import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getPermissions, requireMember, requireAdmin } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

// Settings keys that are allowed to be stored
const ALLOWED_KEYS = [
  'openai_api_key',
  'anthropic_api_key',
  'ollama_base_url',
];

/**
 * Mask an API key for display: show first 8 and last 4 chars
 */
function maskKey(key) {
  if (!key || key.length < 16) return key ? '***' : '';
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

/**
 * GET /api/settings — Get org settings (LLM keys masked)
 */
export async function GET() {
  try {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const orgId = cookieStore.get('org_id')?.value;
    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
    }

    const perms = await getPermissions(user.id, orgId);
    const memberErr = requireMember(perms);
    if (memberErr) {
      return NextResponse.json({ error: memberErr.error }, { status: memberErr.status });
    }

    const isAdmin = perms.isAdmin;

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    // Get org settings
    const { data: org } = await supabase
      .from('org')
      .select('name, settings')
      .eq('id', orgId)
      .single();

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const settings = org.settings || {};

    // Return masked keys for display
    const maskedSettings = {
      openai_api_key: maskKey(settings.openai_api_key),
      anthropic_api_key: maskKey(settings.anthropic_api_key),
      ollama_base_url: settings.ollama_base_url || '',
      // Booleans indicating if keys are set
      has_openai_key: !!settings.openai_api_key,
      has_anthropic_key: !!settings.anthropic_api_key,
    };

    return NextResponse.json({
      ok: true,
      org_name: org.name,
      settings: maskedSettings,
      can_edit: isAdmin,
      role: perms.role,
    });
  } catch (error) {
    console.error('[SETTINGS] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get settings', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings — Update org settings
 * Body: { settings: { openai_api_key?, anthropic_api_key?, ollama_base_url? }, org_name? }
 */
export async function POST(request) {
  try {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const orgId = cookieStore.get('org_id')?.value;
    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
    }

    const perms = await getPermissions(user.id, orgId);
    const adminErr = requireAdmin(perms);
    if (adminErr) {
      return NextResponse.json({ error: adminErr.error }, { status: adminErr.status });
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    const body = await request.json();

    // Get current settings
    const { data: org } = await supabase
      .from('org')
      .select('settings')
      .eq('id', orgId)
      .single();

    const currentSettings = org?.settings || {};
    const updates = {};

    // Update org name if provided
    if (body.org_name !== undefined) {
      updates.name = body.org_name.trim();
    }

    // Merge settings — only update provided keys, preserve others
    if (body.settings) {
      const newSettings = { ...currentSettings };

      for (const key of ALLOWED_KEYS) {
        if (body.settings[key] !== undefined) {
          const value = body.settings[key];
          if (value === '' || value === null) {
            delete newSettings[key];
          } else {
            newSettings[key] = value;
          }
        }
      }

      updates.settings = newSettings;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { error } = await supabase
      .from('org')
      .update(updates)
      .eq('id', orgId);

    if (error) throw error;

    return NextResponse.json({ ok: true, message: 'Settings updated' });
  } catch (error) {
    console.error('[SETTINGS] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', details: error.message },
      { status: 500 }
    );
  }
}
