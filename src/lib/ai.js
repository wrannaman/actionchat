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

import { streamText, convertToModelMessages } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

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
    defaultModel: 'gemini-2.0-pro',
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
  maxSteps = 5,
  onStepFinish,
  onFinish,
}) {
  if (!messages || !Array.isArray(messages)) {
    throw new Error('messages array is required');
  }

  console.log('[AI] RAW MESSAGES:', JSON.stringify(messages, null, 2));

  // Convert UI messages → model messages
  const modelMessages = await convertToModelMessages(messages);
  console.log('[AI] CONVERTED:', modelMessages.length);

  // Determine if we have tools
  const hasTools = tools && Object.keys(tools).length > 0;

  // Check if this is a reasoning model (no temperature support)
  const isReasoningModel = modelId && REASONING_MODELS.some(rm => modelId.includes(rm));

  // Build options
  const options = {
    model,
    system,
    messages: modelMessages,
    tools: hasTools ? tools : undefined,
    maxSteps: hasTools ? maxSteps : 1,
    onStepFinish,
    onFinish,
  };

  // Only add temperature for non-reasoning models
  if (!isReasoningModel) {
    options.temperature = temperature;
  }

  console.log('[AI] Calling streamText, isReasoningModel:', isReasoningModel);

  // Stream the response
  return streamText(options);
}

/**
 * Create streaming response for Next.js API routes.
 */
export function toStreamResponse(result, { messages, headers = {} } = {}) {
  console.log('[AI] Creating stream response');
  console.log('[AI] Result methods:', Object.keys(result));

  // Try different response methods based on AI SDK version
  let response;
  if (typeof result.toTextStreamResponse === 'function') {
    console.log('[AI] Using toTextStreamResponse');
    response = result.toTextStreamResponse();
  } else if (typeof result.toDataStream === 'function') {
    console.log('[AI] Using toDataStream');
    response = new Response(result.toDataStream());
  } else if (typeof result.textStream === 'object') {
    console.log('[AI] Using textStream directly');
    response = new Response(result.textStream);
  } else {
    console.error('[AI] No valid stream method found on result');
    throw new Error('No valid stream method on result');
  }

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
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
    { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', recommended: true },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', fast: true },
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
