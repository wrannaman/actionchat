# ActionChat — Decision History

## Identity

- **Product:** ActionChat — "The Anti-UI for Internal Operations."
- **Promise:** Turn any `openapi.json` into a secure, authenticated command center.
- **User:** Internal Ops / Developers (not public customer support).
- **Distribution:** Open source (MIT), self-hosted via Docker.

## Architecture

ActionChat is a **translation proxy** between natural language and existing APIs:

1. User intent → RAG over OpenAPI spec → LLM maps to execution plan
2. Confirmation required for destructive actions
3. HTTP call to target API → natural-language summary

**Stack:** Docker Compose, Next.js, React, Tailwind, Supabase (Auth + Postgres + RLS). LLM-agnostic (OpenAI, Anthropic, Ollama).

**Required env (Supabase):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`. See `env.example`.

## Core Primitives

- **Scope** — Grouping of API capabilities (one `openapi.json` or manual cURL set). Example: "Stripe Production".
- **Agent** — Bot instance for a scope; read-only vs read-write; system prompt.
- **Tool** — Single endpoint from the spec: `name`, `method`, `parameters`, `risk_level` (Safe vs High). High-risk → confirmation required.

## Security Decisions

- **Auth pass-through:** No super-admin tokens. Forward the user’s `Authorization` header. If they can’t do it in the app, they can’t do it via ActionChat.
- **Human-in-the-loop:** Any tool with `risk_level: High` gets explicit `[Y/n]` before execution.
- **Hallucination check:** Validate generated parameters against the endpoint’s JSON Schema before calling the API; reject invented params.

## Decision: API Only, No SQL

**Verdict: API only.** No direct SQL for actions.

- **Business logic:** SQL bypasses application code (no webhooks, no audit, corrupted state).
- **Safety:** APIs enforce permissions and cascading deletes; ad-hoc SQL risks orphans and mistakes.
- **Identity:** ActionChat is an action engine, not a BI tool. BI = read-only SQL; actions = APIs.

**Exception (future):** Read-only SQL for reporting (“How many users signed up yesterday?”) is acceptable later.

## Decision: Clawdbot vs ActionChat

**Verdict: Different products.**

- **Clawdbot:** B2C/prosumer — “Book me a flight,” Gmail/Calendar/Spotify. Personal Jarvis.
- **ActionChat:** B2B/ops — “Refund user 405,” “Rollback deployment.” OpenAPI, Stripe, AWS. Command center.

Same tech (self-hosted agent container); different use case. Clawdbot validates demand for sovereignty; ActionChat applies it to the enterprise/admin stack.

## MVP Scope

- **Phase 1 (CLI):** Ingest `openapi.json`; `npx actionchat "Refund Bob" --token "…"` → exact `curl` + confirmation prompt.
- **Phase 2 (Web):** Docker app, chat UI, settings for OpenAPI paste, history/audit log.

## Schema Decisions

- **Foundation:** `org`, `org_members`, `org_invites`, helpers (`ensure_current_user_org`, `my_organizations`, `get_my_org_id`, `check_domain_auto_join`). UUIDs, `set_updated_at`, RLS everywhere.
- **ActionChat tables:** 13 tables including `api_sources` (Scopes), `tools`, `agents`, `agent_sources`, `member_agent_access`, `chats`, `messages`, `action_log` (audit), `embed_configs`, `api_keys`.
- **Design:** LLM keys in `org.settings`; `auth_config` on `api_sources` (stripped for non-admins in API); `chats.org_id` denormalized for RLS; `action_log` append-only, status updates only, no DELETE; `tool_name` snapshot on `action_log` so history survives renames; no separate analytics tables (use `action_log` + indexes).

## Future (Post-MVP)

- Multi-step workflows, scheduled jobs, optional read-only SQL for reporting.
