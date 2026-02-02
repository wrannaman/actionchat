/**
 * POST /api/chat — Streaming chat endpoint.
 *
 * Clean architecture:
 * - Auth handled by @/lib/chat/auth
 * - Tools handled by @/lib/chat/tools
 * - Prompts handled by @/lib/chat/prompts
 * - Persistence handled by @/lib/chat/persistence
 * - AI abstraction in @/lib/ai
 */

import { createClient } from '@/utils/supabase/server';
import { getModelForAgent, chat, toStreamResponse } from '@/lib/ai';
import {
  authenticate,
  AuthError,
  loadAgentTools,
  createChat,
  saveConversation,
  buildSystemPrompt,
  getFirstUserMessageText,
} from '@/lib/chat';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const supabase = await createClient();

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. PARSE REQUEST
    // ─────────────────────────────────────────────────────────────────────────
    const body = await request.json();
    const { messages, agentId, chatId: existingChatId } = body;

    if (!agentId) {
      return jsonError('agentId is required', 400);
    }

    if (!messages?.length) {
      return jsonError('messages array is required', 400);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. AUTHENTICATE
    // ─────────────────────────────────────────────────────────────────────────
    const { user, orgId } = await authenticate(request, supabase, agentId);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. LOAD AGENT
    // ─────────────────────────────────────────────────────────────────────────
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('org_id', orgId)
      .eq('is_active', true)
      .single();

    if (!agent) {
      return jsonError('Agent not found or inactive', 404);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. LOAD ORG SETTINGS
    // ─────────────────────────────────────────────────────────────────────────
    const { data: org } = await supabase
      .from('org')
      .select('settings')
      .eq('id', orgId)
      .single();

    const orgSettings = org?.settings || {};

    // ─────────────────────────────────────────────────────────────────────────
    // 5. GET AI MODEL
    // ─────────────────────────────────────────────────────────────────────────
    let model;
    try {
      model = getModelForAgent(agent, orgSettings);
    } catch (err) {
      return jsonError(err.message, 400);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. LOAD TOOLS
    // ─────────────────────────────────────────────────────────────────────────
    const { tools, toolRows, sourceIds, sourcesWithHints } = await loadAgentTools(
      supabase,
      agentId,
      user.id
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 7. CREATE OR REUSE CHAT
    // ─────────────────────────────────────────────────────────────────────────
    let chatId = existingChatId;

    if (!chatId) {
      chatId = await createChat(supabase, {
        orgId,
        agentId,
        userId: user.id,
        title: getFirstUserMessageText(messages),
        sourceIds,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. STREAM RESPONSE
    // ─────────────────────────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(agent, toolRows, sourcesWithHints, tools);

    console.log('[CHAT]', agent.model_provider, agent.model_name, '|', Object.keys(tools).length, 'tools');

    const result = await chat({
      model,
      modelId: agent.model_name,
      system: systemPrompt,
      messages,
      tools,
      temperature: agent.temperature ?? 0.1,
      // Langfuse tracing metadata (if LANGFUSE_* env vars are set)
      telemetryMetadata: {
        agentId,
        agentName: agent.name,
        userId: user.id,
        chatId,
        orgId,
        model: agent.model_name,
        provider: agent.model_provider,
      },
      onFinish: async (event) => {
        console.log('[CHAT onFinish] ════════════════════════════════');
        console.log('[CHAT onFinish] text:', JSON.stringify(event.text)?.slice(0, 500));
        console.log('[CHAT onFinish] text length:', event.text?.length);
        console.log('[CHAT onFinish] steps:', event.steps?.length);
        console.log('[CHAT onFinish] finishReason:', event.finishReason);
        console.log('[CHAT onFinish] event keys:', Object.keys(event));
        console.log('[CHAT onFinish] ════════════════════════════════');

        await saveConversation(supabase, {
          chatId,
          orgId,
          agentId,
          userId: user.id,
          messages,
          text: event.text,
          steps: event.steps,
          usage: event.usage,
          agent,
        });
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 9. RETURN STREAMING RESPONSE
    // ─────────────────────────────────────────────────────────────────────────
    return toStreamResponse(result, {
      messages,
      headers: { 'X-Chat-Id': chatId || '' },
    });

  } catch (error) {
    console.error('[CHAT] Error:', error);

    if (error instanceof AuthError) {
      return jsonError(error.message, error.status);
    }

    return jsonError(error.message || 'Chat failed', 500);
  }
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
