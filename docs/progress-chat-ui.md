# Chat Interface — Implementation Progress

**Date:** 2025-01-28
**Status:** Chat UI + chat history + embed widget + dashboard auto-save complete

## What Was Built

The core chat interface for ActionChat — the "Web CLI" that lets users issue natural language commands to agents backed by OpenAPI specs. Plus chat history, resume support, and a public embeddable chat widget.

### Phase 1 — Core Chat (9 files)

| File | Purpose |
|------|---------|
| `src/lib/ai-provider.js` | LLM provider factory. Creates OpenAI/Anthropic/Ollama model instances from agent config + org settings API keys. |
| `src/lib/tool-executor.js` | HTTP executor for target APIs. Handles path param substitution, query params, request body, auth header injection (bearer/api_key/basic/passthrough/none), response formatting. |
| `src/lib/tools-to-ai-sdk.js` | Converts DB tool rows from `get_agent_tools()` RPC into Vercel AI SDK `tool()` definitions. Safe tools auto-execute on server. Dangerous tools use `needsApproval: true` for human-in-the-loop confirmation. |
| `src/app/api/chat/route.js` | Streaming POST endpoint. Auth check, loads agent + org settings + tools + source auth configs, calls `streamText()`, returns `toUIMessageStreamResponse()`. Persists messages + action_log entries in `onFinish`. |
| `src/components/chat/chat-input.jsx` | Terminal-style input: green `➜` prompt, monospace font, Enter to submit. |
| `src/components/chat/chat-message.jsx` | Renders UIMessage parts: text (markdown), tool calls, approval requests, reasoning blocks. User messages get `> ` green prefix. |
| `src/components/chat/tool-call-display.jsx` | Tool call visualization: method badge (GET=green, DELETE=red), path, JSON args, expandable response body. |
| `src/components/chat/confirmation-prompt.jsx` | Inline `[Y] Confirm` / `[N] Reject` for dangerous tool calls. Yellow warning styling. Shows approved/rejected status after response. |
| `src/app/agents/[id]/chat/page.js` | Full-screen terminal chat page. Uses `useChat` hook from `@ai-sdk/react` with `DefaultChatTransport`. Includes API token input (gear icon) for passthrough auth. |

### Phase 2 — Chat History + Resume (2 new files, 2 modified)

| File | Purpose |
|------|---------|
| `src/app/api/agents/[id]/chats/route.js` | **NEW** — GET endpoint listing chat sessions for an agent with message counts + last activity. |
| `src/app/api/chats/[chatId]/messages/route.js` | **NEW** — GET endpoint loading messages for a chat session. Used to resume past conversations. |
| `src/app/agents/[id]/page.js` | **MODIFIED** — Added "Recent Chats" section showing past conversations with timestamps, message counts, and resume links. |
| `src/app/agents/[id]/chat/page.js` | **MODIFIED** — Accepts `?chat=chatId` query param to resume a previous session. Loads history from DB, converts to UIMessage format, passes `chatId` to API. Shows "resumed" badge in header. |

### Phase 3 — Embeddable Widget (2 new files)

| File | Purpose |
|------|---------|
| `src/app/embed/[token]/page.js` | **NEW** — Public standalone embed page. No auth required. Loads widget config via embed token, renders minimal chat UI with theming support. |
| `src/app/api/embed/chat/route.js` | **NEW** — Public streaming chat endpoint for embed widgets. Authenticates via embed token, enforces origin restrictions, only exposes safe (read-only) tools. CORS enabled. |

### Modified Files (from Phase 1)

| File | Change |
|------|--------|
| `package.json` | Added `@ai-sdk/react@3.0.60` |
| `src/app/agents/[id]/page.js` | "Start Chat" button links to `/agents/[id]/chat`. Embed widgets section shows standalone page URL + embed snippet. |

## Architecture

```
Authenticated Chat Flow:
  User types command
    → useChat (AI SDK UI) sends to /api/chat
      → Auth check (Supabase session + org membership)
      → Load agent config + org.settings (LLM API keys)
      → Load tools via get_agent_tools() RPC
      → Load source auth configs (bearer/api_key/basic/passthrough)
      → Convert tools to AI SDK format (safe=auto-execute, dangerous=needsApproval)
      → streamText() with tools, system prompt, temperature
      → toUIMessageStreamResponse() → streams to client
      → onFinish: persist to messages + action_log tables

Dangerous Tool Confirmation:
  → LLM calls dangerous tool
  → Server returns approval-requested state
  → Client shows [Y/n] confirmation prompt
  → User clicks Confirm → addToolApprovalResponse({ approved: true })
  → sendAutomaticallyWhen triggers resubmission
  → Server executes tool, returns result
  → LLM summarizes result

Chat Resume:
  → User clicks past chat from agent detail page
  → /agents/[id]/chat?chat=chatId
  → Client loads messages from /api/chats/[chatId]/messages
  → Converts DB messages → UIMessage format with parts array
  → Passes chatId in body → API appends to existing session

Embed Widget:
  → External site loads /embed/[token]
  → Page fetches config from /api/embed/[token] (public, origin-checked)
  → User types message → sends to /api/embed/chat with embedToken
  → Embed chat endpoint: token auth, origin check, safe tools only
  → Streams response back (no dangerous actions allowed from embeds)
```

## Key Dependencies

- `ai@6.0.58` — Vercel AI SDK core (streamText, tool, jsonSchema, convertToModelMessages)
- `@ai-sdk/react@3.0.60` — useChat hook (installed in this session)
- `@ai-sdk/openai@3.0.21` — OpenAI provider (pre-existing)
- `@ai-sdk/anthropic` — Anthropic provider (pre-existing, transitive dep)
- `react-markdown@10.1.0` — Markdown rendering in assistant messages (pre-existing)

### Phase 4 — Embed Widget Loader (1 file)

| File | Purpose |
|------|---------|
| `public/embed.js` | **NEW** — Self-contained JS loader for third-party sites. Creates floating chat button (bottom-right/left), opens iframe popup with `/embed/[token]` on click. Supports theming via data attributes. Exposes `window.ActionChat.open()/close()/toggle()` API. |

### Phase 5 — Dashboard Auto-Save (2 new files, 4 modified)

| File | Purpose |
|------|---------|
| `src/hooks/use-auto-save.js` | **NEW** — Reusable auto-save hook. Debounces changes (800ms default), detects actual changes via JSON comparison, tracks status (idle/saving/saved/error). Returns `{ status, saveNow }`. |
| `src/components/ui/save-indicator.jsx` | **NEW** — Minimal save status indicator. Shows nothing for idle, spinner + "saving..." for saving, checkmark + "saved" for saved, error icon for error. |
| `src/app/agents/[id]/page.js` | **MODIFIED** — Agent edit form uses auto-save. Removed Save/Cancel, replaced with Done button + SaveIndicator. |
| `src/app/profile/page.js` | **MODIFIED** — Profile form (first/last name) uses auto-save with SaveIndicator in header. |
| `src/app/settings/page.js` | **MODIFIED** — Org settings (LLM API keys) use auto-save with 1200ms debounce. Only sends changed fields. |
| `src/app/sources/[id]/page.js` | **MODIFIED** — Source edit form (name, description, base_url, spec_url) uses auto-save with SaveIndicator. |

## What's NOT Built Yet

- **Streaming indicator** — The "thinking..." pulse shows, but no token-by-token streaming indicator.
- **Keyboard shortcuts** — No CMD+K command bar (kept simple).

## How to Test

### Authenticated Chat
1. `yarn dev`
2. Navigate to `/agents` → select an agent → click "Start Chat"
3. Type a natural language command → see streaming LLM response
4. Ask for a GET operation → tool auto-executes, result displayed
5. Ask for a DELETE/PUT operation → `[Y] Confirm` / `[N] Reject` prompt appears
6. Confirm → tool executes → LLM summarizes result
7. Go back to agent detail → see chat in "Recent Chats" section
8. Click it → resumes with previous messages loaded

### Chat History
1. Navigate to `/agents/[id]`
2. See "Recent Chats" card with past sessions
3. Click a chat → redirects to `/agents/[id]/chat?chat=[chatId]`
4. Previous messages appear, "resumed" badge in header
5. Send a new message → appends to same chat session

### Embed Widget (Standalone Page)
1. Create an embed widget on agent detail page → "Create Widget"
2. Copy the standalone page URL or click the external link icon
3. Open `/embed/[token]` in a new tab/incognito window
4. Type a message → see response from the agent
5. Only safe (read-only) tools are available — no destructive actions

### Embed Widget (Script Loader)
1. Copy the embed snippet from agent detail page
2. Add to an HTML file:
   ```html
   <script src="http://localhost:3000/embed.js" data-token="YOUR_TOKEN"></script>
   ```
3. Open that HTML file in a browser
4. See floating chat button (bottom-right corner)
5. Click to open chat popup
6. Optional attributes:
   - `data-position="bottom-left"` — move to left side
   - `data-button-color="#10b981"` — custom button color
   - `data-open="true"` — start with widget open
7. JS API available: `ActionChat.open()`, `ActionChat.close()`, `ActionChat.toggle()`

## Build Status

`yarn build` passes. All routes registered:
- `/agents/[id]/chat` — chat page (dynamic)
- `/api/chat` — authenticated chat API (dynamic)
- `/api/agents/[id]/chats` — chat history list (dynamic)
- `/api/chats/[chatId]/messages` — chat messages loader (dynamic)
- `/embed/[token]` — public embed page (dynamic)
- `/api/embed/chat` — public embed chat API (dynamic)
- `/api/embed/[token]` — public widget config API (dynamic)
