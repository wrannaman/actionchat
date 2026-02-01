/**
 * Chat prompts module.
 *
 * Handles building system prompts for agents.
 */

/**
 * Build the system prompt for an agent.
 *
 * @param {object} agent - Agent config
 * @param {Array} toolRows - Tool rows from database
 * @returns {string} Complete system prompt
 */
export function buildSystemPrompt(agent, toolRows = []) {
  const parts = [];

  // Identity
  parts.push(`You are "${agent.name}", an AI assistant that helps with API operations.`);

  // Custom prompt
  if (agent.system_prompt) {
    parts.push('');
    parts.push(agent.system_prompt);
  }

  // Tools section
  if (toolRows.length > 0) {
    parts.push('');
    parts.push(buildToolsSection(toolRows));
    parts.push('');
    parts.push(GUIDELINES);
  } else {
    parts.push('');
    parts.push(NO_TOOLS_MESSAGE);
  }

  return parts.join('\n');
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

1. **Before calling a tool**: Briefly explain what you're about to do.
2. **After calling a tool**: ALWAYS summarize the results in natural language.
3. **For dangerous actions**: The user will be asked to confirm before execution.
4. **On errors**: Explain clearly and suggest next steps.

**IMPORTANT**: Never respond with just a tool call. Always include text explaining what you did and what the results mean.

Example: After listing customers, say "Found 3 customers: John (john@example.com), Jane (jane@example.com), and Bob (bob@example.com)."

## When You Can't Do Something

If asked for an action you can't perform:

1. State clearly what's missing ("This API doesn't have an update endpoint")
2. List what you CAN do with similar functionality
3. Suggest workarounds if possible
4. Never just say "I can't help" — always provide alternatives`;

const NO_TOOLS_MESSAGE = `## No Tools Available

No API tools are configured for this agent.

Tell the user: "No API tools are configured yet. Ask your admin to add an API source and assign it to this agent."`;
