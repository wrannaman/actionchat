# Vendor Adapters

This directory contains vendor-specific adapters for APIs that need special handling.

## Philosophy

**95% of APIs work with the generic OpenAPI executor.** Only add an adapter when absolutely necessary.

## When to Add an Adapter

- **Non-JSON content types** — Stripe requires `application/x-www-form-urlencoded`
- **Custom auth patterns** — Some APIs need special headers
- **Auto-expansion** — Add default `expand` params to list endpoints
- **Response normalization** — Flatten or transform responses

## Adding a New Adapter

### 1. Create the adapter file

```javascript
// src/lib/vendors/twilio.js
export const twilioAdapter = {
  urlPattern: /twilio\.com/,
  contentType: 'json',  // or 'form-urlencoded'
  
  beforeRequest(args, tool, source) {
    // Transform args before sending
    return args;
  },
  
  afterResponse(response, tool, source) {
    // Transform response after receiving
    return response;
  },
  
  getHeaders(source, credentials) {
    // Add custom headers
    return {};
  },
};

export default twilioAdapter;
```

### 2. Register in index.js

```javascript
import { twilioAdapter } from './twilio.js';

const ADAPTERS = {
  stripe: stripeAdapter,
  twilio: twilioAdapter,  // Add here
};
```

### 3. That's it!

The executor auto-detects adapters based on `urlPattern` matching `source.base_url`.

## Current Adapters

| Vendor | File | Purpose |
|--------|------|---------|
| Stripe | `stripe.js` | `form-urlencoded` content type |

## Hooks

### `beforeRequest(args, tool, source)`

Called before building the HTTP request. Use for:
- Adding default parameters
- Reformatting nested data
- Injecting required fields

### `afterResponse(response, tool, source)`

Called after parsing the response. Use for:
- Unwrapping nested data
- Normalizing error formats
- Extracting pagination metadata

### `getHeaders(source, credentials)`

Returns additional headers to include. Use for:
- API version headers
- Idempotency keys
- Platform-specific headers

## Testing

Test adapters via the integration tests:

```bash
yarn test tests/integration/stripe-api.test.ts
```
