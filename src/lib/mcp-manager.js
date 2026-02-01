/**
 * MCP (Model Context Protocol) Manager
 *
 * Manages the lifecycle of MCP server processes and provides
 * methods to list tools and execute tool calls.
 *
 * Supports two transport modes:
 * - stdio: Spawns a local process and communicates via stdin/stdout
 * - http: Connects to an HTTP-based MCP server (Streamable HTTP)
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Track active MCP server connections
const activeServers = new Map();

// Request ID counter for JSON-RPC
let requestId = 0;

/**
 * HTTP MCP Connection
 * Handles communication with a remote HTTP-based MCP server
 */
class HTTPMCPConnection extends EventEmitter {
  constructor(sourceId, config) {
    super();
    this.sourceId = sourceId;
    this.config = config;
    this.isConnected = false;
    this.capabilities = null;
    this.serverInfo = null;
    this.sessionId = null;
  }

  /**
   * Connect to HTTP MCP server
   */
  async connect() {
    if (this.isConnected) return;

    const { mcp_server_uri, mcp_auth_token } = this.config;

    // Initialize the connection
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

    this.isConnected = true;
    this.capabilities = result.capabilities;
    this.serverInfo = result.serverInfo;

    // Send initialized notification
    await this.sendNotification('notifications/initialized', {});

    return result;
  }

  /**
   * Send a JSON-RPC request over HTTP
   */
  async sendRequest(method, params = {}) {
    const { mcp_server_uri, mcp_auth_token } = this.config;
    const id = ++requestId;

    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add auth token if available
    if (mcp_auth_token) {
      headers['Authorization'] = `Bearer ${mcp_auth_token}`;
    }

    // Add session ID if we have one
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    console.log('[MCP HTTP] ────────────────────────────────────────');
    console.log('[MCP HTTP] URL:', mcp_server_uri);
    console.log('[MCP HTTP] Method:', method);
    console.log('[MCP HTTP] Has auth token:', !!mcp_auth_token);
    console.log('[MCP HTTP] Session ID:', this.sessionId || '(none)');
    console.log('[MCP HTTP] Request body:', JSON.stringify(request, null, 2));
    console.log('[MCP HTTP] ────────────────────────────────────────');

    try {
      const response = await fetch(mcp_server_uri, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      console.log('[MCP HTTP] Response status:', response.status, response.statusText);

      // Capture session ID from response headers
      const newSessionId = response.headers.get('Mcp-Session-Id');
      if (newSessionId) {
        this.sessionId = newSessionId;
        console.log('[MCP HTTP] New session ID:', newSessionId);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MCP HTTP] Error response:', errorText.slice(0, 1000));
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      console.log('[MCP HTTP] Response JSON:', JSON.stringify(result, null, 2).slice(0, 8000));

      if (result.error) {
        console.error('[MCP HTTP] JSON-RPC error:', result.error);
        throw new Error(result.error.message || 'MCP error');
      }

      return result.result;
    } catch (error) {
      console.error(`[MCP HTTP ${this.sourceId}] Request failed:`, error);
      throw error;
    }
  }

  /**
   * Send a notification (no response expected)
   */
  async sendNotification(method, params = {}) {
    const { mcp_server_uri, mcp_auth_token } = this.config;

    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    if (mcp_auth_token) {
      headers['Authorization'] = `Bearer ${mcp_auth_token}`;
    }

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    try {
      await fetch(mcp_server_uri, {
        method: 'POST',
        headers,
        body: JSON.stringify(notification),
      });
    } catch (error) {
      console.error(`[MCP HTTP ${this.sourceId}] Notification failed:`, error);
    }
  }

  /**
   * List available tools
   */
  async listTools() {
    const result = await this.sendRequest('tools/list', {});
    return result.tools || [];
  }

  /**
   * Call a tool
   */
  async callTool(name, args = {}) {
    return await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
  }

  /**
   * List resources (if supported)
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
    return await this.sendRequest('resources/read', { uri });
  }

  /**
   * List prompts (if supported)
   */
  async listPrompts() {
    if (!this.capabilities?.prompts) {
      return [];
    }
    const result = await this.sendRequest('prompts/list', {});
    return result.prompts || [];
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.isConnected = false;
    this.sessionId = null;
  }
}

/**
 * Stdio MCP Server Connection
 * Handles communication with a local MCP server process via stdin/stdout
 */
class StdioMCPConnection extends EventEmitter {
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

    const { mcp_server_uri, mcp_env } = this.config;

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
 * Automatically selects HTTP or Stdio transport based on config
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

  // Choose transport based on config
  const transport = config.mcp_transport || 'stdio';
  const isHttpUrl = config.mcp_server_uri?.startsWith('http://') || config.mcp_server_uri?.startsWith('https://');

  let connection;
  if (transport === 'http' || isHttpUrl) {
    connection = new HTTPMCPConnection(sourceId, config);
  } else {
    connection = new StdioMCPConnection(sourceId, config);
  }

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
