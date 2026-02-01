/**
 * Tests for the AI module.
 *
 * Run with: yarn test src/lib/ai.test.js
 */

import { getModel, getProviders, isProviderConfigured, getModelsForProvider } from './ai';

describe('AI Provider Registry', () => {
  test('getProviders returns all providers', () => {
    const providers = getProviders();

    expect(providers).toHaveLength(4);
    expect(providers.map(p => p.id)).toEqual(['openai', 'anthropic', 'google', 'ollama']);
  });

  test('each provider has required fields', () => {
    const providers = getProviders();

    for (const provider of providers) {
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('defaultModel');
      expect(typeof provider.tools).toBe('boolean');
    }
  });

  test('isProviderConfigured checks API key', () => {
    expect(isProviderConfigured('openai', {})).toBe(false);
    expect(isProviderConfigured('openai', { openai_api_key: 'sk-test' })).toBe(true);

    // Ollama doesn't require key
    expect(isProviderConfigured('ollama', {})).toBe(true);
  });

  test('getModelsForProvider returns models', () => {
    const openaiModels = getModelsForProvider('openai');
    expect(openaiModels.length).toBeGreaterThan(0);
    expect(openaiModels.some(m => m.recommended)).toBe(true);

    const unknownModels = getModelsForProvider('unknown');
    expect(unknownModels).toEqual([]);
  });
});

describe('getModel', () => {
  test('throws on unknown provider', () => {
    expect(() => getModel({ provider: 'fake', model: 'test' }))
      .toThrow('Unknown provider');
  });

  test('throws on missing API key', () => {
    expect(() => getModel({ provider: 'openai', model: 'gpt-4o', orgSettings: {} }))
      .toThrow('API key not configured');
  });

  test('creates model with valid config', () => {
    const model = getModel({
      provider: 'openai',
      model: 'gpt-4o',
      orgSettings: { openai_api_key: 'sk-test' },
    });

    expect(model).toBeDefined();
    expect(model.modelId).toBe('gpt-4o');
  });

  test('normalizes Anthropic model IDs', () => {
    const model = getModel({
      provider: 'anthropic',
      model: 'claude-sonnet-4.5',
      orgSettings: { anthropic_api_key: 'sk-test' },
    });

    expect(model.modelId).toBe('claude-sonnet-4-5');
  });

  test('ollama works without API key', () => {
    const model = getModel({
      provider: 'ollama',
      model: 'llama3',
      orgSettings: {},
    });

    expect(model).toBeDefined();
  });
});

// Integration test (requires actual API key)
describe.skip('chat integration', () => {
  const { chat } = require('./ai');

  test('streams response from OpenAI', async () => {
    const model = getModel({
      provider: 'openai',
      model: 'gpt-4o-mini',
      orgSettings: { openai_api_key: process.env.OPENAI_API_KEY },
    });

    const result = await chat({
      model,
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Say hello' }] }],
    });

    const response = await result.text;
    expect(response).toContain('hello');
  });
});
