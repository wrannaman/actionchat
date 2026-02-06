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
      const attachments = extractAttachments(lastUserMsg);

      if (userText || attachments.length > 0) {
        const { data: userMsgData, error: userMsgError } = await supabase
          .from('messages')
          .insert({
            chat_id: chatId,
            role: 'user',
            content: userText || '',
            metadata: attachments.length > 0 ? { attachments } : {},
          })
          .select('id')
          .single();

        if (userMsgError) {
          console.error('[CHAT] Failed to save user message:', userMsgError);
        }
      }
    }

    // 2. Save assistant message
    const toolCalls = extractToolCalls(steps);

    // Get text from direct text OR from steps (multi-step responses)
    let responseText = text || '';
    if (!responseText && steps?.length) {
      // Extract text from all steps
      const stepTexts = [];
      for (const step of steps) {
        if (step.text) stepTexts.push(step.text);
      }
      responseText = stepTexts.join('\n\n');
    }

    const { data: assistantMsg, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role: 'assistant',
        content: responseText,
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
 * Extract attachments from a UI message.
 * Stores the S3 key so we can generate fresh signed URLs on load.
 */
function extractAttachments(message) {
  const attachments = message.attachments || message.experimental_attachments || [];
  return attachments.map(att => ({
    name: att.name,
    contentType: att.contentType,
    key: att.key, // S3 key - used to generate fresh signed URLs
  })).filter(att => att.key); // Only store if we have a key
}

/**
 * Extract tool calls with results from AI SDK steps.
 *
 * AI SDK step format has changed - now uses step.content array with:
 * - { type: "tool-call", toolCallId, toolName, input }
 * - { type: "tool-result", toolCallId, toolName, output }
 */
function extractToolCalls(steps) {
  const calls = [];

  for (const step of (steps || [])) {
    // Build a map of toolCallId -> result from content array
    const resultMap = new Map();
    const toolCallsInStep = [];

    // Parse from step.content (new AI SDK format)
    for (const item of (step.content || [])) {
      if (item.type === 'tool-result') {
        resultMap.set(item.toolCallId, item.output);
      }
      if (item.type === 'tool-call') {
        toolCallsInStep.push({
          toolCallId: item.toolCallId,
          toolName: item.toolName,
          args: item.input || item.args,
        });
      }
    }

    // Also check legacy format (step.toolCalls / step.toolResults)
    for (const tr of (step.toolResults || [])) {
      resultMap.set(tr.toolCallId, tr.result || tr.output);
    }
    for (const tc of (step.toolCalls || [])) {
      // Only add if not already added from content
      if (!toolCallsInStep.some(t => t.toolCallId === tc.toolCallId)) {
        toolCallsInStep.push({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args || tc.input,
        });
      }
    }

    // Create call records with matched results
    for (const tc of toolCallsInStep) {
      const result = resultMap.get(tc.toolCallId);
      calls.push({
        id: tc.toolCallId,
        tool_name: tc.toolName,
        arguments: tc.args,
        // Include the result for display on reload
        result: result ? sanitizeResult(result) : null,
      });
    }
  }

  return calls;
}

/**
 * Sanitize tool result for storage (remove internal metadata, limit size)
 */
function sanitizeResult(result) {
  if (!result) return null;

  // If it has _actionchat metadata, extract the key fields
  if (result._actionchat) {
    return {
      status: result._actionchat.response_status,
      body: result._actionchat.response_body,
      method: result._actionchat.method,
      url: result._actionchat.url,
      tool_name: result._actionchat.tool_name,
      tool_id: result._actionchat.tool_id,
      source_id: result._actionchat.source_id,
      duration_ms: result._actionchat.duration_ms,
    };
  }

  // For other results, try to limit size
  const str = JSON.stringify(result);
  if (str.length > 50000) {
    return { truncated: true, preview: str.slice(0, 5000) };
  }

  return result;
}

/**
 * Get first user message text for chat title.
 */
export function getFirstUserMessageText(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first) return '';
  return extractText(first);
}
