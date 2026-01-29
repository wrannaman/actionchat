/**
 * Integration Provider Registry
 *
 * Simple provider pattern for external integrations.
 * Add new providers by importing and registering them here.
 */

import { langfuse, writeScoresToLangfuse } from './langfuse';

// Provider registry
const providers = {
  langfuse,
};

// Re-export individual provider functions for direct use
export { writeScoresToLangfuse };

/**
 * Get a provider by ID
 */
export function getProvider(providerId) {
  return providers[providerId] || null;
}

/**
 * Get all available providers
 */
export function getProviders() {
  return Object.values(providers);
}

/**
 * Get provider IDs
 */
export function getProviderIds() {
  return Object.keys(providers);
}
