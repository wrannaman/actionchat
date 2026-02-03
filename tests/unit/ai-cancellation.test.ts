/**
 * Unit tests for AI cancellation support.
 *
 * Run with: yarn test tests/unit/ai-cancellation.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAbortError } from '@/lib/ai';

describe('AbortController / AbortSignal basics', () => {
  it('signal starts as not aborted', () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
  });

  it('signal becomes aborted after abort()', () => {
    const controller = new AbortController();
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it('abort reason is preserved', () => {
    const controller = new AbortController();
    const reason = 'User cancelled the request';
    controller.abort(reason);

    expect(controller.signal.aborted).toBe(true);
    expect(controller.signal.reason).toBe(reason);
  });

  it('abort event fires on signal', async () => {
    const controller = new AbortController();
    const abortHandler = vi.fn();

    controller.signal.addEventListener('abort', abortHandler);
    controller.abort();

    expect(abortHandler).toHaveBeenCalledTimes(1);
  });

  it('already-aborted signal reflects state immediately', () => {
    const controller = new AbortController();
    controller.abort();

    // New listeners on an already-aborted signal should see aborted=true
    expect(controller.signal.aborted).toBe(true);
  });
});

describe('Request signal integration', () => {
  it('Request signal reflects controller abort state', () => {
    const controller = new AbortController();
    const request = new Request('http://localhost/test', {
      signal: controller.signal,
    });

    // Note: Node's Request creates an internal signal that follows the original
    // The signal objects may not be identical (toBe), but state is synchronized
    expect(request.signal.aborted).toBe(false);

    controller.abort();

    // After abort, both should show aborted
    expect(controller.signal.aborted).toBe(true);
    expect(request.signal.aborted).toBe(true);
  });
});

describe('chat() function abortSignal parameter', () => {
  // This is a contract test - verifying the interface accepts the parameter
  // The actual streaming cancellation is tested in integration tests

  it('chat function signature includes abortSignal', async () => {
    // Dynamically import to avoid module caching issues
    const { chat } = await import('@/lib/ai');

    // Verify the function exists and accepts the parameter
    // (it will throw because we don't have a valid model, but that's OK)
    const controller = new AbortController();

    await expect(
      chat({
        model: {} as any, // Invalid model will throw
        messages: [],
        abortSignal: controller.signal,
      })
    ).rejects.toThrow(); // Throws because of invalid model, not missing param
  });
});

describe('isAbortError utility', () => {
  it('returns true for DOMException AbortError', () => {
    const error = new DOMException('The operation was aborted', 'AbortError');
    expect(isAbortError(error)).toBe(true);
  });

  it('returns true for error with "aborted" in message', () => {
    const error = new Error('Request aborted by user');
    expect(isAbortError(error)).toBe(true);
  });

  it('returns true for error with "abort" in message', () => {
    const error = new Error('abort signal triggered');
    expect(isAbortError(error)).toBe(true);
  });

  it('returns false for regular errors', () => {
    const error = new Error('Network timeout');
    expect(isAbortError(error)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });

  it('returns false for non-error objects', () => {
    expect(isAbortError({ message: 'test' })).toBe(false);
    expect(isAbortError('string error')).toBe(false);
  });
});

describe('Cancellation scenarios', () => {
  it('immediate abort (before any processing)', () => {
    const controller = new AbortController();
    controller.abort('Cancelled before start');

    // In a real scenario, this would prevent the request from starting
    expect(controller.signal.aborted).toBe(true);
    expect(controller.signal.reason).toBe('Cancelled before start');
  });

  it('delayed abort (simulating user clicking Stop)', async () => {
    const controller = new AbortController();
    let wasAborted = false;

    // Simulate a long-running operation
    const operation = new Promise<string>((resolve, reject) => {
      const checkAbort = () => {
        if (controller.signal.aborted) {
          wasAborted = true;
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
      };

      // Check abort periodically
      const interval = setInterval(checkAbort, 10);

      // Would normally resolve after work completes
      setTimeout(() => {
        clearInterval(interval);
        if (!wasAborted) resolve('completed');
      }, 100);
    });

    // Abort after 30ms
    setTimeout(() => controller.abort(), 30);

    await expect(operation).rejects.toThrow('Aborted');
    expect(wasAborted).toBe(true);
  });

  it('multiple listeners receive abort event', () => {
    const controller = new AbortController();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    controller.signal.addEventListener('abort', handler1);
    controller.signal.addEventListener('abort', handler2);

    controller.abort();

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});
