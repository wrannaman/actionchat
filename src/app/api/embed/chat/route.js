import { streamText, convertToModelMessages } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { getModelForAgent } from '@/lib/ai-provider';
import { convertToolsToAISDK } from '@/lib/tools-to-ai-sdk';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/embed/chat — Public streaming chat endpoint for embed widgets.
 * Authenticates via embed token instead of user session.
 * Only allows safe (auto-execute) tools — no dangerous operations from embeds.
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { messages, embedToken } = body;

    if (!embedToken) {
      return new Response(JSON.stringify({ error: 'embedToken is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Load embed config by token
    const { data: config, error: configError } = await supabase
      .from('embed_configs')
      .select('id, agent_id, org_id, allowed_origins, settings, is_active')
      .eq('embed_token', embedToken)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: 'Widget not found or inactive' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Origin check
    const origin = request.headers.get('origin');
    if (config.allowed_origins.length > 0 && origin) {
      const allowed = config.allowed_origins.some(
        (o) => o === '*' || o === origin || origin.endsWith(o.replace('*.', '.'))
      );
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. Load agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', config.agent_id)
      .eq('org_id', config.org_id)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: 'Agent not found or inactive' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Load org settings (LLM API keys)
    const { data: org } = await supabase
      .from('org')
      .select('settings')
      .eq('id', config.org_id)
      .single();

    const orgSettings = org?.settings || {};

    // 5. Get LLM model
    let model;
    try {
      model = getModelForAgent(agent, orgSettings);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'LLM not configured' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Load tools — embed widgets only get safe (read-only) tools
    const { data: toolRows } = await supabase.rpc('get_agent_tools', {
      agent_uuid: config.agent_id,
    });

    // Filter to safe tools only for embed
    const safeTools = (toolRows || []).filter(
      t => t.risk_level === 'safe' && !t.requires_confirmation
    );

    // 7. Load source auth configs
    const sourceNames = [...new Set(safeTools.map(t => t.source_name))];
    let sourceMap = new Map();

    if (sourceNames.length > 0) {
      const { data: agentSourceLinks } = await supabase
        .from('agent_sources')
        .select('source_id, permission')
        .eq('agent_id', config.agent_id);

      if (agentSourceLinks?.length > 0) {
        const sourceIds = agentSourceLinks.map(l => l.source_id);
        const { data: sources } = await supabase
          .from('api_sources')
          .select('id, name, base_url, auth_type, auth_config')
          .in('id', sourceIds);

        if (sources) {
          for (const source of sources) {
            sourceMap.set(source.name, source);
          }
        }
      }
    }

    // 8. Convert safe tools to AI SDK format
    const aiTools = convertToolsToAISDK(safeTools, {
      sourceMap,
      userAuthToken: null, // No user auth in embeds
    });

    // 9. Build system prompt
    const systemParts = [
      `You are "${agent.name}", an AI assistant embedded on an external website.`,
    ];
    if (agent.system_prompt) {
      systemParts.push(agent.system_prompt);
    }
    if (safeTools.length > 0) {
      systemParts.push('\nYou have access to read-only API tools. You cannot perform destructive actions from this widget.');
    }
    systemParts.push('\nBe concise and helpful. This is an embedded widget — keep responses short.');

    // 10. Stream response
    const hasTools = Object.keys(aiTools).length > 0;

    const result = streamText({
      model,
      system: systemParts.join('\n'),
      messages: convertToModelMessages(messages),
      tools: hasTools ? aiTools : undefined,
      maxSteps: hasTools ? 3 : 1,
      temperature: agent.temperature ?? 0.1,
    });

    const response = result.toUIMessageStreamResponse();

    // Add CORS headers
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    }

    return response;
  } catch (error) {
    console.error('[EMBED CHAT] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Chat failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * OPTIONS /api/embed/chat — CORS preflight
 */
export async function OPTIONS(request) {
  const origin = request.headers.get('origin');
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
