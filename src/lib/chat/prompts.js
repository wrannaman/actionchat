/**
 * Chat prompts module.
 *
 * Handles building system prompts for agents.
 */

import { buildSourceGuidance } from '@/lib/mcp';

/**
 * Build the system prompt for an agent.
 *
 * @param {object} agent - Agent config
 * @param {Array} toolRows - Tool rows from database (for OpenAPI sources)
 * @param {Array} sourcesWithHints - Sources with their template hints
 * @param {object} tools - AI SDK tools object (includes MCP tools)
 * @returns {string} Complete system prompt
 */
export function buildSystemPrompt(agent, toolRows = [], sourcesWithHints = [], tools = {}) {
  const parts = [];

  // Identity
  parts.push(`You are "${agent.name}", an AI assistant that helps with API operations.`);

  // Custom prompt
  if (agent.system_prompt) {
    parts.push('');
    parts.push(agent.system_prompt);
  }

  // Check if we have any tools (either from database or MCP)
  const hasDbTools = toolRows.length > 0;
  const hasMcpTools = Object.keys(tools).length > 0;
  const hasAnyTools = hasDbTools || hasMcpTools;

  // Tools section
  if (hasAnyTools) {
    parts.push('');
    
    // Build tools section from either source
    if (hasDbTools) {
      parts.push(buildToolsSection(toolRows));
    } else if (hasMcpTools) {
      parts.push(buildMcpToolsSection(tools));
    }
    
    parts.push('');
    parts.push(GUIDELINES);

    // Add source-specific guidance from templates
    const sourceGuidance = buildSourceGuidance(sourcesWithHints);
    if (sourceGuidance) {
      parts.push('');
      parts.push(sourceGuidance);
    }
  } else {
    parts.push('');
    parts.push(NO_TOOLS_MESSAGE);
  }

  return parts.join('\n');
}

/**
 * Build the tools documentation section for MCP tools.
 * MCP tools come from the AI SDK and have a different structure.
 */
function buildMcpToolsSection(tools) {
  const lines = [
    '## Available API Tools',
    '',
    'You have access to the following tools:',
    '',
  ];

  for (const [name, tool] of Object.entries(tools)) {
    const description = tool.description || 'No description';
    lines.push(`- **${name}**: ${description}`);
  }

  return lines.join('\n');
}

/**
 * Build the tools documentation section.
 */
function buildToolsSection(toolRows) {
  const lines = [
    '## Available API Tools',
    '',
    'You have access to the following API endpoints:',
    '',
  ];

  // Group by method
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  for (const method of methods) {
    const tools = toolRows.filter(t => t.method === method);
    if (!tools.length) continue;

    for (const tool of tools) {
      const risk = tool.risk_level === 'dangerous'
        ? ' ⚠️ [DANGEROUS]'
        : tool.risk_level === 'moderate'
          ? ' [MODERATE]'
          : '';

      lines.push(`- **${tool.tool_name}**: ${tool.description || 'No description'} (${method} ${tool.path})${risk}`);
    }
  }

  return lines.join('\n');
}

const GUIDELINES = `## Guidelines

### Tool Discovery
You have access to a curated set of relevant tools for this query. If you need a tool that isn't available in your current set, use the \`search_tools\` function to find it.

**Example:**
- You need to cancel a subscription but don't see a cancellation tool
- Call: \`search_tools({ query: "cancel subscription" })\`
- The search returns matching tools you can then use

This is especially useful for multi-step tasks where you need different tools at each step.

### Be Agentic - Gather What You Need
You can call MULTIPLE tools to complete a task. If you need information, GET IT.

**Example - "create a subscription for test+5@gmail.com":**
1. Look up the customer by email → get customer_id
2. List available products/prices → show options
3. Ask: "Which product? [Product A - $15/mo] [Product B - $29/mo]"
4. User picks → create subscription with customer_id + price_id

**DO NOT** try to create/update without required IDs. Look them up first.
**DO NOT** guess IDs or parameters. Fetch them.

### When to Ask vs Execute
- **Clear request with enough context:** Execute immediately
- **Missing required info you CAN look up:** Look it up (don't ask)
- **Missing info that requires user CHOICE:** Ask with specific options
- **Ambiguous between multiple items:** Show the options, ask which one

### CRITICAL: Bias Toward Action, Not Clarification
NEVER ask clarifying questions when you can just fetch the data and let the user see it.

**BAD:** "Do you mean active subscriptions only, or include canceled ones too?"
**GOOD:** Just fetch ALL subscriptions. The user can see the status column and filter themselves.

**BAD:** "Which product are you looking for?"
**GOOD:** Just list all products. The table shows everything.

If the user asks "does X have Y?" or "show me Y for X" — just fetch it. ALL of it. Don't ask about filters, date ranges, statuses, or subsets. The UI renders tables with all the data. Let the user see and decide.

The ONLY time to ask is when you need info the API requires and you truly cannot look up (e.g., "which price plan should the new subscription use?").

### CRITICAL: The UI Shows Data - NEVER Repeat It
The UI automatically renders API results as interactive tables. The user can already see ALL the data.

**After a successful API call:**
- **Reads (GET):** Say NOTHING. Do not list, summarize, or mention the returned items. The table shows everything. Only speak if you need to ask a follow-up question or the user needs to make a choice.
- **Writes (POST/PUT/DELETE):** One sentence max. "Done." or "Created subscription sub_xyz."
- **Choices needed:** Present options clearly

**WRONG:** "Here are the 10 customers: cus_abc - test@email.com, cus_def - ..."
**RIGHT:** (silence - table shows it all)
**RIGHT:** "Found 10 customers. Need to filter by something specific?"

### Context Awareness
Remember context from the conversation:
- If user said "test+5@gmail.com" earlier, you know the customer
- If user said "that subscription", use the sub_id from earlier results
- If user said "cancel it", you should know what "it" refers to

### Errors
On failure, explain briefly and suggest ONE fix. Try a different approach if possible.

### Endpoint Selection
When querying for a SPECIFIC resource (customer, user, etc.), prefer resource-specific endpoints:
- **GOOD:** \`/v1/customers/{customer}/subscriptions\` (customer-specific)
- **AVOID:** \`/v1/subscriptions?customer=X\` (general list with filter)

Resource-specific endpoints are more reliable and return complete data. General list endpoints with filters may have different default behaviors.

### Never Do
- Call a write endpoint without required IDs (look them up first)
- List, summarize, or repeat data from API responses (the UI shows it already!)
- Generate bullet points or lists of IDs/emails/names after a GET request
- Stop after one tool call if you need more info to complete the task
- Guess at IDs or parameters`;


const NO_TOOLS_MESSAGE = `## No Tools Available

No API tools are configured for this agent.

Tell the user: "No API tools are configured yet. Ask your admin to add an API source and assign it to this agent."`;
