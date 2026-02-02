/**
 * MCP Hints - Runtime behavior modifications for MCP sources
 *
 * Hints are stored in source_templates.mcp_hints and applied at runtime.
 * When we learn how an MCP behaves (e.g., Stripe needs 'expand'), we update
 * the template and ALL users benefit immediately.
 *
 * Hint Schema:
 * {
 *   // For list endpoints that return minimal data
 *   "list_expansion": {
 *     "param": "expand",              // Parameter name for expansion
 *     "default": ["*"],               // Default value (expand all)
 *     "tool_patterns": ["list_*"]     // Which tools this applies to (glob)
 *   },
 *
 *   // Alternative: use fetch tool to get full objects
 *   "fetch_enrichment": {
 *     "fetch_tool": "fetch_stripe_resources",  // Tool to get full objects
 *     "id_field": "id",                        // Field containing the ID
 *     "auto_enrich": false                     // Auto-fetch on thin results
 *   },
 *
 *   // Extra guidance for LLM (added to system prompt)
 *   "llm_guidance": "For Stripe, use expand parameter...",
 *
 *   // Response transformations
 *   "response": {
 *     "unwrap_data": false,           // response.data → response
 *     "detect_thin": true             // Log warning on thin results
 *   }
 * }
 */

/**
 * Check if a tool name matches a pattern (supports * wildcard)
 */
function matchesPattern(toolName, pattern) {
  if (pattern === '*') return true;
  if (pattern.endsWith('*')) {
    return toolName.startsWith(pattern.slice(0, -1));
  }
  if (pattern.startsWith('*')) {
    return toolName.endsWith(pattern.slice(1));
  }
  return toolName === pattern;
}

/**
 * Check if any pattern in array matches
 */
function matchesAnyPattern(toolName, patterns) {
  if (!patterns || patterns.length === 0) return true; // No patterns = match all
  return patterns.some(p => matchesPattern(toolName, p));
}

/**
 * Pre-process arguments before MCP call
 * Applies default expansions, transforms, etc.
 *
 * @param {object} args - Original arguments from LLM
 * @param {string} toolName - MCP tool name being called
 * @param {object} hints - Template's mcp_hints
 * @returns {object} Processed arguments
 */
export function preProcessArgs(args, toolName, hints) {
  if (!hints || Object.keys(hints).length === 0) {
    return args;
  }

  const processed = { ...args };

  // Apply list expansion defaults
  const expansion = hints.list_expansion;
  if (expansion && matchesAnyPattern(toolName, expansion.tool_patterns)) {
    const paramName = expansion.param || 'expand';

    // Only add default if not already specified by LLM
    if (processed[paramName] === undefined || processed[paramName] === '') {
      const defaultValue = expansion.default;
      if (defaultValue !== undefined) {
        processed[paramName] = defaultValue;
        console.log(`[MCP HINTS] Applied default ${paramName}:`, defaultValue, 'to', toolName);
      }
    }
  }

  return processed;
}

/**
 * Post-process MCP response
 * Detects thin results, unwraps data, etc.
 *
 * @param {object} result - MCP response
 * @param {string} toolName - MCP tool name
 * @param {object} hints - Template's mcp_hints
 * @returns {object} Processed result
 */
export function postProcessResult(result, toolName, hints) {
  if (!hints || Object.keys(hints).length === 0) {
    return result;
  }

  let processed = result;

  // Unwrap .data if configured
  if (hints.response?.unwrap_data && processed?.data) {
    processed = processed.data;
  }

  // Detect thin results (objects with only 'id' field)
  if (hints.response?.detect_thin !== false) {
    const isThin = detectThinResults(processed);
    if (isThin) {
      console.log(`[MCP HINTS] WARNING: ${toolName} returned thin results (only IDs). Consider using expand parameter or fetch tool.`);
    }
  }

  return processed;
}

/**
 * Detect if results are "thin" (only contain id field)
 */
function detectThinResults(data) {
  if (!data) return false;

  // Check array of objects
  if (Array.isArray(data) && data.length > 0) {
    const firstItem = data[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      const keys = Object.keys(firstItem);
      // Thin = only 'id' or just 1-2 fields
      return keys.length <= 2 && keys.includes('id');
    }
  }

  return false;
}

/**
 * Get LLM guidance from hints (for system prompt)
 *
 * @param {object} hints - Template's mcp_hints
 * @returns {string|null} Guidance text to add to system prompt
 */
export function getLlmGuidance(hints) {
  if (!hints) return null;
  return hints.llm_guidance || null;
}

/**
 * Build source-specific LLM guidance from all templates
 *
 * @param {Array} sources - Sources with their template hints
 * @returns {string} Combined guidance for system prompt
 */
export function buildSourceGuidance(sources) {
  const guidanceLines = [];

  for (const source of sources) {
    const hints = source.template?.mcp_hints;
    if (hints?.llm_guidance) {
      guidanceLines.push(`**${source.name}:** ${hints.llm_guidance}`);
    }
  }

  if (guidanceLines.length === 0) return '';

  return `\n### Source-Specific Tips\n${guidanceLines.join('\n')}`;
}

export default {
  preProcessArgs,
  postProcessResult,
  getLlmGuidance,
  buildSourceGuidance,
  detectThinResults,
};
