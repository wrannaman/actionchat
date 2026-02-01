/**
 * Chat module exports.
 *
 * Usage:
 *   import { authenticate, loadAgentTools, buildSystemPrompt } from '@/lib/chat';
 */

export { authenticate, AuthError } from './auth';
export { loadAgentTools } from './tools';
export { createChat, saveConversation, getFirstUserMessageText } from './persistence';
export { buildSystemPrompt } from './prompts';
