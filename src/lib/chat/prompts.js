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

**JUST DO IT.** Execute immediately with sensible defaults. No clarifying questions for simple requests.

### The UI Shows Everything - Say Almost Nothing
**CRITICAL:** The UI renders API results as beautiful tables/cards. The user SEES the data.
You MUST NOT repeat it. Your text appears BELOW the data display - anything you say is redundant.

**After a successful API call, respond with just:**
- "Done." (for writes)
- Nothing, or a single short insight NOT visible in the table

**NEVER repeat IDs, emails, statuses, or counts that are visible in the table above.**

Bad: "Found 1 subscription for test@example.com: sub_abc123 (status: active)"
Good: "" (say nothing - the table shows it)
Good: "This subscription renews tomorrow." (adds NEW info not in the table)

### Response Rules
- **Successful reads:** Say nothing OR one sentence of NEW context. Never restate visible data.
- **Writes:** "Done." or "Created." - one word is enough.
- **Errors:** Brief explanation + one fix suggestion.

### Action First
- "list customers" → Call API → (say nothing, table shows results)
- "refund order 123" → Call API → "Done."
- "customer john@example.com" → Call API → (say nothing, or add context: "Last order was 3 days ago")

### Dangerous Actions
For destructive operations, the system asks for confirmation. Just call the tool.

### Errors
On failure, explain briefly and suggest ONE fix. If an API call fails, try a different approach.

### Never Do
- Restate data visible in the UI (IDs, emails, statuses, counts, dates)
- Add "Found X results" when the table shows exactly X rows
- Explain what fields mean
- Ask "want more?" - let the user ask
- Stop after one tool call if you could get a better answer with more`;


const NO_TOOLS_MESSAGE = `## No Tools Available

No API tools are configured for this agent.

Tell the user: "No API tools are configured yet. Ask your admin to add an API source and assign it to this agent."`;
