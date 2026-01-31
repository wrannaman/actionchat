# ActionChat Vision v2: The Action Layer

> "100+ APIs ready to go. Add yours in 60 seconds."

## The Insight

Everyone else is building **plumbing**:
- **MCP** = "here's how to connect to stuff"
- **Skills** = "here's how to extend your agent"
- **OpenAPI specs** = "here's what's possible"

But none of them **do the thing**.

**ActionChat is the execution layer** - where intent becomes action.

```
Skills/MCP/APIs = "You COULD refund Bob"
ActionChat      = "Refund Bob? [Y/n]" → *actually refunds Bob*
```

## The Moat

1. **Auth pass-through** - uses YOUR permissions, not god-mode
2. **Human-in-the-loop** - confirms before destructive actions
3. **Audit trail** - who did what, when, why
4. **Actually executes** - not a suggestion, a real HTTP call

## The Product: Two-Sided Value

### Side 1: Curated Catalog (Instant Value)
Pre-configured integrations that work out of the box:

| Category | Examples |
|----------|----------|
| Payments | Stripe, Square, Braintree |
| Communications | Twilio, SendGrid, Slack, Discord |
| Dev Tools | GitHub, Linear, Jira, PagerDuty |
| CRM/Sales | HubSpot, Salesforce, Intercom |
| Support | Zendesk, Freshdesk, Help Scout |
| Infrastructure | Datadog, AWS, Cloudflare |
| E-commerce | Shopify, WooCommerce |
| Productivity | Notion, Asana, Airtable |

User flow:
1. Click "Add Stripe"
2. Paste API key
3. Done. "Refund customer X" just works.

### Side 2: Bring Your Own APIs (Infinite Extensibility)
Any OpenAPI spec becomes a chat-accessible tool:

1. Paste OpenAPI URL or upload JSON
2. Configure auth (bearer, API key, basic, etc.)
3. Done. Your internal APIs work alongside Stripe.

**This is the unlock:** Teams don't want to build integrations OR be limited to a fixed catalog. They want **both**.

## Competitive Positioning

| Competitor | Problem |
|------------|---------|
| Zapier | No chat, no AI, rigid workflows |
| Retool | Have to BUILD the UI |
| Raw MCP/Skills | Developer-only, no catalog |
| ChatGPT plugins | Dead, couldn't add your own |
| n8n / Make | Still workflow-based, not conversational |

**ActionChat:** Curated catalog + bring your own + one unified chat + human confirms = safe for real ops.

## Landing Page Concept

### Hero
```
ActionChat
───────────────────────────────
The Action Layer for Your APIs

100+ integrations ready to go.
Add your own in 60 seconds.
One chat. Real actions.

[Get Started Free]  [View Integrations →]
```

### Integration Wall (The Money Shot)
```
Popular APIs
────────────────────────────────────────────────────────
[Stripe]     [Twilio]    [GitHub]    [Slack]     [Linear]
[Shopify]    [SendGrid]  [Datadog]   [PagerDuty] [Zendesk]
[Intercom]   [HubSpot]   [Notion]    [Jira]      [Asana]
[AWS]        [Cloudflare][Discord]   [Airtable]  [Square]
                    ... +380 more

Your APIs
────────────────────────────────────────────────────────
Paste any OpenAPI spec. Works in 60 seconds.
[+ Add Your API]
```

### Demo Section
```
┌─────────────────────────────────────────────────────────┐
│  Connected: [Stripe] [Slack] [Internal Billing API]     │
│                                                         │
│  You: refund order #4521 and let them know on slack     │
│                                                         │
│  ActionChat: Found order #4521 ($149.00) for            │
│  alice@example.com. This will:                          │
│                                                         │
│  1. POST /refunds → Stripe ($149.00)                    │
│  2. POST /chat.postMessage → Slack                      │
│                                                         │
│  Proceed? [Yes, refund] [Cancel]                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Value Props
```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Instant Value   │  │  Your APIs Too   │  │  Safe by Design  │
│                  │  │                  │  │                  │
│  100+ APIs work  │  │  Any OpenAPI     │  │  Confirms before │
│  out of the box. │  │  spec. 60 sec    │  │  dangerous ops.  │
│  Just add keys.  │  │  setup.          │  │  Full audit log. │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### The Pitch (For Different Audiences)

**For Ops/Support Teams:**
> "Stop asking engineering to build admin panels. Just chat."

**For Developers:**
> "Ship an admin UI for your API in 60 seconds. OpenAPI in, chat out."

**For CTOs:**
> "One interface for all your APIs. Audit everything. Control who can do what."

## Implementation Phases

### Phase 1: Foundation (Current)
- [x] OpenAPI parsing
- [x] Tool execution with auth
- [x] Human-in-the-loop confirmation
- [x] Audit logging
- [x] Multi-source support

### Phase 2: Catalog MVP
- [ ] Curate 20 high-value OpenAPI specs (Stripe, Twilio, GitHub, etc.)
- [ ] "Template" system - pre-configured source + auth type
- [ ] One-click add from catalog
- [ ] Landing page integration wall

### Phase 3: Catalog Growth
- [ ] 100+ integrations
- [ ] Categories and search
- [ ] "Request an integration" flow
- [ ] Community submissions?

### Phase 4: Virality
- [ ] "Powered by ActionChat" embed widget
- [ ] Public sharing of custom API sources?
- [ ] Usage stats / leaderboard (like skills.sh)

## Open Questions

1. **Pricing model?** Per-seat? Per-action? Free tier size?
2. **API key storage?** Users paste keys, we encrypt. Comfortable?
3. **MCP support?** Worth adding, or OpenAPI enough for now?
4. **Self-hosted vs cloud?** Both? Cloud-first?

## The Tagline Options

- "The Action Layer for Your APIs"
- "100+ APIs. One Chat. Real Actions."
- "Skills for People Who Don't Code"
- "The Anti-UI for Internal Ops"
- "Stop Building Admin Panels"

---

*Last updated: January 2026*
