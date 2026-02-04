# ActionChat Claude Code Skills

This document describes the custom Claude Code skills available for ActionChat development.

## Overview

ActionChat has three main development skills that provide a structured workflow for planning, implementing, and reviewing features:

1. **`/actionchat-plan`** - Research and planning phase (NO coding)
2. **`/actionchat-work`** - Implementation phase with verification
3. **`/actionchat-review`** - Multi-perspective code review (6 parallel agents)

## Installation

Skills are located in `.claude/skills/` directory:
- `.claude/skills/actionchat-plan/SKILL.md`
- `.claude/skills/actionchat-work/SKILL.md`
- `.claude/skills/actionchat-review/SKILL.md` + `reviewers/` (6 reviewer checklists)

Plans are stored in `.plans/` directory at project root.

## Workflow

```
┌─────────────────────────────────────────────────┐
│  PHASE 1: PLANNING                               │
│  /actionchat-plan [feature description]         │
│  → Creates .plans/YYYY-MM-DD-feature.md         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  PHASE 2: IMPLEMENTATION                         │
│  /actionchat-work .plans/YYYY-MM-DD-feature.md  │
│  → Implements step-by-step with verification    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  PHASE 3: CODE REVIEW                            │
│  /actionchat-review                              │
│  → 6 parallel AI reviewers analyze changes      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  PHASE 4: FIX & MERGE                            │
│  Fix P1 issues, commit, push, create PR         │
└─────────────────────────────────────────────────┘
```

## /actionchat-plan

**Purpose:** Research the codebase and create a detailed implementation plan WITHOUT writing any code.

**Usage:**
```
/actionchat-plan Add API endpoint for filtering tools by risk level
```

**What it does:**
1. Loads relevant context from docs/ and CLAUDE.md
2. Explores codebase using parallel Task agents
3. Identifies existing patterns and similar implementations
4. Asks informed questions with recommendations
5. Designs a validation methodology
6. Creates a detailed plan file in `.plans/`

**Output:**
- A plan file: `.plans/2025-02-04-feature-name.md`
- Contains: objective, research findings, implementation steps, validation strategy, PR approach

**Rules:**
- ❌ NO code implementation
- ❌ NO file edits (except the plan file)
- ✅ Research first, ask informed questions
- ✅ Every plan must have an automated validation method
- ✅ Plans must reference ActionChat patterns from CLAUDE.md

**Example Plan Structure:**
```markdown
# [Feature] Implementation Plan

## Objective
One sentence describing the feature

## Context from Research
Patterns and findings from codebase exploration

## Validation Methodology
**Primary validation:** [Command to verify it works]
**Expected result:** [Specific output]

## Implementation Steps
Step 1: [What to do]
Step 2: [What to do]
...

## Key Decisions
Choices made based on research
```

## /actionchat-work

**Purpose:** Execute a plan step-by-step with verification at each step.

**Usage:**
```
/actionchat-work .plans/2025-02-04-add-tool-filtering.md
```

**What it does:**
1. Loads the plan file
2. Creates a feature branch
3. Executes each step with verification:
   - `yarn typecheck` - Type checking
   - `yarn build` - Production build
   - `yarn test` - Run tests (if applicable)
4. Runs primary validation from plan
5. Reports completion with summary

**Rules:**
- ✅ Execute ONE step at a time
- ✅ Verify after EVERY step
- ✅ Stop on failure, report to user
- ✅ Run primary validation at the end
- ❌ NO skipping verification
- ❌ NO asking "continue to next step?"
- ❌ NO deviating from the plan

**Verification Commands:**
```bash
yarn typecheck    # Type checking
yarn build        # Production build
yarn test         # Jest tests
yarn lint         # ESLint
yarn dev          # Dev server for manual testing
```

**Output:**
- Implemented feature across multiple files
- All verification steps passed
- Summary of changes with next steps

## /actionchat-review

**Purpose:** Perform comprehensive code review using 6 parallel AI reviewers, each with a specialized perspective.

**Usage:**
```
/actionchat-review
```

**What it does:**
1. Gets git diff (compares feature branch to main)
2. Launches 6 parallel review agents:
   - **API Design** - REST conventions, validation, error handling
   - **Performance** - N+1 queries, React optimization, memory leaks
   - **Idiomatic JavaScript** - Modern JS/TS patterns, async/await, type safety
   - **Project Patterns** - ActionChat-specific patterns from CLAUDE.md
   - **Clean Code** - Readability, naming, single responsibility
   - **Simplicity/YAGNI** - Over-engineering detection
3. Aggregates findings by severity (P1 → P2 → P3)
4. Reports with actionable fix recommendations

**Rules:**
- ✅ Reviews committed changes only
- ✅ All 6 agents run in parallel for speed
- ✅ Findings deduplicated across reviewers
- ✅ Issues sorted by severity and grouped by file
- ❌ Doesn't replace actual testing
- ❌ Doesn't replace human review for high-risk changes

**Severity Levels:**
- **P1 (Must fix)** - Breaks functionality, security issue, violates critical pattern
- **P2 (Should fix)** - Best practice violation, maintainability concern
- **P3 (Consider)** - Style preference, minor improvement

**Output:**
```
## Code Review Summary

### 1. API Design
[P1] src/app/api/tools/route.js:23 - Missing input validation
  -> Fix: Add Zod schema validation before processing

### 2. Performance
No issues found

### 3. Idiomatic JavaScript
[P2] src/lib/executor.js:45 - Using || instead of ?? for default
  -> Fix: const limit = params.limit ?? 10;

...

## Summary
Total Issues: 5 (P1: 1, P2: 3, P3: 1)

Must Fix Before Merge:
1. [P1] Missing input validation on /api/tools

Verdict: Needs fixes
```

**Reviewers are ActionChat-aware:**
- Checks RLS policy usage
- Validates auth pass-through pattern
- Ensures vendor adapters properly registered
- Verifies tool risk levels set correctly
- References CLAUDE.md patterns

**Location of Reviewers:**
- `.claude/skills/actionchat-review/reviewers/api-design.md`
- `.claude/skills/actionchat-review/reviewers/performance.md`
- `.claude/skills/actionchat-review/reviewers/idiomatic-javascript.md`
- `.claude/skills/actionchat-review/reviewers/project-patterns.md`
- `.claude/skills/actionchat-review/reviewers/clean-code.md`
- `.claude/skills/actionchat-review/reviewers/simplicity.md`

You can customize these checklists for project-specific needs!

## When to Use Each Skill

| Scenario | Command |
|----------|---------|
| Starting a new feature | `/actionchat-plan [description]` |
| Plan is approved, ready to implement | `/actionchat-work .plans/YYYY-MM-DD-feature.md` |
| Implementation complete, want AI review | `/actionchat-review` |
| Quick one-line fixes | Don't use skills, just make the change |
| Multi-file changes | Use the skills for structure |
| Database schema changes | Use the skills + reference sql/001.sql |
| New API routes | Use the skills + check existing routes |

## ActionChat-Specific Patterns

The plan skill is aware of ActionChat architecture:

### Database (Supabase)
- Schema in `sql/001.sql`
- RLS policies enforced
- 13 tables: org, api_sources, tools, agents, etc.

### API Routes
- Next.js App Router: `src/app/api/[resource]/route.js`
- Auth pass-through pattern
- Error handling conventions

### Vendor Adapters
- Located in `src/lib/vendors/`
- Pattern: `beforeRequest()`, `afterResponse()`, `getHeaders()`
- Register in `src/lib/vendors/index.js`

### Tools & Executors
- Generic executor: `src/lib/executor.js`
- Tool schema: `src/lib/tools/`
- RAG over OpenAPI specs

## Examples

### Example 1: Add New Vendor Adapter

**Planning:**
```
/actionchat-plan Add GitHub vendor adapter for custom auth headers
```

Agent will:
1. Read existing adapters (stripe.js)
2. Check vendor adapter pattern
3. Create plan with steps to create `github.js` and register it
4. Propose validation: Test API call with adapter

**Implementation:**
```
/actionchat-work .plans/2025-02-04-github-adapter.md
```

Agent will:
1. Create `src/lib/vendors/github.js`
2. Update `src/lib/vendors/index.js`
3. Run `yarn build`, `yarn test`
4. Test API call (primary validation)

### Example 2: Add UI Component

**Planning:**
```
/actionchat-plan Add confirmation dialog for dangerous actions
```

Agent will:
1. Check existing UI components in `src/components/`
2. Research Shadcn/UI patterns
3. Design component API and placement
4. Propose validation: Render in dev server

**Implementation:**
```
/actionchat-work .plans/2025-02-04-confirmation-dialog.md
```

Agent will:
1. Create component file
2. Wire up to action log
3. Run `yarn build`
4. Start `yarn dev`, test manually (primary validation)

### Example 3: Database Schema Change

**Planning:**
```
/actionchat-plan Add tags column to tools table
```

Agent will:
1. Read `sql/001.sql` to understand schema
2. Check RLS policies on tools table
3. Plan migration SQL
4. Propose validation: Query to check column exists

**Implementation:**
```
/actionchat-work .plans/2025-02-04-add-tool-tags.md
```

Agent will:
1. Update `sql/001.sql`
2. Run migration on dev database
3. Update relevant code to use tags
4. Query DB to verify (primary validation)

## Validation Methodology

Every plan MUST include a validation methodology:

**Good validations:**
- API call that proves endpoint works: `curl http://localhost:3000/api/tools`
- Query that proves schema change: `psql $DB -c "SELECT column_name FROM..."`
- Dev server check: `yarn dev` + manual verification
- Test that proves behavior: `yarn test --grep "filter"`

**Bad validations:**
- "Build succeeds" - too weak
- "Manual testing" - not automated
- Nothing - every plan needs validation

## Tips

### For Planning
1. **Let the agent explore** - Don't interrupt research with questions
2. **Trust the recommendations** - Agent bases them on codebase findings
3. **Review the plan** - Check that steps make sense before approving
4. **Look for validation** - Make sure there's an automated check

### For Implementation
1. **Let it run** - Agent proceeds step-by-step automatically
2. **Watch for failures** - If a step fails, agent will stop and report
3. **Trust the verification** - Every step is type-checked and built
4. **Test the primary validation** - The final check is the most important

### For Debugging
1. **Read the error** - Agent will show full error output
2. **Check the plan** - Maybe the plan needs adjustment
3. **Review changes** - Use `git diff` to see what actually changed
4. **Ask for fixes** - Tell agent what's wrong, it will fix and retry

## Directory Structure

```
actionchat/
├── .claude/
│   └── skills/
│       ├── actionchat-plan/
│       │   └── SKILL.md
│       └── actionchat-work/
│           └── SKILL.md
├── .plans/
│   └── YYYY-MM-DD-feature-name.md
├── docs/
│   ├── spec.md              # Product specification
│   ├── claude-skills.md     # This file
│   └── learnings/           # Optional: gotchas and patterns
├── CLAUDE.md                # Architecture and patterns
└── [rest of project]
```

## Advanced Usage

### Custom Learnings

Create `docs/learnings/` to store patterns and gotchas:

```
docs/learnings/
├── api-route-patterns.md
├── supabase-rls-gotchas.md
└── vendor-adapter-checklist.md
```

The plan skill will automatically search these when planning.

### Plan Templates

Plans follow a consistent structure. You can use existing plans as templates:

```bash
ls .plans/
# Copy structure from an existing plan
cp .plans/2025-02-04-example.md .plans/2025-02-05-new-feature.md
```

### Multi-PR Features

For large features, the plan can specify multiple PRs:

```markdown
## PR Strategy

**PR 1:** feat/add-data-model (Steps 1-2)
**PR 2:** feat/add-api-routes (Steps 3-4)
**PR 3:** feat/add-ui (Steps 5-6)

Each PR builds on the previous.
```

The work skill will guide you through creating each PR in sequence.

## Troubleshooting

### "Skill not found"

Make sure skills are in `.claude/skills/` and each has a `SKILL.md` file.

### "Plan file not found"

Check that the path is correct: `.plans/YYYY-MM-DD-feature.md` (relative to project root)

### "Verification failed"

Agent will stop and report the error. Common fixes:
- Type error: Fix the type issue in the code
- Build error: Fix syntax or import
- Test failure: Fix implementation or test
- Validation failed: Feature doesn't work, needs debugging

### "Agent is implementing during planning"

This violates the planning discipline. The plan skill should NEVER edit implementation files. If this happens, remind the agent: "Stop. Planning only, no implementation."

## Comparison to Wonderly Skills

These skills are adapted from the wonderly-plan and wonderly-work skills, with ActionChat-specific changes:

**Changed:**
- ✅ Next.js/React/Supabase patterns (instead of .NET)
- ✅ Yarn commands (instead of dotnet/exec.sh)
- ✅ Standard git workflow (instead of charcoal stacks)
- ✅ ActionChat architecture awareness (CLAUDE.md, docs/spec.md)
- ✅ Simpler PR strategy (single PR by default)

**Kept:**
- ✅ Step-by-step discipline
- ✅ Verification at each step
- ✅ Required validation methodology
- ✅ Research-first planning
- ✅ No implementation during planning

## Further Reading

- [ActionChat CLAUDE.md](../CLAUDE.md) - Architecture and patterns
- [Product Spec](./spec.md) - Full product specification
- [Existing Plans](./.plans/) - Examples of plan structure
