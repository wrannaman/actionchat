/**
 * MCP (Model Context Protocol) Manager
 *
 * Manages the lifecycle of MCP server processes and provides
 * methods to list tools and execute tool calls.
 *
 * Supports two transport modes:
 * - stdio: Spawns a local process and communicates via stdin/stdout
 * - http: Connects to an HTTP-based MCP server (SSE)
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Track active MCP server connections
const activeServers = new Map();

// Request ID counter for JSON-RPC
let requestId = 0;

/**
 * MCP Server Connection
 * Handles communication with a single MCP server instance
 */
class MCPConnection extends EventEmitter {
  constructor(sourceId, config) {
    super();
    this.sourceId = sourceId;
    this.config = config;
    this.process = null;
    this.isConnected = false;
    this.pendingRequests = new Map();
    this.buffer = '';
    this.capabilities = null;
    this.serverInfo = null;
  }

  /**
   * Start the MCP server process
   */
  async connect() {
    if (this.isConnected) return;

    const { mcp_server_uri, mcp_transport, mcp_env } = this.config;

    if (mcp_transport === 'http') {
      throw new Error('HTTP transport not yet implemented');
    }

    // Parse the server URI as a command
    const parts = mcp_server_uri.split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    // Merge environment variables
    const env = {
      ...process.env,
      ...(mcp_env || {}),
    };

    return new Promise((resolve, reject) => {
      this.process = spawn(command, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout.on('data', (data) => this.handleData(data));
      this.process.stderr.on('data', (data) => {
        console.error(`[MCP ${this.sourceId}] stderr:`, data.toString());
      });

      this.process.on('error', (error) => {
        console.error(`[MCP ${this.sourceId}] Process error:`, error);
        this.isConnected = false;
        reject(error);
      });

      this.process.on('close', (code) => {
        console.log(`[MCP ${this.sourceId}] Process exited with code ${code}`);
        this.isConnected = false;
        this.emit('close', code);
      });

      // Initialize the connection
      this.initialize()
        .then((result) => {
          this.isConnected = true;
          this.capabilities = result.capabilities;
          this.serverInfo = result.serverInfo;
          resolve(result);
        })
        .catch(reject);
    });
  }

  /**
   * Handle incoming data from the MCP server
   */
  handleData(data) {
    this.buffer += data.toString();

    // MCP uses newline-delimited JSON
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch (error) {
        console.error(`[MCP ${this.sourceId}] Failed to parse message:`, line);
      }
    }
  }

  /**
   * Handle a parsed JSON-RPC message
   */
  handleMessage(message) {
    // Response to a request
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || 'MCP error'));
      } else {
        resolve(message.result);
      }
      return;
    }

    // Notification from server
    if (message.method) {
      this.emit('notification', message);
    }
  }

  /**
   * Send a JSON-RPC request to the MCP server
   */
  async sendRequest(method, params = {}) {
    if (!this.process || !this.process.stdin.writable) {
      throw new Error('MCP server not connected');
    }

    const id = ++requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Initialize the MCP connection (required handshake)
   */
  async initialize() {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
      },
      clientInfo: {
        name: 'ActionChat',
        version: '1.0.0',
      },
    });

    // Send initialized notification
    this.process.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }) + '\n'
    );

    return result;
  }

  /**
   * List available tools from the MCP server
   */
  async listTools() {
    const result = await this.sendRequest('tools/list', {});
    return result.tools || [];
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name, args = {}) {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
    return result;
  }

  /**
   * List available resources (if supported)
   */
  async listResources() {
    if (!this.capabilities?.resources) {
      return [];
    }
    const result = await this.sendRequest('resources/list', {});
    return result.resources || [];
  }

  /**
   * Read a resource
   */
  async readResource(uri) {
    const result = await this.sendRequest('resources/read', { uri });
    return result;
  }

  /**
   * List available prompts (if supported)
   */
  async listPrompts() {
    if (!this.capabilities?.prompts) {
      return [];
    }
    const result = await this.sendRequest('prompts/list', {});
    return result.prompts || [];
  }

  /**
   * Disconnect from the MCP server
   */
  disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.isConnected = false;
    this.pendingRequests.clear();
  }
}

/**
 * Get or create an MCP connection for a source
 */
export async function getConnection(sourceId, config) {
  if (activeServers.has(sourceId)) {
    const connection = activeServers.get(sourceId);
    if (connection.isConnected) {
      return connection;
    }
    // Connection died, remove it
    activeServers.delete(sourceId);
  }

  const connection = new MCPConnection(sourceId, config);
  await connection.connect();
  activeServers.set(sourceId, connection);

  // Clean up on close
  connection.on('close', () => {
    activeServers.delete(sourceId);
  });

  return connection;
}

/**
 * List tools from an MCP source
 */
export async function listTools(sourceId, config) {
  const connection = await getConnection(sourceId, config);
  return connection.listTools();
}

/**
 * Call a tool on an MCP server
 *
 * @param {string} sourceId - The source UUID
 * @param {object} config - Source config with mcp_server_uri, mcp_transport, mcp_env
 * @param {string} toolName - The MCP tool name to call
 * @param {object} args - Arguments for the tool
 * @returns {Promise<object>} Tool result with content array
 */
export async function callTool(sourceId, config, toolName, args) {
  const connection = await getConnection(sourceId, config);
  return connection.callTool(toolName, args);
}

/**
 * Disconnect a specific MCP server
 */
export function disconnect(sourceId) {
  if (activeServers.has(sourceId)) {
    activeServers.get(sourceId).disconnect();
    activeServers.delete(sourceId);
  }
}

/**
 * Disconnect all MCP servers (for cleanup)
 */
export function disconnectAll() {
  for (const [sourceId, connection] of activeServers) {
    connection.disconnect();
  }
  activeServers.clear();
}

/**
 * Get connection status for a source
 */
export function isConnected(sourceId) {
  return activeServers.has(sourceId) && activeServers.get(sourceId).isConnected;
}

/**
 * Get server info for a connected source
 */
export function getServerInfo(sourceId) {
  if (!activeServers.has(sourceId)) {
    return null;
  }
  const connection = activeServers.get(sourceId);
  return {
    isConnected: connection.isConnected,
    capabilities: connection.capabilities,
    serverInfo: connection.serverInfo,
  };
}

export default {
  getConnection,
  listTools,
  callTool,
  disconnect,
  disconnectAll,
  isConnected,
  getServerInfo,
};
