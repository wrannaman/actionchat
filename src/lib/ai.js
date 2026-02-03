/**
 * Unified AI interface for ActionChat.
 *
 * ARCHITECTURE:
 * 1. Define providers in PROVIDERS registry (one-time setup)
 * 2. Call getModel() to get a provider-agnostic model instance
 * 3. Call chat() with messages + tools → get streaming response
 *
 * Example usage:
 *
 *   import { getModel, chat, toStreamResponse } from '@/lib/ai';
 *
 *   // In your API route:
 *   const model = getModel({
 *     provider: agent.model_provider,
 *     model: agent.model_name,
 *     orgSettings,
 *   });
 *
 *   const result = await chat({
 *     model,
 *     system: 'You are a helpful assistant.',
 *     messages,  // UI messages from useChat
 *     tools,     // AI SDK tools
 *   });
 *
 *   return toStreamResponse(result, { originalMessages: messages });
 */

import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// ============================================================================
// LANGFUSE TRACING (Optional)
// ============================================================================

/**
 * Langfuse tracing is enabled when these env vars are set:
 * - LANGFUSE_PUBLIC_KEY
 * - LANGFUSE_SECRET_KEY
 * - LANGFUSE_HOST (optional, defaults to https://cloud.langfuse.com)
 *
 * See: https://langfuse.com/docs/integrations/vercel-ai-sdk
 */
const LANGFUSE_ENABLED = !!(
  process.env.LANGFUSE_PUBLIC_KEY &&
  process.env.LANGFUSE_SECRET_KEY
);

if (LANGFUSE_ENABLED) {
  console.log('[AI] Langfuse tracing enabled');
}

/**
 * Get telemetry config for AI SDK if Langfuse is enabled.
 * Returns undefined if Langfuse is not configured.
 */
export function getTelemetryConfig(metadata = {}) {
  if (!LANGFUSE_ENABLED) return undefined;

  return {
    isEnabled: true,
    functionId: metadata.functionId || 'actionchat-chat',
    metadata: {
      // Langfuse session grouping - uses chatId as sessionId
      sessionId: metadata.chatId,
      agentId: metadata.agentId,
      agentName: metadata.agentName,
      userId: metadata.userId,
      chatId: metadata.chatId,
      ...metadata,
    },
  };
}

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

/**
 * Add new providers here. Each provider needs:
 * - create: function to create the AI SDK provider
 * - keyField: org settings field for API key
 * - defaultModel: fallback model if none specified
 */
// Models that don't support temperature (reasoning models)
const REASONING_MODELS = ['o3', 'o3-mini', 'o1', 'o1-mini', 'o1-preview', 'gpt-5-mini'];

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    create: (config) => createOpenAI(config),
    keyField: 'openai_api_key',
    baseUrlField: 'openai_base_url',
    defaultModel: 'gpt-5',
    capabilities: { tools: true, vision: true, streaming: true },
    // Use Chat Completions API instead of Responses API
    // Responses API has previousResponseId continuation that can expire and cause
    // "Item with id 'rs_xxx' not found" errors on subsequent requests
    useChat: true,
  },

  anthropic: {
    name: 'Anthropic',
    create: (config) => createAnthropic(config),
    keyField: 'anthropic_api_key',
    defaultModel: 'claude-sonnet-4-20250514',
    capabilities: { tools: true, vision: true, streaming: true },
  },

  google: {
    name: 'Google (Gemini)',
    create: (config) => createGoogleGenerativeAI(config),
    keyField: 'google_generative_ai_api_key',
    defaultModel: 'gemini-3-pro',
    capabilities: { tools: true, vision: true, streaming: true },
  },

  ollama: {
    name: 'Ollama (Local)',
    create: (config) => createOpenAI({ ...config, apiKey: 'ollama' }),
    baseUrlField: 'ollama_base_url',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama4',
    capabilities: { tools: true, vision: true, streaming: true },
    requiresKey: false,
  },
};

// ============================================================================
// MODEL FACTORY
// ============================================================================

/**
 * Get a configured AI model instance.
 *
 * @example
 * const model = getModel({
 *   provider: 'openai',
 *   model: 'gpt-4o',
 *   orgSettings: { openai_api_key: 'sk-...' },
 * });
 */
export function getModel({ provider, model, orgSettings = {} }) {
  const config = PROVIDERS[provider];
  if (!config) {
    const available = Object.keys(PROVIDERS).join(', ');
    throw new Error(`Unknown provider: "${provider}". Available: ${available}`);
  }

  // Validate API key
  const requiresKey = config.requiresKey !== false;
  const apiKey = config.keyField ? orgSettings[config.keyField] : null;

  if (requiresKey && !apiKey) {
    throw new Error(
      `${config.name} API key not configured. Add "${config.keyField}" in Settings → API Keys.`
    );
  }

  // Build provider options
  const options = {};
  if (apiKey) options.apiKey = apiKey;
  if (config.baseUrlField) {
    options.baseURL = orgSettings[config.baseUrlField] || config.defaultBaseUrl;
  }

  // Create provider and model
  const providerInstance = config.create(options);
  const modelId = config.normalizeModelId ? config.normalizeModelId(model) : model;

  // For OpenAI, use .chat() to use Chat Completions API instead of Responses API
  // This avoids "Item with id 'rs_xxx' not found" errors from expired response IDs
  if (config.useChat) {
    return providerInstance.chat(modelId);
  }

  return providerInstance(modelId);
}

/**
 * Convenience: get model from agent config.
 */
export function getModelForAgent(agent, orgSettings = {}) {
  if (!agent.model_name) {
    throw new Error('Agent has no model_name configured.');
  }
  return getModel({
    provider: agent.model_provider,
    model: agent.model_name,
    orgSettings,
  });
}

// ============================================================================
// CHAT FUNCTION
// ============================================================================

/**
 * Stream a chat response from any AI model.
 *
 * @example
 * const result = await chat({
 *   model,
 *   system: 'You are a helpful assistant.',
 *   messages,  // From useChat
 *   tools,     // Optional: AI SDK tools
 * });
 *
 * return toStreamResponse(result, { messages });
 */
export async function chat({
  model,
  modelId,
  system,
  messages,
  tools,
  temperature = 0.1,
  maxSteps = 15, // Agentic: allow multiple rounds of tool calls for best answer
  onStepFinish,
  onFinish,
  // Abort signal for cancellation (pass request.signal from API route)
  abortSignal,
  // Langfuse tracing metadata (optional)
  telemetryMetadata = {},
}) {
  if (!messages || !Array.isArray(messages)) {
    throw new Error('messages array is required');
  }

  // Convert UI messages → model messages
  const modelMessages = await convertToModelMessages(messages);

  // Determine if we have tools
  const hasTools = tools && Object.keys(tools).length > 0;

  // Check if this is a reasoning model (no temperature support)
  const isReasoningModel = modelId && REASONING_MODELS.some(rm => modelId.includes(rm));

  // Build options
  // NOTE: In AI SDK v6, only use stopWhen (not maxSteps) for multi-step tool calling
  // See: https://ai-sdk.dev/cookbook/next/call-tools-multiple-steps
  const options = {
    model,
    system,
    messages: modelMessages,
    tools: hasTools ? tools : undefined,
    // stopWhen controls when to stop the agent loop
    // stepCountIs(n) stops when step count reaches n
    stopWhen: hasTools ? stepCountIs(maxSteps) : stepCountIs(1),
    // Abort signal for cancellation - when client disconnects or user cancels
    abortSignal,
    onStepFinish: (step) => {
      console.log('[AI STEP]', step.stepNumber || 'unknown', 'finishReason:', step.finishReason);
      console.log('[AI STEP] toolCalls:', step.toolCalls?.length || 0);
      console.log('[AI STEP] toolResults:', step.toolResults?.length || 0);
      console.log('[AI STEP] text:', step.text?.slice(0, 100) || '(empty)');
      // Call original if provided
      if (onStepFinish) onStepFinish(step);
    },
    onFinish,
    // Langfuse tracing (if configured via env vars)
    experimental_telemetry: getTelemetryConfig(telemetryMetadata),
  };

  // Only add temperature for non-reasoning models
  if (!isReasoningModel) {
    options.temperature = temperature;
  }

  // Stream the response
  return streamText(options);
}

/**
 * Create streaming response for Next.js API routes.
 */
export function toStreamResponse(result, { headers = {} } = {}) {
  // toUIMessageStreamResponse is the correct method for useChat
  const originalResponse = result.toUIMessageStreamResponse();

  // Response headers can be immutable, so create a new Response with merged headers
  const mergedHeaders = new Headers(originalResponse.headers);
  for (const [key, value] of Object.entries(headers)) {
    mergedHeaders.set(key, value);
  }

  return new Response(originalResponse.body, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers: mergedHeaders,
  });
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Get list of available providers */
export function getProviders() {
  return Object.entries(PROVIDERS).map(([id, config]) => ({
    id,
    name: config.name,
    defaultModel: config.defaultModel,
    requiresKey: config.requiresKey !== false,
    keyField: config.keyField,
    ...config.capabilities,
  }));
}

/** Check if provider has API key configured */
export function isProviderConfigured(provider, orgSettings) {
  const config = PROVIDERS[provider];
  if (!config) return false;
  if (config.requiresKey === false) return true;
  return !!orgSettings[config.keyField];
}

/**
 * Check if an error is an AbortError (user-initiated cancellation).
 * Use this to distinguish user cancellations from real errors.
 */
export function isAbortError(error) {
  if (!error) return false;
  return (
    error.name === 'AbortError' ||
    error.message?.includes('aborted') ||
    error.message?.includes('abort') ||
    error.code === 'ABORT_ERR'
  );
}

/** Model options per provider */
const MODELS = {
  openai: [
    { id: 'gpt-5', name: 'GPT-5', recommended: true },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', fast: true },
    { id: 'o3', name: 'o3 (Reasoning)' },
    { id: 'o3-mini', name: 'o3 Mini', fast: true },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', recommended: true },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
    { id: 'claude-haiku-4-20250514', name: 'Claude Haiku 4', fast: true },
  ],
  google: [
    { id: 'gemini-3-pro', name: 'Gemini 3 Pro', recommended: true },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash', fast: true },
  ],
  ollama: [
    { id: 'llama4', name: 'Llama 4', recommended: true },
    { id: 'mistral-large', name: 'Mistral Large' },
    { id: 'qwen3-coder', name: 'Qwen 3 Coder' },
  ],
};

export function getModelsForProvider(provider) {
  return MODELS[provider] || [];
}
