/**
 * Chat authentication module.
 *
 * Handles both session-based and API key authentication.
 */

import { cookies } from 'next/headers';
import { getUserOrgId } from '@/utils/supabase/server';
import { tryApiKeyAuth } from '@/utils/api-key-auth';

/**
 * Authenticate a chat request.
 *
 * Tries API key auth first (for programmatic access),
 * then falls back to session auth (for browser).
 *
 * @param {Request} request - The incoming request
 * @param {object} supabase - Supabase client
 * @param {string} agentId - Agent ID (for API key scope check)
 * @returns {Promise<{user, orgId, isApiKey}>}
 * @throws {AuthError} If authentication fails
 */
export async function authenticate(request, supabase, agentId) {
  // Try API key first
  const apiKeyResult = await tryApiKeyAuth(request, agentId);

  if (apiKeyResult) {
    if (!apiKeyResult.valid) {
      throw new AuthError(apiKeyResult.error, apiKeyResult.status);
    }

    return {
      user: {
        id: `apikey:${apiKeyResult.key.id}`,
        email: `api:${apiKeyResult.key.name}`,
      },
      orgId: apiKeyResult.orgId,
      isApiKey: true,
    };
  }

  // Fall back to session auth
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError('Unauthorized', 401);
  }

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get('org_id')?.value;
  const orgId = await getUserOrgId(supabase, cookieOrgId);

  return {
    user,
    orgId,
    isApiKey: false,
  };
}

/**
 * Custom error class for authentication failures.
 */
export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}
