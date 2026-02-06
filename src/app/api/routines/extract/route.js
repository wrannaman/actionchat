import { NextResponse } from 'next/server';
import { createClient, getUserOrgId } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { generateText } from 'ai';
import { getModel } from '@/lib/ai';

export const dynamic = 'force-dynamic';

/**
 * POST /api/routines/extract - Extract a routine from chat history
 *
 * Takes a chatId and uses LLM to analyze the conversation and extract:
 * - A reusable prompt template
 * - Identified parameters/variables
 * - A short description
 *
 * Body: { chatId: string }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get('org_id')?.value;
    const orgId = await getUserOrgId(supabase, cookieOrgId);

    const { chatId } = await request.json();
    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    // Verify chat belongs to this org
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, title, agent_id')
      .eq('id', chatId)
      .eq('org_id', orgId)
      .single();

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Get all messages from this chat
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('role, content, tool_calls')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (msgError) {
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Chat has no messages' }, { status: 400 });
    }

    // Check if chat has tool calls (multi-step task)
    const hasToolCalls = messages.some(m => m.tool_calls?.length > 0);
    if (!hasToolCalls) {
      return NextResponse.json({
        error: 'This chat has no tool calls. Routines are best created from conversations that executed API calls.'
      }, { status: 400 });
    }

    // Get org settings for LLM
    const { data: org } = await supabase
      .from('org')
      .select('settings')
      .eq('id', orgId)
      .single();

    const orgSettings = org?.settings || {};

    // Format chat history for extraction
    const chatHistory = formatChatForExtraction(messages);

    // Extract tool chain (ordered list of tool_ids and names)
    const toolChain = extractToolChain(messages);

    // Use LLM to extract the routine
    const extraction = await extractRoutineWithLLM(chatHistory, orgSettings);

    return NextResponse.json({
      ok: true,
      extraction: {
        prompt: extraction.prompt,
        parameters: extraction.parameters,
        description: extraction.description,
        suggestedName: extraction.suggestedName,
        toolChain: toolChain.ids,
        toolChainNames: toolChain.names,
      },
    });

  } catch (error) {
    console.error('[ROUTINES] Extract error:', error);
    return NextResponse.json(
      { error: 'Failed to extract routine', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Extract the tool chain (ordered tool_ids and names) from chat messages.
 */
function extractToolChain(messages) {
  const ids = [];
  const names = [];
  const seen = new Set(); // Dedupe tools used multiple times

  for (const msg of messages) {
    if (msg.tool_calls?.length > 0) {
      for (const tc of msg.tool_calls) {
        // Use tool_id if available, otherwise try to get from result
        const toolId = tc.result?.tool_id || tc.tool_id;
        const toolName = tc.tool_name;

        // Only add unique tools (preserve order of first occurrence)
        const key = toolId || toolName;
        if (key && !seen.has(key)) {
          seen.add(key);
          if (toolId) ids.push(toolId);
          if (toolName) names.push(toolName);
        }
      }
    }
  }

  return { ids, names };
}

/**
 * Format chat messages into a structured format for LLM analysis.
 */
function formatChatForExtraction(messages) {
  const parts = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      parts.push(`USER: ${msg.content}`);
    } else if (msg.role === 'assistant') {
      let text = msg.content || '';

      // Include tool calls information
      if (msg.tool_calls?.length > 0) {
        const toolInfo = msg.tool_calls.map(tc => {
          let info = `- Called ${tc.tool_name}`;
          if (tc.arguments) {
            info += ` with: ${JSON.stringify(tc.arguments)}`;
          }
          if (tc.result?.body) {
            // Truncate large results
            const resultStr = JSON.stringify(tc.result.body);
            info += ` → ${resultStr.length > 500 ? resultStr.slice(0, 500) + '...' : resultStr}`;
          }
          return info;
        }).join('\n');
        text += text ? '\n\nTool Calls:\n' + toolInfo : 'Tool Calls:\n' + toolInfo;
      }

      parts.push(`ASSISTANT: ${text}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Use LLM to extract a reusable routine from the chat history.
 */
async function extractRoutineWithLLM(chatHistory, orgSettings) {
  // Determine which provider to use (prefer OpenAI for extraction)
  let model;
  try {
    if (orgSettings.openai_api_key) {
      model = getModel({ provider: 'openai', model: 'gpt-4o-mini', orgSettings });
    } else if (orgSettings.anthropic_api_key) {
      model = getModel({ provider: 'anthropic', model: 'claude-3-haiku-20240307', orgSettings });
    } else if (orgSettings.google_generative_ai_api_key) {
      model = getModel({ provider: 'google', model: 'gemini-1.5-flash', orgSettings });
    } else {
      throw new Error('No LLM API key configured');
    }
  } catch (e) {
    throw new Error(`Cannot extract routine: ${e.message}`);
  }

  const systemPrompt = `You are an expert at analyzing chat conversations and extracting reusable workflow patterns.

Your task is to analyze a conversation where a user completed a multi-step task using API tools, and extract:
1. A reusable prompt template that captures the workflow
2. The variable parameters that would change each time the routine runs
3. A short description of what the routine does
4. A suggested name (kebab-case, e.g., "refund-customer")

IMPORTANT GUIDELINES:
- Focus on the SEQUENCE of actions, not the specific data
- Identify values that were user inputs (like email addresses, IDs) vs derived data
- The prompt should be instructions for an AI to replicate this workflow
- Parameters should have clear types and descriptions
- Keep the prompt concise but complete

Respond with valid JSON only, in this exact format:
{
  "prompt": "Step-by-step instructions for the AI to follow...",
  "parameters": {
    "paramName": {
      "type": "string|number|boolean",
      "description": "What this parameter is for",
      "required": true|false
    }
  },
  "description": "One sentence describing what this routine does",
  "suggestedName": "kebab-case-name"
}`;

  const userPrompt = `Analyze this conversation and extract a reusable routine:

${chatHistory}

Remember to respond with valid JSON only.`;

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.1,
  });

  // Parse the LLM response
  const text = result.text.trim();

  // Extract JSON from the response (handle markdown code blocks)
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.prompt || typeof parsed.prompt !== 'string') {
      throw new Error('Missing or invalid prompt');
    }

    return {
      prompt: parsed.prompt,
      parameters: parsed.parameters || {},
      description: parsed.description || '',
      suggestedName: parsed.suggestedName || 'new-routine',
    };
  } catch (parseError) {
    console.error('[ROUTINES] Failed to parse LLM response:', text);
    throw new Error('Failed to parse routine extraction. The AI response was not valid JSON.');
  }
}
