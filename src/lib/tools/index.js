/**
 * Tools Module - Tool execution and conversion
 * 
 * This module handles all tool-related functionality:
 * - Executor: Execute HTTP API calls
 * - OpenAPI Parser: Parse OpenAPI specs into tools
 * - Converter: Convert DB tool rows to AI SDK format
 * 
 * Usage:
 *   import { executeTool, formatToolResult } from '@/lib/tools';
 *   import { parseOpenApiSpec } from '@/lib/tools';
 *   import { convertToolsToAISDK } from '@/lib/tools';
 */

// Executor - Execute HTTP API calls
export {
  executeTool,
  formatToolResult,
  buildUrl,
  buildAuthHeaders,
  buildRequestBody,
} from './executor.js';

// OpenAPI Parser - Parse specs into tools
export {
  parseOpenApiSpec,
} from './openapi-parser.js';

// Converter - DB tools to AI SDK format
export {
  convertToolsToAISDK,
} from './converter.js';

// Embeddings - Semantic search for tools
export {
  embedTool,
  embedQuery,
  searchTools,
  getEmbeddingCoverage,
  searchTemplateTools,
  getTemplateEmbeddingCoverage,
  getEmbeddingDimension,
  getEmbeddingConfig,
} from './embeddings.js';

// System Tools - Built-in tools for AI self-sufficiency
export {
  createSystemTools,
  createSearchToolsTool,
} from './system-tools.js';
