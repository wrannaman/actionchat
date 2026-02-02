/**
 * Next.js Instrumentation
 *
 * Registers OpenTelemetry exporters for tracing.
 *
 * LANGFUSE TRACING (Optional):
 * Set these env vars to enable:
 * - LANGFUSE_PUBLIC_KEY
 * - LANGFUSE_SECRET_KEY
 * - LANGFUSE_HOST (optional, defaults to https://cloud.langfuse.com)
 *
 * Traces will appear in your Langfuse dashboard with:
 * - Full AI SDK call details (model, tokens, latency)
 * - Tool calls and results
 * - Custom metadata (agentId, userId, chatId)
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;

    if (publicKey && secretKey) {
      try {
        const { registerOTel } = await import('@vercel/otel');
        const { LangfuseExporter } = await import('langfuse-vercel');

        registerOTel({
          serviceName: 'actionchat',
          traceExporter: new LangfuseExporter(),
        });

        console.log('[INSTRUMENTATION] Langfuse tracing registered');
      } catch (error) {
        console.error('[INSTRUMENTATION] Failed to register Langfuse:', error.message);
      }
    }
  }
}
