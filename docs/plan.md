# ActionChat — Implementation Plan

## Completed

- **Phase 0: Clean Slate** — Legacy code stripped, schema deployed, auth working, branding updated, dead code removed.
- **Phase 1: Sources** — OpenAPI spec ingestion, tool parsing, source CRUD, spec_url remote fetching, sync/re-parse.
- **Phase 2: Agents** — Agent CRUD, source linking with permissions (read/read_write), member access controls (operator/viewer).
- **Phase 4: Audit + Settings** — Activity log page + API, org settings (LLM keys), team management (invite, roles), permissions hardening across all routes.
- **Phase 5 (partial): Deploy** — Dockerfile, docker-compose.yml, landing page, env.example.
- **Manual tool addition** — CRUD API + UI for manually defining API endpoints on `source_type: 'manual'` sources. AI-powered extraction: paste cURL/docs/descriptions → auto-generate tool definition.
- **API keys** — Create/list/revoke API keys in settings. Secure key generation (hash-only storage), one-time reveal. Auth middleware for programmatic chat API access.
- **Embed widgets** — CRUD API + UI for embed configs on agents. Public token endpoint with CORS + origin checking. Embed snippet generation. `public/embed.js` loader + `/embed/[token]` page.
- **UX polish** — URL-first sources/new (paste spec URL → auto-fill), simplified agents/new (name + sources, advanced hidden), auto-save on detail pages.

## In Progress

### Phase 3: Chat + Execution Loop (The Product)

**Status:** In progress on branch `chat-ui`.

**Goal:** User types intent, LLM matches to tools, confirms destructive actions, executes, returns summary.

**Pages:**
- `src/app/agents/[id]/chat/page.js` — Chat interface for a specific agent

**API routes (streaming):**
- `src/app/api/chat/route.js` — POST: send message, stream LLM response

**Core logic — the "Brain":**

`src/lib/actionchat-brain.js` — orchestrates the full loop:

1. **Tool selection:** Call `get_agent_tools(agent_id)` to get all tools the agent can access. Format as LLM function definitions.
2. **LLM call:** Using Vercel AI SDK (`ai` package): system prompt, chat history, tool definitions, streaming.
3. **Tool call handling:** Validate params against JSON Schema, check agent_sources permissions, resolve URL, create action_log entry.
4. **Execution:** Build HTTP request with auth pass-through, execute, update action_log.
5. **Summary:** Feed API response back to LLM for natural-language summary.

**Auth pass-through logic:**
- `passthrough` → forward user's Authorization header
- `bearer` → use token from api_source.auth_config
- `api_key` → add API key header from auth_config
- `basic` → base64-encode credentials from auth_config
- `none` → no auth header

**Chat UI:**
- Message bubbles (user/assistant/system)
- Tool call cards inline: method, endpoint, params, status badge
- Confirmation dialog for destructive actions
- Streaming text via Vercel AI SDK `useChat` hook

## Remaining

- **CSV export** on activity log (stretch)
- **Rate limiting** on public embed endpoints (stretch)
- **Webhook notifications** for completed actions (stretch)

---

## Key Technical Decisions

**LLM integration:** Vercel AI SDK (`ai` package). Supports OpenAI, Anthropic, Ollama. `streamText()` with tool definitions for the chat loop.

**OpenAPI parsing:** Custom lightweight parser (`src/lib/openapi-parser.js`). OpenAPI 3.x only. No external parser dependency.

**Schema validation:** `ajv` for validating LLM-generated parameters against tool schemas before execution (hallucination check).

**Auth pass-through:** ActionChat never stores user tokens — it's a proxy. For stored credentials, admin sets them on the api_source.

**No server-side state:** All state in Supabase. Stateless Next.js API routes. No WebSockets, no Redis, no job queues for MVP.
