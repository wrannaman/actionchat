/**
 * Integration tests for chat cancellation.
 *
 * These tests verify end-to-end cancellation behavior.
 * Requires OPENAI_API_KEY or another provider key to be set.
 *
 * Run with: yarn test tests/integration/chat-cancellation.test.ts
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getModel, chat } from '@/lib/ai';

// Skip if no API key available
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
const hasAnyProvider = hasOpenAI || hasAnthropic;

describe.skipIf(!hasAnyProvider)('Chat cancellation integration', () => {
  let model: ReturnType<typeof getModel>;

  beforeAll(() => {
    if (hasOpenAI) {
      model = getModel({
        provider: 'openai',
        model: 'gpt-4o-mini', // Fast, cheap model for testing
        orgSettings: { openai_api_key: process.env.OPENAI_API_KEY },
      });
    } else if (hasAnthropic) {
      model = getModel({
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        orgSettings: { anthropic_api_key: process.env.ANTHROPIC_API_KEY },
      });
    }
  });

  it('completes normally without abort signal', async () => {
    const result = await chat({
      model,
      modelId: 'gpt-4o-mini',
      system: 'You are a helpful assistant. Be very brief.',
      messages: [
        {
          role: 'user',
          content: 'Say "hello" and nothing else',
        },
      ],
    });

    const text = await result.text;
    expect(text.toLowerCase()).toContain('hello');
  });

  it('cancellation stops the stream', async () => {
    const controller = new AbortController();

    // Start a request that would take a while
    const resultPromise = chat({
      model,
      modelId: 'gpt-4o-mini',
      system: 'You are a storyteller.',
      messages: [
        {
          role: 'user',
          content: 'Write a very long story about a dragon. At least 500 words.',
        },
      ],
      abortSignal: controller.signal,
    });

    // Abort after a short delay
    await new Promise((r) => setTimeout(r, 100));
    controller.abort('User cancelled');

    // The promise should reject with an abort error
    await expect(resultPromise).rejects.toThrow();
  });

  it('already-aborted signal rejects immediately', async () => {
    const controller = new AbortController();
    controller.abort('Pre-aborted');

    const startTime = Date.now();

    await expect(
      chat({
        model,
        modelId: 'gpt-4o-mini',
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Hello' }],
        abortSignal: controller.signal,
      })
    ).rejects.toThrow();

    // Should fail fast (under 1 second, not waiting for response)
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(1000);
  });

  it('onFinish is NOT called when cancelled', async () => {
    const controller = new AbortController();
    const onFinish = vi.fn();

    const resultPromise = chat({
      model,
      modelId: 'gpt-4o-mini',
      system: 'Write a very long response.',
      messages: [{ role: 'user', content: 'Tell me about everything in the universe.' }],
      abortSignal: controller.signal,
      onFinish,
    });

    // Abort quickly
    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    // Wait for promise to reject
    await expect(resultPromise).rejects.toThrow();

    // Give a moment for any async handlers
    await new Promise((r) => setTimeout(r, 100));

    // onFinish should not have been called
    expect(onFinish).not.toHaveBeenCalled();
  });
});

describe('Cancellation error handling', () => {
  it('AbortError has correct name', () => {
    const error = new DOMException('Operation aborted', 'AbortError');
    expect(error.name).toBe('AbortError');
  });

  it('can distinguish AbortError from other errors', () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    const otherError = new Error('Network error');

    const isAbortError = (err: Error) => err.name === 'AbortError';

    expect(isAbortError(abortError)).toBe(true);
    expect(isAbortError(otherError)).toBe(false);
  });
});
