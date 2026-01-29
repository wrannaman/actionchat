import { createClient as createServiceClient } from '@supabase/supabase-js';

/**
 * Simple permission checker for API routes
 *
 * Usage:
 *   const perms = await getPermissions(userId, orgId);
 *   if (!perms.isMember) return forbidden();
 *   requireAdmin(perms); // owner or admin
 */

// Cache the service client
let _serviceClient = null;
function getServiceClient() {
  if (!_serviceClient) {
    _serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );
  }
  return _serviceClient;
}

/**
 * Get user permissions for an org
 * @param {string} userId - User ID from auth
 * @param {string} orgId - Organization ID
 * @returns {Promise<Permissions>} Permission object with helper methods
 */
export async function getPermissions(userId, orgId) {
  const supabase = getServiceClient();

  // Get membership
  const { data: membership } = await supabase
    .from('org_members')
    .select('id, role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .single();

  if (!membership) {
    return new Permissions(null, null);
  }

  return new Permissions(membership.id, membership.role);
}

/**
 * Permission object with helper methods
 */
class Permissions {
  constructor(memberId, role) {
    this.memberId = memberId;
    this.role = role;
  }

  /** Is the user a member of this org? */
  get isMember() {
    return this.memberId !== null;
  }

  /** Is the user an owner? */
  get isOwner() {
    return this.role === 'owner';
  }

  /** Is the user an admin (owner or admin role)? */
  get isAdmin() {
    return this.role === 'owner' || this.role === 'admin';
  }
}

/**
 * Quick check helpers for common patterns
 */

export function requireMember(perms) {
  if (!perms.isMember) {
    return { error: 'Not a member of this organization', status: 403 };
  }
  return null;
}

export function requireOwner(perms) {
  if (!perms.isOwner) {
    return { error: 'Only owners can perform this action', status: 403 };
  }
  return null;
}

export function requireAdmin(perms) {
  if (!perms.isAdmin) {
    return { error: 'Only owners and admins can perform this action', status: 403 };
  }
  return null;
}
