import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SessionRegistry } from './session-registry.js';
import { registerMcpTools } from './tools.js';

const server = new McpServer({
  name: 'windows-use',
  version: '0.1.0',
});

const registry = new SessionRegistry();

registerMcpTools(server, registry);

// Graceful shutdown
async function shutdown() {
  await registry.destroyAll();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const transport = new StdioServerTransport();
await server.connect(transport);

// Use stderr for logging — stdout is reserved for JSON-RPC
console.error('[windows-use] MCP server started');
