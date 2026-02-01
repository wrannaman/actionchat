/**
 * POST /api/embed/chat — Public streaming chat for embed widgets.
 *
 * - Authenticates via embed token (not user session)
 * - Only exposes safe (read-only) tools
 * - Adds CORS headers for cross-origin embedding
 */

import { createClient } from '@/utils/supabase/server';
import { getModelForAgent, chat, toStreamResponse } from '@/lib/ai';
import { loadAgentTools } from '@/lib/chat';
import { convertToolsToAISDK } from '@/lib/tools-to-ai-sdk';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const supabase = await createClient();
  const origin = request.headers.get('origin');

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. PARSE & VALIDATE
    // ─────────────────────────────────────────────────────────────────────────
    const { messages, embedToken } = await request.json();

    if (!embedToken) {
      return jsonError('embedToken is required', 400);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. LOAD EMBED CONFIG
    // ─────────────────────────────────────────────────────────────────────────
    const { data: config } = await supabase
      .from('embed_configs')
      .select('id, agent_id, org_id, allowed_origins, settings, is_active')
      .eq('embed_token', embedToken)
      .eq('is_active', true)
      .single();

    if (!config) {
      return jsonError('Widget not found or inactive', 404);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CHECK ORIGIN
    // ─────────────────────────────────────────────────────────────────────────
    if (config.allowed_origins.length > 0 && origin) {
      const allowed = config.allowed_origins.some(
        o => o === '*' || o === origin || origin.endsWith(o.replace('*.', '.'))
      );
      if (!allowed) {
        return jsonError('Origin not allowed', 403);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. LOAD AGENT
    // ─────────────────────────────────────────────────────────────────────────
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', config.agent_id)
      .eq('org_id', config.org_id)
      .eq('is_active', true)
      .single();

    if (!agent) {
      return jsonError('Agent not found or inactive', 404);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. GET MODEL
    // ─────────────────────────────────────────────────────────────────────────
    const { data: org } = await supabase
      .from('org')
      .select('settings')
      .eq('id', config.org_id)
      .single();

    let model;
    try {
      model = getModelForAgent(agent, org?.settings || {});
    } catch (err) {
      return jsonError('LLM not configured', 400);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. LOAD SAFE TOOLS ONLY
    // ─────────────────────────────────────────────────────────────────────────
    const { data: toolRows } = await supabase.rpc('get_agent_tools', {
      agent_uuid: config.agent_id,
    });

    // Filter to safe tools only (no destructive operations from embeds)
    const safeToolRows = (toolRows || []).filter(
      t => t.risk_level === 'safe' && !t.requires_confirmation
    );

    // Load sources for safe tools
    const sourceIds = [...new Set(safeToolRows.map(t => t.source_id))];
    let sourceMap = new Map();

    if (sourceIds.length > 0) {
      const { data: sources } = await supabase
        .from('api_sources')
        .select('id, name, base_url, auth_type, auth_config, source_type, mcp_server_uri, mcp_transport, mcp_env')
        .in('id', sourceIds);

      sourceMap = new Map(sources?.map(s => [s.name, s]) || []);
    }

    const tools = convertToolsToAISDK(safeToolRows, {
      sourceMap,
      userCredentialsMap: new Map(), // No user credentials in embeds
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 7. BUILD SYSTEM PROMPT
    // ─────────────────────────────────────────────────────────────────────────
    const systemPrompt = buildEmbedPrompt(agent, safeToolRows);

    // ─────────────────────────────────────────────────────────────────────────
    // 8. STREAM RESPONSE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[EMBED]', agent.model_provider, agent.model_name, '|', Object.keys(tools).length, 'tools');

    const result = await chat({
      model,
      modelId: agent.model_name,
      system: systemPrompt,
      messages,
      tools,
      temperature: agent.temperature ?? 0.1,
      maxSteps: 3, // Limit steps for embeds
    });

    const response = toStreamResponse(result, { messages });

    // Add CORS headers
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    }

    return response;

  } catch (error) {
    console.error('[EMBED] Error:', error);
    return jsonError(error.message || 'Chat failed', 500);
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function jsonError(message, status) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

function buildEmbedPrompt(agent, toolRows) {
  const parts = [
    `You are "${agent.name}", an AI assistant embedded on an external website.`,
  ];

  if (agent.system_prompt) {
    parts.push('', agent.system_prompt);
  }

  if (toolRows.length > 0) {
    parts.push('', 'You have access to read-only API tools.');
  }

  parts.push('', `## Guidelines
- JUST DO IT: Execute requests immediately with sensible defaults. Don't ask clarifying questions.
- Be concise. This is an embedded widget.
- Summarize results in plain language, not raw JSON.
- Never include internal metadata (response IDs, etc.) in your response.`);

  return parts.join('\n');
}
