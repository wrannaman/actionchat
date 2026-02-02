/**
 * Vendor Adapter Registry
 * 
 * This module provides vendor-specific customizations for API integrations.
 * Most APIs work with the generic OpenAPI executor, but some vendors have
 * quirks that require special handling.
 * 
 * ## Architecture
 * 
 * Adapters are optional. The generic executor handles 95% of cases.
 * Only add an adapter when a vendor has specific requirements like:
 * - Non-JSON content types (Stripe uses form-urlencoded)
 * - Required headers or auth patterns
 * - Response transformations
 * - Auto-expansion of nested data
 * 
 * ## Adding a New Adapter
 * 
 * 1. Create a new file: /src/lib/vendors/{vendor}.js
 * 2. Export an adapter object with the shape defined below
 * 3. Register it in the ADAPTERS map in this file
 * 4. The executor will automatically use it based on base_url matching
 * 
 * ## Adapter Shape
 * 
 * ```js
 * export const vendorAdapter = {
 *   // URL pattern to match (checked against source.base_url)
 *   urlPattern: /vendor\.com/,
 *   
 *   // Content-Type for POST/PUT/PATCH requests
 *   // Options: 'json' (default), 'form-urlencoded'
 *   contentType: 'json',
 *   
 *   // Transform arguments before sending request
 *   // Use for: adding default params, reformatting data
 *   beforeRequest: (args, tool, source) => args,
 *   
 *   // Transform response after receiving
 *   // Use for: unwrapping data, normalizing errors
 *   afterResponse: (response, tool, source) => response,
 *   
 *   // Custom headers to add to all requests
 *   getHeaders: (source, credentials) => ({}),
 * };
 * ```
 */

import { stripeAdapter } from './stripe.js';

/**
 * Registry of vendor adapters.
 * Key is a descriptive name, value is the adapter object.
 */
const ADAPTERS = {
  stripe: stripeAdapter,
  // Add new adapters here as needed:
  // twilio: twilioAdapter,
  // shopify: shopifyAdapter,
};

/**
 * Find the appropriate adapter for a source based on its base_url.
 * 
 * @param {object} source - The API source object
 * @returns {object|null} The matching adapter, or null if none found
 */
export function getAdapter(source) {
  if (!source?.base_url) return null;
  
  for (const [name, adapter] of Object.entries(ADAPTERS)) {
    if (adapter.urlPattern && adapter.urlPattern.test(source.base_url)) {
      return adapter;
    }
  }
  
  return null;
}

/**
 * Get content type for a source (with adapter override).
 * 
 * @param {object} source - The API source object
 * @returns {'json' | 'form-urlencoded'} The content type to use
 */
export function getContentType(source) {
  const adapter = getAdapter(source);
  return adapter?.contentType || 'json';
}

/**
 * Apply beforeRequest transformation if adapter exists.
 * 
 * @param {object} args - Request arguments
 * @param {object} tool - Tool definition
 * @param {object} source - API source
 * @returns {object} Transformed arguments
 */
export function applyBeforeRequest(args, tool, source) {
  const adapter = getAdapter(source);
  if (adapter?.beforeRequest) {
    return adapter.beforeRequest(args, tool, source);
  }
  return args;
}

/**
 * Apply afterResponse transformation if adapter exists.
 * 
 * @param {object} response - API response
 * @param {object} tool - Tool definition
 * @param {object} source - API source
 * @returns {object} Transformed response
 */
export function applyAfterResponse(response, tool, source) {
  const adapter = getAdapter(source);
  if (adapter?.afterResponse) {
    return adapter.afterResponse(response, tool, source);
  }
  return response;
}

/**
 * Get additional headers from adapter.
 * 
 * @param {object} source - API source
 * @param {object} credentials - User credentials
 * @returns {object} Additional headers
 */
export function getAdapterHeaders(source, credentials) {
  const adapter = getAdapter(source);
  if (adapter?.getHeaders) {
    return adapter.getHeaders(source, credentials);
  }
  return {};
}

export default {
  getAdapter,
  getContentType,
  applyBeforeRequest,
  applyAfterResponse,
  getAdapterHeaders,
};
