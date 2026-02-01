/**
 * Chat persistence module.
 *
 * Handles saving chats, messages, and action logs.
 */

/**
 * Create a new chat session.
 *
 * @param {object} supabase - Supabase client
 * @param {object} options
 * @returns {Promise<string|null>} Chat ID or null on error
 */
export async function createChat(supabase, { orgId, agentId, userId, title, sourceIds }) {
  const { data, error } = await supabase
    .from('chats')
    .insert({
      org_id: orgId,
      agent_id: agentId,
      user_id: userId,
      title: (title || 'New chat').slice(0, 100),
      source_ids: sourceIds || [],
    })
    .select('id')
    .single();

  if (error) {
    console.error('[CHAT] Failed to create chat:', error);
    return null;
  }

  return data.id;
}

/**
 * Save messages and action log after chat completes.
 *
 * @param {object} supabase - Supabase client
 * @param {object} options
 */
export async function saveConversation(supabase, {
  chatId,
  orgId,
  agentId,
  userId,
  messages,  // Original UI messages
  text,      // Assistant response text
  steps,     // AI SDK steps (tool calls/results)
  usage,     // Token usage
  agent,     // Agent config
}) {
  if (!chatId) return;

  try {
    // 1. Save user message
    const lastUserMsg = messages.findLast(m => m.role === 'user');
    if (lastUserMsg) {
      const userText = extractText(lastUserMsg);
      if (userText) {
        await supabase.from('messages').insert({
          chat_id: chatId,
          role: 'user',
          content: userText,
        });
      }
    }

    // 2. Save assistant message
    const toolCalls = extractToolCalls(steps);

    const { data: assistantMsg, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role: 'assistant',
        content: text || '',
        tool_calls: toolCalls.length ? toolCalls : null,
        metadata: {
          usage,
          model: agent.model_name,
          provider: agent.model_provider,
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('[CHAT] Failed to save assistant message:', error);
      return;
    }

    // 3. Log tool executions to action_log
    await logToolExecutions(supabase, {
      steps,
      orgId,
      agentId,
      chatId,
      messageId: assistantMsg?.id,
      userId,
    });

  } catch (err) {
    console.error('[CHAT] Failed to persist conversation:', err);
  }
}

/**
 * Extract text from a UI message.
 */
function extractText(message) {
  // Try parts array first (UI message format)
  if (message.parts?.length) {
    const textPart = message.parts.find(p => p.type === 'text');
    if (textPart?.text) return textPart.text;
  }
  // Fall back to content string
  if (typeof message.content === 'string') {
    return message.content;
  }
  return '';
}

/**
 * Extract tool calls from AI SDK steps.
 */
function extractToolCalls(steps) {
  const calls = [];
  for (const step of (steps || [])) {
    for (const tc of (step.toolCalls || [])) {
      calls.push({
        tool_name: tc.toolName,
        arguments: tc.args,
      });
    }
  }
  return calls;
}

/**
 * Log tool executions to action_log for audit trail.
 */
async function logToolExecutions(supabase, {
  steps,
  orgId,
  agentId,
  chatId,
  messageId,
  userId,
}) {
  for (const step of (steps || [])) {
    for (const tr of (step.toolResults || [])) {
      const meta = tr.result?._actionchat;
      if (!meta) continue;

      const isError = !!meta.error_message && meta.response_status === 0;
      const now = new Date().toISOString();

      await supabase.from('action_log').insert({
        org_id: orgId,
        agent_id: agentId,
        chat_id: chatId,
        message_id: messageId,
        user_id: userId,
        tool_id: meta.tool_id,
        tool_name: meta.tool_name,
        method: meta.method,
        url: meta.url,
        request_body: meta.request_body,
        response_status: meta.response_status || null,
        response_body: meta.response_body,
        duration_ms: meta.duration_ms,
        status: isError ? 'failed' : 'completed',
        requires_confirmation: false,
        error_message: meta.error_message,
        confirmed_by: userId,
        confirmed_at: now,
        executed_at: now,
        completed_at: now,
      });
    }
  }
}

/**
 * Get first user message text for chat title.
 */
export function getFirstUserMessageText(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first) return '';
  return extractText(first);
}
