/**
 * Parse slash commands like "/refund cus_123 5000" into structured data.
 */

/**
 * Check if input starts with a slash command.
 * @param {string} input - User input
 * @returns {boolean}
 */
export function isSlashCommand(input) {
  return typeof input === "string" && input.trim().startsWith("/");
}

/**
 * Extract the command name from input.
 * @param {string} input - e.g. "/refund cus_123"
 * @returns {string} - e.g. "refund"
 */
export function extractCommandName(input) {
  if (!isSlashCommand(input)) return "";
  const match = input.trim().match(/^\/(\S+)/);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Extract arguments from a slash command.
 * Supports quoted strings and named parameters (key=value).
 * @param {string} input - e.g. '/refund cus_123 5000 reason="duplicate charge"'
 * @returns {string[]} - e.g. ["cus_123", "5000", "reason=duplicate charge"]
 */
export function extractArgs(input) {
  if (!isSlashCommand(input)) return [];

  // Remove the command part
  const argsStr = input.trim().replace(/^\/\S+\s*/, "");
  if (!argsStr) return [];

  const args = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = null;

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      continue;
    }

    if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = null;
      continue;
    }

    if (char === " " && !inQuotes) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    args.push(current);
  }

  return args;
}

/**
 * Convert positional args to a parameter object based on tool schema.
 * @param {string[]} args - Positional arguments
 * @param {object} tool - Tool object with parameters schema
 * @returns {object} - Parameter object
 */
export function argsToParams(args, tool) {
  const params = {};
  const schema = tool.parameters || {};
  const properties = schema.properties || {};
  const required = schema.required || [];

  // Get ordered parameter names (required first, then optional)
  const paramNames = [
    ...required,
    ...Object.keys(properties).filter(k => !required.includes(k)),
  ];

  // Parse named args (key=value) first
  const namedArgs = {};
  const positionalArgs = [];

  for (const arg of args) {
    const eqIndex = arg.indexOf("=");
    if (eqIndex > 0) {
      const key = arg.slice(0, eqIndex);
      const value = arg.slice(eqIndex + 1);
      namedArgs[key] = value;
    } else {
      positionalArgs.push(arg);
    }
  }

  // Add named args to params
  for (const [key, value] of Object.entries(namedArgs)) {
    const propSchema = properties[key];
    params[key] = coerceValue(value, propSchema);
  }

  // Map positional args to parameters
  let posIndex = 0;
  for (const paramName of paramNames) {
    if (params[paramName] !== undefined) continue; // Already set by named arg
    if (posIndex >= positionalArgs.length) break;

    const propSchema = properties[paramName];
    params[paramName] = coerceValue(positionalArgs[posIndex], propSchema);
    posIndex++;
  }

  return params;
}

/**
 * Coerce a string value to the appropriate type based on schema.
 */
function coerceValue(value, schema) {
  if (!schema) return value;

  const type = schema.type;

  if (type === "integer" || type === "number") {
    const num = Number(value);
    return isNaN(num) ? value : num;
  }

  if (type === "boolean") {
    if (value === "true" || value === "1" || value === "yes") return true;
    if (value === "false" || value === "0" || value === "no") return false;
    return value;
  }

  return value;
}

/**
 * Parse a complete slash command.
 * @param {string} input - User input
 * @param {object[]} tools - Available tools
 * @returns {{ tool: object, params: object } | null}
 */
export function parseSlashCommand(input, tools) {
  if (!isSlashCommand(input)) return null;

  const commandName = extractCommandName(input);
  if (!commandName) return null;

  // Find matching tool (fuzzy match on name)
  const tool = findMatchingTool(commandName, tools);
  if (!tool) return null;

  const args = extractArgs(input);
  const params = argsToParams(args, tool);

  return { tool, params };
}

/**
 * Find a tool that matches the command name.
 * Supports partial matching and common aliases.
 */
export function findMatchingTool(commandName, tools) {
  if (!tools || !commandName) return null;

  const nameLower = commandName.toLowerCase();

  // Exact match on tool name (normalized)
  for (const tool of tools) {
    const toolName = normalizeToolName(tool.name);
    if (toolName === nameLower) return tool;
  }

  // Partial match (starts with)
  for (const tool of tools) {
    const toolName = normalizeToolName(tool.name);
    if (toolName.startsWith(nameLower)) return tool;
  }

  // Contains match
  for (const tool of tools) {
    const toolName = normalizeToolName(tool.name);
    if (toolName.includes(nameLower)) return tool;
  }

  return null;
}

/**
 * Normalize tool name for matching.
 */
function normalizeToolName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // Remove (METHOD path)
    .replace(/[^a-z0-9]/g, "") // Remove non-alphanumeric
    .trim();
}

/**
 * Get autocomplete suggestions for a partial command.
 * @param {string} input - Partial input like "/ref"
 * @param {object[]} tools - Available tools
 * @returns {object[]} - Matching tools
 */
export function getAutocompleteSuggestions(input, tools, maxResults = 5) {
  if (!isSlashCommand(input)) return [];
  if (!tools || tools.length === 0) return [];

  const commandName = extractCommandName(input);

  if (!commandName) {
    // Just "/" - show all tools
    return tools.slice(0, maxResults);
  }

  const nameLower = commandName.toLowerCase();

  // Score tools by match quality
  const scored = tools.map(tool => {
    const toolName = normalizeToolName(tool.name);
    let score = 0;

    if (toolName === nameLower) score = 100;
    else if (toolName.startsWith(nameLower)) score = 80;
    else if (toolName.includes(nameLower)) score = 50;
    else score = 0;

    return { tool, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.tool);
}

/**
 * Generate parameter hints for a tool.
 * @param {object} tool - Tool object
 * @returns {string} - e.g. "<customer_id> <amount> [reason]"
 */
export function getParameterHints(tool) {
  const schema = tool.parameters || {};
  const properties = schema.properties || {};
  const required = schema.required || [];

  const hints = [];

  // Required params first
  for (const name of required) {
    hints.push(`<${name}>`);
  }

  // Optional params
  for (const name of Object.keys(properties)) {
    if (!required.includes(name)) {
      hints.push(`[${name}]`);
    }
  }

  return hints.join(" ");
}
