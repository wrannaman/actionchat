import { streamText, convertToModelMessages } from 'ai';
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
    const { messages, agentId, chatId: existingChatId, userAuthToken } = body;

    if (!agentId) {
      return new Response(JSON.stringify({ error: 'agentId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // 7. Load source auth configs for tool execution
    const sourceNames = [...new Set((toolRows || []).map(t => t.source_name))];
    let sourceMap = new Map();

    if (sourceNames.length > 0) {
      // Get agent_sources to find source_ids
      const { data: agentSourceLinks } = await supabase
        .from('agent_sources')
        .select('source_id, permission')
        .eq('agent_id', agentId);

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

    // 8. Convert tools to AI SDK format
    const aiTools = convertToolsToAISDK(toolRows || [], {
      sourceMap,
      userAuthToken: userAuthToken || null,
    });

    // 9. Build system prompt
    const systemPrompt = buildSystemPrompt(agent, toolRows || []);

    // 10. Create or reuse chat session
    let chatId = existingChatId;
    if (!chatId) {
      const firstUserMsg = messages?.find(m => m.role === 'user');
      const title = firstUserMsg?.parts
        ?.find(p => p.type === 'text')?.text?.slice(0, 100)
        || firstUserMsg?.content?.slice(0, 100)
        || 'New chat';

      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          org_id: orgId,
          agent_id: agentId,
          user_id: user.id,
          title,
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
      messages: convertToModelMessages(messages),
      tools: hasTools ? aiTools : undefined,
      maxSteps: hasTools ? 5 : 1,
      temperature: agent.temperature ?? 0.1,
      onFinish: async ({ text, steps, usage }) => {
        if (!chatId) return;

        try {
          // Save the last user message
          const lastUserMsg = messages?.findLast(m => m.role === 'user');
          if (lastUserMsg) {
            const userText = lastUserMsg.parts
              ?.find(p => p.type === 'text')?.text
              || lastUserMsg.content
              || '';

            if (userText) {
              await supabase.from('messages').insert({
                chat_id: chatId,
                role: 'user',
                content: userText,
              });
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

          const { data: assistantMsg } = await supabase
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

    for (const tool of toolRows) {
      const risk = tool.risk_level === 'dangerous' ? ' [DANGEROUS - requires confirmation]'
        : tool.risk_level === 'moderate' ? ' [MODERATE]'
        : '';
      parts.push(`- **${tool.tool_name}**: ${tool.description || 'No description'} (${tool.method} ${tool.path})${risk}`);
    }

    parts.push('\n## Guidelines\n');
    parts.push('- Always explain what you are about to do before calling a tool.');
    parts.push('- For dangerous actions (DELETE, PUT, PATCH), the user will be asked to confirm before execution.');
    parts.push('- Include relevant IDs and details in your explanations.');
    parts.push('- If a tool call fails, explain the error clearly and suggest next steps.');
    parts.push('- Summarize the results of tool calls in clear, natural language.');
  } else {
    parts.push('\nNo API tools are currently available. You can answer questions but cannot execute API actions.');
  }

  return parts.join('\n');
}
