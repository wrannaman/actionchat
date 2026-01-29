import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/embed/[token] — Public endpoint to load embed config by token
 * No auth required — security via allowed_origins check + embed_token.
 */
export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const supabase = await createClient();

    // Query embed config only — no join to agents (agents table has no anon RLS policy)
    const { data: config, error } = await supabase
      .from('embed_configs')
      .select('id, agent_id, name, allowed_origins, theme, settings, is_active')
      .eq('embed_token', token)
      .eq('is_active', true)
      .single();

    if (error || !config) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    // Check origin if allowed_origins is set
    const origin = request.headers.get('origin');
    if (config.allowed_origins.length > 0 && origin) {
      const allowed = config.allowed_origins.some(
        (o) => o === '*' || o === origin || origin.endsWith(o.replace('*.', '.'))
      );
      if (!allowed) {
        return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
      }
    }

    // Return public config (no sensitive data, no agent details — those come via authenticated chat)
    return NextResponse.json({
      ok: true,
      widget: {
        agent_id: config.agent_id,
        name: config.name,
        theme: config.theme,
        settings: config.settings,
      },
    }, {
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('[EMBED] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to load widget config' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/embed/[token] — CORS preflight
 */
export async function OPTIONS(request) {
  const origin = request.headers.get('origin');
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
