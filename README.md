# ActionChat

**The Anti-UI for Internal Operations.**

Turn any `openapi.json` into a secure, authenticated command center in 30 seconds. Stop building admin panels — just build the API.

```
User: "Refund the last order for bob@example.com"
ActionChat: "Found Order #992. Refund $50? [Y/n]"
User: "Y"
✓ POST /refunds/992 — 200 OK
```

## Why ActionChat?

- **Zero UI work** — If it's in the OpenAPI spec, it's in the chat. No forms to build.
- **Hallucination-proof** — Validates all parameters against your API schema *before* execution.
- **Human-in-the-loop** — Destructive actions (POST/PUT/DELETE) require explicit confirmation.
- **Data sovereignty** — Self-hosted. No customer data leaves your infrastructure.
- **Team-safe** — Granular permissions. Give support read-only access while you keep admin.

## Quick Start

```bash
docker run -v ./openapi.json:/app/spec.json -p 8000:8000 actionchat/core
```

That's it. Your APIs are now chat-accessible.

## How It Works

ActionChat is a **translation proxy** between natural language and your existing APIs:

1. User types intent → RAG search over OpenAPI spec
2. LLM maps intent to API call with validated parameters
3. Destructive actions require `[Y/n]` confirmation
4. Execute HTTP call → return natural-language summary

**Auth pass-through:** ActionChat forwards the user's `Authorization` header. If they can't do it in the app, they can't do it via ActionChat.

## Stack

- **App:** Next.js + React + Tailwind (Shadcn/UI)
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **LLM:** Agnostic — OpenAI (default), Anthropic, or Ollama (local)
- **Deploy:** Docker Compose

## Development

```bash
# Install dependencies
yarn install

# Copy environment template
cp env.example .env
# Edit .env with your Supabase credentials

# Run development server
yarn dev
```

### Required Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE=xxx
```

See `env.example` for the full configuration.

### Commands

```bash
yarn dev       # Dev server (port 3000)
yarn build     # Production build
yarn lint      # ESLint
yarn test      # Jest with coverage
```

## Core Concepts

- **Scope** — A grouping of API capabilities from an `openapi.json` (e.g., "Stripe Production", "Internal Admin API")
- **Agent** — A configured bot instance with system prompt, model, and permissions (read-only vs read-write)
- **Tool** — A single API endpoint with `name`, `method`, `parameters`, and `risk_level` (Safe vs High)

## Security

- **No super-admin tokens** — ActionChat uses the user's own credentials via auth pass-through
- **Schema validation** — Generated parameters are validated against JSON Schema; invented params are rejected
- **Confirmation loop** — High-risk operations require explicit user confirmation
- **Audit trail** — Every action is logged (who did what, when)

## License

MIT
