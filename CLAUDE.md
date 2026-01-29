# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ActionChat** — "The Anti-UI for Internal Operations." Turn any `openapi.json` into a secure, authenticated natural-language command center. Users type intents ("Refund Bob"), the system maps them to API calls, confirms destructive actions with the human, executes, and returns a natural-language summary.

This is an **internal ops tool** (not public customer support). Open source (MIT), self-hosted via Docker.

See `docs/spec.md` for the full product specification.

## Target Architecture

ActionChat is a **Translation Proxy** between natural language and existing APIs:

```
User intent → RAG search over OpenAPI spec → LLM maps to execution plan → Confirmation (if destructive) → HTTP call to target API → Natural language summary
```

### Stack

- **App:** Next.js 16 + React 19 + Tailwind (Shadcn/UI)
- **Backend/Auth/DB:** Supabase (PostgreSQL + Auth + Edge Functions + RLS)
- **LLM Layer:** Agnostic — OpenAI (default), Anthropic, or Ollama (local inference)
- **Deployment:** `docker-compose` (single entry point)

### Core Primitives

- **Scope** — A logical grouping of API capabilities sourced from an `openapi.json` or manual cURL collection (e.g., "Stripe Production", "Internal Admin API")
- **Agent** — A configured bot instance assigned to a Scope, with permissions (read-only vs read-write) and a system prompt
- **Tool** — A specific API endpoint parsed from the OpenAPI spec, with `name`, `method`, `parameters`, and `risk_level` (Safe for GET, High for POST/PUT/DELETE)

### Security Model

- **Auth pass-through:** ActionChat does NOT create super-admin tokens. It forwards the user's own `Authorization` header — if the user can't do it in the app, they can't do it via ActionChat.
- **Human-in-the-loop:** Any tool with `risk_level: High` requires explicit `[Y/n]` confirmation before execution.
- **Hallucination check:** Generated parameters are validated against the endpoint's JSON Schema before execution. Invented parameters are rejected.
- **API-only, no SQL:** Actions go through APIs (which enforce business logic, cascading deletes, webhooks) — never direct SQL writes.

## MVP Phases

**Phase 1 — CLI ("The Ghost"):** Ingest `openapi.json`, accept natural language + auth token via CLI, output the exact curl command and confirmation prompt.

**Phase 2 — Web UI ("The Console"):** Docker container with chat interface, settings page to paste OpenAPI specs, and a history/audit log.

## Database Schema

The schema lives in `sql/001.sql` (complete replacement, not incremental migrations). Use `sql/drop.sql` to reset.

### Tables (13)

| Table | Purpose |
|-------|---------|
| `org` | Multi-tenant root. `settings` JSONB holds LLM API keys, plan config. `allowed_domain` for email auto-join. |
| `org_members` | Membership with `role` (owner/admin/member). `updated_at` tracks role changes. |
| `org_invites` | Invite tokens with expiry, max uses, domain auto-join. |
| `api_sources` | "Scopes" — OpenAPI specs or manual endpoint collections. `source_type` (openapi/manual), `auth_type` (bearer/api_key/basic/passthrough/none), `auth_config` JSONB, `spec_hash` for change detection. |
| `tools` | Individual API endpoints. `operation_id` (unique per source, OpenAPI sync key), `method`, `path`, `parameters` (JSON Schema), `risk_level` (safe/moderate/dangerous), `requires_confirmation`. |
| `agents` | Bot instances. `system_prompt`, `model_provider` (openai/anthropic/ollama), `model_name`, `temperature`, `settings` JSONB. |
| `agent_sources` | M:M agent-to-source with `permission` (read/read_write). |
| `member_agent_access` | Per-agent RBAC: `access_level` (operator/viewer). |
| `chats` | Conversation sessions. `org_id` denormalized for RLS. |
| `messages` | Chat messages. `role` (user/assistant/system), `tool_calls` JSONB, `metadata` JSONB. |
| `action_log` | **Immutable audit trail.** `agent_id` denormalized for analytics. `confirmed_by` records who confirmed/rejected. `tool_name` snapshot survives deletion. Status machine enforced by trigger with auto-timestamps. No DELETE. |
| `embed_configs` | Widget deployment. `embed_token`, `allowed_origins`, `theme`/`settings` JSONB. |
| `api_keys` | Programmatic access scoped to `agent_ids` UUID[]. `is_active` + `expires_at` for revocation/expiry. |

### Helper Functions & Triggers

- `enforce_action_status()` — trigger: enforces valid status transitions on action_log + auto-stamps confirmed_at/executed_at/completed_at
- `ensure_current_user_org(name)` — get or create user's org
- `my_organizations()` — list user's orgs
- `get_my_org_id()` — first org ID
- `check_domain_auto_join(email)` — find orgs matching email domain
- `get_agent_tools(agent_uuid)` — all tools available to an agent via agent_sources
- `get_user_accessible_agents()` — agents the current user can access
- `get_chat_action_summary(chat_uuid)` — action log entries for a chat

### RLS Summary

- All 13 tables have RLS enabled
- `org`, `org_members`, `org_invites` — standard org membership patterns (owner/admin can update member roles)
- `api_sources` — all members SELECT, owner/admin write
- `tools` — inherited from parent api_source's org membership
- `agents` — owner/admin see all, members only via `member_agent_access`
- `chats`, `messages` — users manage own, owner/admin view all (audit)
- `action_log` — users see own, owner/admin see all, UPDATE pending_confirmation by owner or admin, no DELETE
- `embed_configs` — members read, owner/admin write, anon SELECT for widget loading
- `api_keys` — owner/admin only

## Current Codebase State

Next.js 16, React 19, Shadcn/UI, Supabase (auth + DB + RLS), Tailwind CSS.

### Commands

```bash
yarn dev              # Dev server (Turbopack, port 3000)
yarn build            # Production build
yarn lint             # ESLint
yarn test             # Jest with coverage
yarn test:watch       # Jest watch mode
```
