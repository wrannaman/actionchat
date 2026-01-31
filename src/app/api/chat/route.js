import { streamText } from 'ai';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { getModelForAgent } from '@/lib/ai-provider';
import { convertToolsToAISDK } from '@/lib/tools-to-ai-sdk';
import { tryApiKeyAuth } from '@/utils/api-key-auth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat — Streaming chat endpoint for agent conversations.
 *
 * Auth: Session-based (browser) OR API key (programmatic).
 * API key format: Authorization: Bearer ac_xxx or X-API-Key: ac_xxx
 */
export async function POST(request) {
  try {
    const supabase = await createClient();

    // Parse body first to get agentId for API key scope check
    const body = await request.json();
    const { messages, agentId, chatId: existingChatId } = body;

    if (!agentId) {
      return new Response(JSON.stringify({ error: 'agentId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Convert UI messages to CoreMessage format for streamText
    // UIMessage uses 'parts' array, CoreMessage uses 'content' string or array
    const normalizedMessages = messages
      .filter(m => m && m.role)
      .map(msg => {
        // If message already has content as string, use it
        if (typeof msg.content === 'string') {
          return { role: msg.role, content: msg.content };
        }

        // If message has parts array (UIMessage format), convert to content
        if (msg.parts && Array.isArray(msg.parts)) {
          // Extract text parts and tool parts
          const textParts = msg.parts.filter(p => p.type === 'text');
          const toolCallParts = msg.parts.filter(p => p.type === 'tool-call');
          const toolResultParts = msg.parts.filter(p => p.type === 'tool-result');

          // For user messages, just extract text
          if (msg.role === 'user') {
            const text = textParts.map(p => p.text).join('\n');
            return { role: 'user', content: text };
          }

          // For assistant messages with tool calls, use the AI SDK format
          if (msg.role === 'assistant') {
            if (toolCallParts.length > 0) {
              // Build content array with text and tool-call parts
              const content = [];
              if (textParts.length > 0) {
                content.push({ type: 'text', text: textParts.map(p => p.text).join('\n') });
              }
              for (const tc of toolCallParts) {
                content.push({
                  type: 'tool-call',
                  toolCallId: tc.toolCallId,
                  toolName: tc.toolName,
                  args: tc.args,
                });
              }
              return { role: 'assistant', content };
            }
            // Plain text assistant message
            const text = textParts.map(p => p.text).join('\n');
            return { role: 'assistant', content: text };
          }

          // For tool results
          if (msg.role === 'tool' || toolResultParts.length > 0) {
            const toolResults = toolResultParts.map(tr => ({
              type: 'tool-result',
              toolCallId: tr.toolCallId,
              toolName: tr.toolName,
              result: tr.result,
            }));
            return { role: 'tool', content: toolResults };
          }

          // Fallback: extract text
          const text = textParts.map(p => p.text).join('\n');
          return { role: msg.role, content: text || '' };
        }

        // If content is already an array (CoreMessage format), pass through
        if (Array.isArray(msg.content)) {
          return { role: msg.role, content: msg.content };
        }

        // Fallback
        return { role: msg.role, content: msg.content || '' };
      })
      .filter(m => m.content !== undefined && m.content !== null);

    if (normalizedMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[CHAT] Normalized messages:', normalizedMessages.length);
    console.log('[CHAT] Message roles:', normalizedMessages.map(m => m.role).join(', '));

    // 1. Auth — try API key first, then session
    let user = null;
    let orgId = null;
    let isApiKeyAuth = false;

    const apiKeyResult = await tryApiKeyAuth(request, agentId);

    if (apiKeyResult) {
      // API key was provided
      if (!apiKeyResult.valid) {
        return new Response(JSON.stringify({ error: apiKeyResult.error }), {
          status: apiKeyResult.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // API key is valid
      orgId = apiKeyResult.orgId;
      isApiKeyAuth = true;
      // Create a pseudo-user for logging (API key requests)
      user = { id: `apikey:${apiKeyResult.key.id}`, email: `api:${apiKeyResult.key.name}` };
    } else {
      // Session auth
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      if (!sessionUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      user = sessionUser;
      const cookieStore = await cookies();
      const cookieOrgId = cookieStore.get('org_id')?.value;
      orgId = await getUserOrgId(supabase, cookieOrgId);
    }

    // 2. Load agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('org_id', orgId)
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
      .eq('id', orgId)
      .single();

    const orgSettings = org?.settings || {};

    // 5. Get LLM model
    let model;
    try {
      model = getModelForAgent(agent, orgSettings);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Load tools via RPC
    const { data: toolRows } = await supabase.rpc('get_agent_tools', {
      agent_uuid: agentId,
    });

    // 7. Load source configs and user credentials for tool execution
    const sourceNames = [...new Set((toolRows || []).map(t => t.source_name))];
    let sourceMap = new Map();
    let userCredentialsMap = new Map();
    let activeSourceIds = [];

    if (sourceNames.length > 0) {
      // Get agent_sources to find source_ids
      const { data: agentSourceLinks } = await supabase
        .from('agent_sources')
        .select('source_id, permission')
        .eq('agent_id', agentId);

      if (agentSourceLinks?.length > 0) {
        activeSourceIds = agentSourceLinks.map(l => l.source_id);

        // Load sources
        const { data: sources } = await supabase
          .from('api_sources')
          .select('id, name, base_url, auth_type')
          .in('id', activeSourceIds);

        if (sources) {
          for (const source of sources) {
            sourceMap.set(source.name, source);
          }
        }

        // Load user's credentials for these sources
        const { data: userCreds } = await supabase
          .from('user_api_credentials')
          .select('source_id, credentials')
          .eq('user_id', user.id)
          .in('source_id', activeSourceIds);

        if (userCreds) {
          for (const cred of userCreds) {
            userCredentialsMap.set(cred.source_id, cred.credentials);
          }
        }
      }
    }

    // 8. Convert tools to AI SDK format
    const aiTools = convertToolsToAISDK(toolRows || [], {
      sourceMap,
      userCredentialsMap,
      userId: user.id, // For per-user mock data isolation
    });

    // 9. Build system prompt
    const systemPrompt = buildSystemPrompt(agent, toolRows || []);

    // 10. Create or reuse chat session
    let chatId = existingChatId;
    if (!chatId) {
      const firstUserMsg = normalizedMessages.find(m => m.role === 'user');
      const titleContent = typeof firstUserMsg?.content === 'string'
        ? firstUserMsg.content
        : firstUserMsg?.parts?.find(p => p.type === 'text')?.text || '';
      const title = titleContent.slice(0, 100) || 'New chat';

      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          org_id: orgId,
          agent_id: agentId,
          user_id: user.id,
          title,
          source_ids: activeSourceIds,
        })
        .select('id')
        .single();

      if (chatError) {
        console.error('[CHAT] Failed to create chat:', chatError);
      } else {
        chatId = chat.id;
      }
    }

    // 11. Stream LLM response
    const hasTools = Object.keys(aiTools).length > 0;

    const result = streamText({
      model,
      system: systemPrompt,
      messages: normalizedMessages,
      tools: hasTools ? aiTools : undefined,
      maxSteps: hasTools ? 5 : 1,
      temperature: agent.temperature ?? 0.1,
      onFinish: async ({ text, steps, usage }) => {
        if (!chatId) return;

        try {
          // Save the last user message
          const lastUserMsg = normalizedMessages.findLast(m => m.role === 'user');
          if (lastUserMsg) {
            // Extract text content from various formats
            const userText = typeof lastUserMsg.content === 'string'
              ? lastUserMsg.content
              : lastUserMsg.parts?.find(p => p.type === 'text')?.text || '';

            if (userText) {
              const { error: userMsgError } = await supabase.from('messages').insert({
                chat_id: chatId,
                role: 'user',
                content: userText,
              });
              if (userMsgError) {
                console.error('[CHAT] Failed to save user message:', userMsgError);
              }
            }
          }

          // Save assistant message
          const toolCalls = [];
          for (const step of (steps || [])) {
            for (const tc of (step.toolCalls || [])) {
              toolCalls.push({
                tool_name: tc.toolName,
                arguments: tc.args,
              });
            }
          }

          const { data: assistantMsg, error: assistantMsgError } = await supabase
            .from('messages')
            .insert({
              chat_id: chatId,
              role: 'assistant',
              content: text || '',
              tool_calls: toolCalls.length > 0 ? toolCalls : null,
              metadata: {
                usage,
                model: agent.model_name,
                provider: agent.model_provider,
              },
            })
            .select('id')
            .single();

          if (assistantMsgError) {
            console.error('[CHAT] Failed to save assistant message:', assistantMsgError);
          } else {
            console.log('[CHAT] Saved assistant message:', assistantMsg?.id);
          }

          // Log tool executions to action_log
          for (const step of (steps || [])) {
            for (const tr of (step.toolResults || [])) {
              const actionMeta = tr.result?._actionchat;
              if (!actionMeta) continue;

              const isError = !!actionMeta.error_message && actionMeta.response_status === 0;
              await supabase.from('action_log').insert({
                org_id: orgId,
                agent_id: agentId,
                chat_id: chatId,
                message_id: assistantMsg?.id || null,
                user_id: user.id,
                tool_id: actionMeta.tool_id,
                tool_name: actionMeta.tool_name,
                method: actionMeta.method,
                url: actionMeta.url,
                request_body: actionMeta.request_body,
                response_status: actionMeta.response_status || null,
                response_body: actionMeta.response_body,
                duration_ms: actionMeta.duration_ms,
                status: isError ? 'failed' : 'completed',
                requires_confirmation: false,
                error_message: actionMeta.error_message,
                confirmed_by: user.id,
                confirmed_at: new Date().toISOString(),
                executed_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
              });
            }
          }
        } catch (err) {
          console.error('[CHAT] Failed to persist messages:', err);
        }
      },
    });

    // 12. Return streaming response with chatId header
    const response = result.toUIMessageStreamResponse();

    // Add chatId as a custom header so the client can track it
    response.headers.set('X-Chat-Id', chatId || '');

    return response;
  } catch (error) {
    console.error('[CHAT] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Chat failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Build the system prompt from agent config + available tools.
 */
function buildSystemPrompt(agent, toolRows) {
  const parts = [];

  // Agent identity
  parts.push(`You are "${agent.name}", an AI assistant that helps with API operations.`);

  // Custom system prompt
  if (agent.system_prompt) {
    parts.push(agent.system_prompt);
  }

  // Tool documentation
  if (toolRows.length > 0) {
    parts.push('\n## Available API Tools\n');
    parts.push('You have access to the following API endpoints as tools:\n');

    // Group tools by HTTP method for clarity
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    for (const method of methods) {
      const methodTools = toolRows.filter(t => t.method === method);
      if (methodTools.length === 0) continue;

      for (const tool of methodTools) {
        const risk = tool.risk_level === 'dangerous' ? ' [DANGEROUS - requires confirmation]'
          : tool.risk_level === 'moderate' ? ' [MODERATE]'
          : '';
        parts.push(`- **${tool.tool_name}**: ${tool.description || 'No description'} (${tool.method} ${tool.path})${risk}`);
      }
    }

    parts.push('\n## Guidelines\n');
    parts.push('- Always explain what you are about to do before calling a tool.');
    parts.push('- For dangerous actions (DELETE, PUT, PATCH), the user will be asked to confirm before execution.');
    parts.push('- Include relevant IDs and details in your explanations.');
    parts.push('- If a tool call fails, explain the error clearly and suggest next steps.');
    parts.push('- Summarize the results of tool calls in clear, natural language.');

    parts.push('\n## CRITICAL: When You Cannot Do Something\n');
    parts.push('If the user asks for an action you cannot perform with your available tools, you MUST:');
    parts.push('');
    parts.push('1. **State the gap clearly**: "This API does not have a PATCH/PUT endpoint for updating users."');
    parts.push('2. **List available alternatives**: "Here\'s what I CAN do with users:"');
    parts.push('   - GET /users — list all users');
    parts.push('   - GET /users/{id} — get a specific user');
    parts.push('   - POST /users — create a new user');
    parts.push('   - DELETE /users/{id} — delete a user');
    parts.push('3. **Suggest workarounds**: "To change a user\'s name, you could delete the old user and create a new one with the updated info (note: this changes the user ID)."');
    parts.push('4. **Explain how to add the capability**: "If the underlying API supports updates, ask your admin to re-sync the OpenAPI spec to add the endpoint."');
    parts.push('');
    parts.push('NEVER say "I can\'t help with that" without listing what you CAN do and how the user can proceed.');
  } else {
    parts.push('\nNo API tools are currently available.');
    parts.push('Tell the user: "No API tools are configured for this agent. Ask your admin to add an API source and assign it to this agent."');
  }

  return parts.join('\n');
}
