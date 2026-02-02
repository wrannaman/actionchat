# Tests

## Setup
```bash
cp .env.test.example .env.test
# Add your Stripe test key (sk_test_...)
```

## Run
```bash
yarn test
```

## What it tests
- **Stripe SDK** — direct API calls (create/list customers)
- **Stripe MCP** — tool execution via `https://mcp.stripe.com`
- **Tool executor** — URL building, auth headers

## Config
| Env var | Required | Description |
|---------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe test mode key |
| `MCP_STRIPE_URL` | No | HTTP MCP endpoint (defaults to stdio) |
| `OPENAI_API_KEY` | No | For future LLM tests |
