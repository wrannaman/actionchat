import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getPermissions, requireMember, requireAdmin } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

// ============================================================================
// API KEY VALIDATION
// ============================================================================

/**
 * Validate an OpenAI API key by calling their models endpoint
 */
async function validateOpenAIKey(apiKey) {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (res.status === 401) return { valid: false, error: 'Invalid API key' };
    if (res.status === 403) return { valid: false, error: 'API key lacks permissions' };
    if (!res.ok) return { valid: false, error: `API error: ${res.status}` };
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Connection failed: ${err.message}` };
  }
}

/**
 * Validate an Anthropic API key by calling their models endpoint
 */
async function validateAnthropicKey(apiKey) {
  try {
    // Anthropic doesn't have a /models endpoint, so we use a minimal messages call
    // that will fail fast if the key is invalid
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    // 401 = invalid key, 400 = valid key (might be other error but key works)
    if (res.status === 401) return { valid: false, error: 'Invalid API key' };
    if (res.status === 403) return { valid: false, error: 'API key lacks permissions' };
    // Any other response means the key is valid (even if the request itself fails)
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Connection failed: ${err.message}` };
  }
}

/**
 * Validate a Google AI API key
 */
async function validateGoogleKey(apiKey) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );
    if (res.status === 400 || res.status === 403) {
      return { valid: false, error: 'Invalid API key' };
    }
    if (!res.ok) return { valid: false, error: `API error: ${res.status}` };
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Connection failed: ${err.message}` };
  }
}

/**
 * Validate an Ollama connection
 */
async function validateOllamaUrl(baseUrl) {
  try {
    const url = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${url}/api/tags`, { method: 'GET' });
    if (!res.ok) return { valid: false, error: `Ollama not responding: ${res.status}` };
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Cannot connect to Ollama: ${err.message}` };
  }
}

// ============================================================================
// SETTINGS CONFIG
// ============================================================================

// Settings keys that are allowed to be stored
const ALLOWED_KEYS = [
  'openai_api_key',
  'anthropic_api_key',
  'google_generative_ai_api_key',
  'ollama_base_url',
  'default_provider',
  'default_model',
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
      google_generative_ai_api_key: maskKey(settings.google_generative_ai_api_key),
      ollama_base_url: settings.ollama_base_url || '',
      has_openai_key: !!settings.openai_api_key,
      has_anthropic_key: !!settings.anthropic_api_key,
      has_google_key: !!settings.google_generative_ai_api_key,
      default_provider: settings.default_provider || '',
      default_model: settings.default_model || '',
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

      // Validate API keys before saving
      if (body.settings.openai_api_key) {
        const result = await validateOpenAIKey(body.settings.openai_api_key);
        if (!result.valid) {
          return NextResponse.json(
            { error: `OpenAI key validation failed: ${result.error}` },
            { status: 400 }
          );
        }
      }

      if (body.settings.anthropic_api_key) {
        const result = await validateAnthropicKey(body.settings.anthropic_api_key);
        if (!result.valid) {
          return NextResponse.json(
            { error: `Anthropic key validation failed: ${result.error}` },
            { status: 400 }
          );
        }
      }

      if (body.settings.google_generative_ai_api_key) {
        const result = await validateGoogleKey(body.settings.google_generative_ai_api_key);
        if (!result.valid) {
          return NextResponse.json(
            { error: `Google AI key validation failed: ${result.error}` },
            { status: 400 }
          );
        }
      }

      if (body.settings.ollama_base_url) {
        const result = await validateOllamaUrl(body.settings.ollama_base_url);
        if (!result.valid) {
          return NextResponse.json(
            { error: `Ollama validation failed: ${result.error}` },
            { status: 400 }
          );
        }
      }

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
