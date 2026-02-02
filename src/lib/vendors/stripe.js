/**
 * Stripe Vendor Adapter
 * 
 * Stripe has specific requirements that differ from standard JSON APIs:
 * 
 * 1. **Content-Type**: Stripe requires `application/x-www-form-urlencoded`
 *    for POST/PUT/PATCH requests, not JSON.
 * 
 * 2. **Expand Parameters**: List endpoints return minimal data by default.
 *    Use `expand[]` parameter to get nested objects inline.
 *    Example: `expand[]=data.customer` on /v1/invoices
 * 
 * 3. **Pagination**: Uses cursor-based pagination with `starting_after`
 *    and `ending_before` parameters, plus `has_more` in response.
 * 
 * 4. **Idempotency**: POST requests should include `Idempotency-Key` header
 *    for safe retries (not implemented yet).
 * 
 * ## Common Expand Patterns
 * 
 * - `/v1/customers` → expand[]=data.default_source
 * - `/v1/invoices` → expand[]=data.customer,expand[]=data.subscription
 * - `/v1/charges` → expand[]=data.customer,expand[]=data.invoice
 * - `/v1/subscriptions` → expand[]=data.customer,expand[]=data.items.data.price
 * 
 * ## References
 * 
 * - Stripe API Docs: https://docs.stripe.com/api
 * - Expanding Responses: https://docs.stripe.com/api/expanding_objects
 */

export const stripeAdapter = {
  /**
   * URL pattern to match Stripe API endpoints
   */
  urlPattern: /stripe\.com/,

  /**
   * Stripe requires form-urlencoded for request bodies
   */
  contentType: 'form-urlencoded',

  /**
   * Transform arguments before sending to Stripe.
   * 
   * Currently a pass-through, but could be extended to:
   * - Auto-add expand parameters for common endpoints
   * - Convert nested objects to Stripe's bracket notation
   * - Add default pagination limits
   * 
   * @param {object} args - Request arguments from LLM
   * @param {object} tool - Tool definition (path, method, etc.)
   * @param {object} source - API source configuration
   * @returns {object} Transformed arguments
   */
  beforeRequest(args, tool, source) {
    // Future: Auto-expand for list endpoints
    // if (tool.method === 'GET' && tool.path.match(/^\/v1\/\w+$/) && !args.expand) {
    //   // Could add default expands here
    // }
    
    return args;
  },

  /**
   * Transform response after receiving from Stripe.
   * 
   * Currently a pass-through, but could be extended to:
   * - Normalize error formats
   * - Extract pagination info
   * - Flatten nested structures
   * 
   * @param {object} response - Raw API response
   * @param {object} tool - Tool definition
   * @param {object} source - API source configuration
   * @returns {object} Transformed response
   */
  afterResponse(response, tool, source) {
    return response;
  },

  /**
   * Additional headers for Stripe requests.
   * 
   * Could be extended to add:
   * - Stripe-Version header for API versioning
   * - Idempotency-Key for POST requests
   * - Stripe-Account for Connect platforms
   * 
   * @param {object} source - API source configuration
   * @param {object} credentials - User credentials
   * @returns {object} Additional headers
   */
  getHeaders(source, credentials) {
    return {
      // Could add Stripe-Version header here if needed:
      // 'Stripe-Version': '2023-10-16',
    };
  },
};

export default stripeAdapter;
