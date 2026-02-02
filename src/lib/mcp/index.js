/**
 * MCP Module - Model Context Protocol integration
 * 
 * This module handles all MCP-related functionality:
 * - Client: Create/manage MCP connections via @ai-sdk/mcp
 * - Parser: Convert MCP tools to ActionChat format
 * - Hints: Runtime behavior modifications (expand params, etc.)
 * - Wrapper: Apply hints to AI SDK tools
 * 
 * Usage:
 *   import { listMCPTools, closeMCPClient } from '@/lib/mcp';
 *   import { convertTools } from '@/lib/mcp';
 *   import { getWrappedMCPTools } from '@/lib/mcp';
 */

// Client - MCP connection management
export {
  getMCPClient,
  getMCPTools,
  listMCPTools,
  callMCPTool,
  closeMCPClient,
  closeAllMCPClients,
  isConnected,
} from './client.js';

// Parser - Convert MCP tools to ActionChat format
export {
  determineRiskLevel,
  convertInputSchema,
  humanizeName,
  convertTool,
  convertTools,
  parseToolResult,
} from './parser.js';

// Hints - Runtime behavior modifications
export {
  preProcessArgs,
  postProcessResult,
  getLlmGuidance,
  buildSourceGuidance,
} from './hints.js';

// Wrapper - Apply hints to AI SDK tools
export {
  getWrappedMCPTools,
  loadAllMCPTools,
} from './wrapper.js';
