import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

/**
 * Validate an API key from request headers.
 * Checks: Authorization: Bearer ac_xxx or X-API-Key: ac_xxx
 *
 * Returns: { valid: true, key: {...}, orgId: '...' } or { valid: false, error: '...', status: 401|403 }
 */
export async function validateApiKey(request, requiredAgentId = null) {
  // Extract key from headers
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  let rawKey = null;

  if (authHeader?.startsWith('Bearer ac_')) {
    rawKey = authHeader.slice(7); // Remove "Bearer "
  } else if (apiKeyHeader?.startsWith('ac_')) {
    rawKey = apiKeyHeader;
  }

  if (!rawKey) {
    return { valid: false, error: 'API key required', status: 401 };
  }

  // Hash the key
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  // Look up in database
  const supabase = await createClient();

  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .select('id, org_id, name, agent_ids, is_active, expires_at, created_at')
    .eq('key_hash', keyHash)
    .single();

  if (error || !apiKey) {
    return { valid: false, error: 'Invalid API key', status: 401 };
  }

  // Check if active
  if (!apiKey.is_active) {
    return { valid: false, error: 'API key has been revoked', status: 401 };
  }

  // Check expiry
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { valid: false, error: 'API key has expired', status: 401 };
  }

  // Check agent scope if required
  if (requiredAgentId && apiKey.agent_ids && apiKey.agent_ids.length > 0) {
    if (!apiKey.agent_ids.includes(requiredAgentId)) {
      return {
        valid: false,
        error: 'API key does not have access to this agent',
        status: 403
      };
    }
  }

  // Update last_used_at (fire and forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then(() => {});

  return {
    valid: true,
    key: apiKey,
    orgId: apiKey.org_id,
  };
}

/**
 * Middleware helper for API routes.
 * Returns the auth result or null if no API key provided (fallback to session auth).
 */
export async function tryApiKeyAuth(request, agentId = null) {
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  // Check if this looks like an API key request
  const isApiKeyRequest =
    authHeader?.startsWith('Bearer ac_') ||
    apiKeyHeader?.startsWith('ac_');

  if (!isApiKeyRequest) {
    return null; // Not an API key request, use session auth
  }

  return validateApiKey(request, agentId);
}
