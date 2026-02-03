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
import { getModelForAgent, chat, toStreamResponse, isAbortError } from '@/lib/ai';
import {
  authenticate,
  AuthError,
  loadAgentTools,
  createChat,
  saveConversation,
  buildSystemPrompt,
  getFirstUserMessageText,
} from '@/lib/chat';

/**
 * Clean messages to remove incomplete tool calls.
 * This prevents AI_MissingToolResultsError when user cancels mid-tool-call.
 */
function cleanMessages(messages) {
  if (!messages?.length) return messages;

  // Collect all tool call IDs and result IDs
  const toolCallIds = new Set();
  const toolResultIds = new Set();

  for (const msg of messages) {
    // Check parts for tool calls and results
    if (msg.parts) {
      for (const part of msg.parts) {
        if (part.type === 'tool-invocation' || part.type === 'tool-call') {
          if (part.toolCallId) toolCallIds.add(part.toolCallId);
        }
        if (part.type === 'tool-result') {
          if (part.toolCallId) toolResultIds.add(part.toolCallId);
        }
      }
    }
    // Also check toolInvocations (useChat format)
    if (msg.toolInvocations) {
      for (const inv of msg.toolInvocations) {
        if (inv.toolCallId) {
          toolCallIds.add(inv.toolCallId);
          if (inv.state === 'result') {
            toolResultIds.add(inv.toolCallId);
          }
        }
      }
    }
  }

  // Find orphaned tool calls (calls without results)
  const orphanedIds = new Set([...toolCallIds].filter(id => !toolResultIds.has(id)));

  if (orphanedIds.size === 0) return messages;

  console.log('[CHAT] Cleaning', orphanedIds.size, 'orphaned tool calls:', [...orphanedIds]);

  // Filter out messages/parts with orphaned tool calls
  return messages.map(msg => {
    if (!msg.parts) return msg;

    const cleanedParts = msg.parts.filter(part => {
      if (part.type === 'tool-invocation' || part.type === 'tool-call') {
        return !orphanedIds.has(part.toolCallId);
      }
      return true;
    });

    // Also clean toolInvocations
    const cleanedInvocations = msg.toolInvocations?.filter(inv => {
      return !orphanedIds.has(inv.toolCallId);
    });

    return {
      ...msg,
      parts: cleanedParts,
      toolInvocations: cleanedInvocations,
    };
  }).filter(msg => {
    // Remove assistant messages that are now empty
    if (msg.role === 'assistant') {
      const hasContent = msg.content ||
        (msg.parts && msg.parts.some(p => p.type === 'text' && p.text));
      const hasTools = msg.parts && msg.parts.some(p =>
        p.type === 'tool-invocation' || p.type === 'tool-call' || p.type === 'tool-result'
      );
      return hasContent || hasTools;
    }
    return true;
  });
}

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const supabase = await createClient();

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. PARSE REQUEST
    // ─────────────────────────────────────────────────────────────────────────
    const body = await request.json();
    const { messages, agentId, chatId: existingChatId, enabledSourceIds } = body;

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
    // 6. LOAD TOOLS (optionally filtered by enabled sources)
    // ─────────────────────────────────────────────────────────────────────────
    const { tools, toolRows, sourceIds, sourcesWithHints } = await loadAgentTools(
      supabase,
      agentId,
      user.id,
      { enabledSourceIds }
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
    // 8. CLEAN MESSAGES & STREAM RESPONSE
    // ─────────────────────────────────────────────────────────────────────────
    // Clean messages to remove any incomplete tool calls (from cancelled requests)
    const cleanedMessages = cleanMessages(messages);

    const systemPrompt = buildSystemPrompt(agent, toolRows, sourcesWithHints, tools);

    console.log('[CHAT]', agent.model_provider, agent.model_name, '|', Object.keys(tools).length, 'tools');

    const result = await chat({
      model,
      modelId: agent.model_name,
      system: systemPrompt,
      messages: cleanedMessages,
      tools,
      temperature: agent.temperature ?? 0.1,
      // Pass request signal for cancellation support
      // When client disconnects or aborts, this signal fires and stops the LLM call
      abortSignal: request.signal,
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
          messages: cleanedMessages,
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
    // Handle user-initiated cancellation gracefully
    if (isAbortError(error)) {
      console.log('[CHAT] Request cancelled by client');
      // Return empty response - client already moved on
      return new Response(null, { status: 499 }); // 499 = Client Closed Request
    }

    // Handle missing tool results - happens when user cancels mid-tool-call
    // or sends a new message while a tool is pending approval
    if (error.name === 'AI_MissingToolResultsError') {
      console.log('[CHAT] Missing tool results - likely cancelled or incomplete tool call');
      return jsonError(
        'Previous action was cancelled or incomplete. Please try your request again.',
        400
      );
    }

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
