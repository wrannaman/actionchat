# Routines — Design Plan

## The Problem

A customer support rep wants to "refund customer X". This requires:

1. Find customer by email
2. Find their most recent payment
3. Confirm with human ("Refund $50 to Bob?")
4. Execute the refund

**Constraint:** Must be dead simple. CS reps are non-technical. No prompt writing, no workflow builders, no thinking.

## Core Insight

> **"Do it once, save it, reuse it."**

Users don't CREATE routines. They RECORD them.

1. Do the task manually in chat
2. Click "Save as Routine"
3. Name it
4. Done forever

The LLM does ALL the heavy lifting — extracts the pattern, identifies variables, figures out how to replay it.

## Two Personas

### Primary: CS Rep (in /chat)

- Non-technical, low-wage, needs it to "just work"
- Never writes prompts
- Never identifies variables
- Never thinks about tools or APIs
- Just: do task → save → reuse

### Secondary: Tech Admin (separate page)

- Comes in when routines aren't working right
- Has access to routine management page (NOT /chat)
- Can edit prompts, tune patterns, test
- Shares working routines to org

## User Flow: CS Rep

### First Time (Recording)

```
1. User does task in chat:
   "refund the most recent charge for bob@example.com"

2. AI executes with confirmations:
   → Found customer Bob Smith
   → Found charge $50.00
   → "Refund $50.00 to Bob Smith?" [Confirm] [Cancel]
   → User clicks [Confirm]
   → Refunded ✓

3. User clicks [Save as Routine] button (appears after successful multi-step task)

4. Simple dialog:
   ┌────────────────────────────────────┐
   │ Save as Routine                    │
   │                                    │
   │ Name: [refund-customer        ]    │
   │                                    │
   │ Share with team? [x] Yes           │
   │                                    │
   │        [Cancel]  [Save]            │
   └────────────────────────────────────┘

5. Done. LLM auto-extracts:
   - Pattern: find customer → get charges → confirm → refund
   - Variable: email address was the input
   - Generates routine internally
```

### Next Time (Replay)

```
1. User types "/" in chat

2. Autocomplete shows:
   ┌────────────────────────────────────┐
   │ /refund-customer                   │
   │ /cancel-subscription               │
   │ /lookup-customer                   │
   │ ─────────────────────────────────  │
   │ + Create new routine...            │
   └────────────────────────────────────┘

3. User selects /refund-customer

4. Chat shows:
   "Running refund-customer... What's the customer email?"

5. User: "alice@example.com"

6. AI replays the same sequence:
   → Found customer Alice Jones
   → Found charge $75.00
   → "Refund $75.00 to Alice Jones?" [Confirm] [Cancel]
   → User clicks [Confirm]
   → Refunded ✓
```

## User Flow: Tech Admin

Separate page: `/routines` or `/settings/routines`

- List all routines (org-wide and personal)
- Click to edit:
  - See the auto-generated prompt
  - Modify if needed
  - Test with sample inputs
  - View usage stats (how often used, success rate)
- Create manually (for advanced cases)
- Delete / disable routines

## Technical Design

### What Gets Saved

When user clicks "Save as Routine", the system:

1. Extracts from chat history:
   - The tool calls that were made (in order)
   - The arguments passed to each
   - What was user input vs derived data

2. LLM generates:
   - A reusable prompt template
   - Identified parameters (e.g., `{email}`)
   - Confirmation points

3. Stores in `routines` table:
   - `name` — user-provided
   - `prompt` — LLM-generated template
   - `parameters` — extracted variables (JSONB)
   - `source_chat_id` — reference to original chat (for debugging)
   - `is_shared` — team visibility
   - `created_by` — who recorded it

### Execution

When routine is triggered:

1. Parse the routine's prompt + parameters
2. Collect any needed inputs from user (via chat)
3. Execute step-by-step (LLM interprets the prompt against available tools)
4. **Always require confirmation** before any destructive action
5. Show progress inline in chat

### Confirmation Rule

> **All routines require explicit confirmation before destructive actions.**

Multi-step = always confirm. No exceptions. This is the safety net.

- GET requests: execute automatically
- POST/PUT/DELETE: pause and confirm

## UI Changes Needed

### In /chat

1. **Slash command autocomplete** — already exists, add routines to it
2. **"Save as Routine" button** — appears after successful multi-step task
3. **Save dialog** — just name + share checkbox

### New Page: /routines (Admin)

1. List of all routines
2. Edit view with prompt/parameters
3. Test runner
4. Usage stats

## Database

Current `routines` table works. Add:

```sql
ALTER TABLE routines ADD COLUMN parameters JSONB DEFAULT '{}';
ALTER TABLE routines ADD COLUMN source_chat_id UUID REFERENCES chats(id);
```

Parameters example:
```json
{
  "email": {
    "type": "string",
    "description": "Customer email address",
    "required": true
  }
}
```

## Open Questions

1. **How to trigger routine?**
   - Option A: `/routine-name` then AI asks for params
   - Option B: `/routine-name alice@example.com` inline
   - Recommendation: Option A (simpler for CS rep)

2. **What if routine fails mid-way?**
   - Show error in chat
   - User can retry or do manually
   - Tech admin can investigate

3. **Can CS rep delete routines?**
   - Only their own (not shared ones)
   - Or maybe no — admin manages

## MVP Scope

### Phase 1: Recording & Replay

- [ ] "Save as Routine" button after multi-step success
- [ ] Simple save dialog (name + share)
- [ ] LLM extracts pattern from chat history
- [ ] Routines appear in "/" autocomplete
- [ ] Basic replay with confirmation

### Phase 2: Admin Page

- [ ] /routines page for tech admins
- [ ] Edit prompt/parameters
- [ ] Test runner
- [ ] Usage stats

### Phase 3: Polish

- [ ] Better parameter collection UX
- [ ] Routine suggestions ("You do this a lot, want to save it?")
- [ ] Import/export routines

## Example Routines

### Refund Customer

Recorded from: "refund the most recent charge for bob@example.com"

Auto-generated:
```
Find the customer with email {email}.
Get their most recent successful charge.
Confirm the refund amount with the user.
Create a full refund for that charge.
```

### Cancel Subscription

Recorded from: "cancel all subscriptions for alice@example.com"

Auto-generated:
```
Find the customer with email {email}.
List their active subscriptions.
Confirm which subscriptions to cancel.
Cancel the confirmed subscriptions.
```

### Lookup Customer

Recorded from: "show me everything about bob@example.com"

Auto-generated:
```
Find the customer with email {email}.
Get their payment methods, recent charges, and subscriptions.
Display a summary.
```
(No confirmation — read-only routine)
