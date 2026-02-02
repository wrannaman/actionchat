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

### The UI Shows Data - You Don't Need To
The UI renders API results as tables/cards. Don't repeat what's visible.

**After a successful API call:**
- Reads: Say nothing (table shows it) OR add one insight not in the data
- Writes: "Done." or brief confirmation
- Choices needed: Present options clearly

### Context Awareness
Remember context from the conversation:
- If user said "test+5@gmail.com" earlier, you know the customer
- If user said "that subscription", use the sub_id from earlier results
- If user said "cancel it", you should know what "it" refers to

### Errors
On failure, explain briefly and suggest ONE fix. Try a different approach if possible.

### Never Do
- Call a write endpoint without required IDs (look them up first)
- Repeat IDs/emails/data visible in the UI tables
- Stop after one tool call if you need more info to complete the task
- Guess at IDs or parameters`;


const NO_TOOLS_MESSAGE = `## No Tools Available

No API tools are configured for this agent.

Tell the user: "No API tools are configured yet. Ask your admin to add an API source and assign it to this agent."`;
