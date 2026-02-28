import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionRegistry } from './session-registry.js';
import { loadConfig } from '../config/loader.js';

export function registerMcpTools(
  server: McpServer,
  registry: SessionRegistry,
): void {
  // Tool 1: create_session
  server.tool(
    'create_session',
    'Create a new automation session with a small LLM agent. Returns a session_id.',
    {
      api_key: z.string().optional().describe('LLM API key (or set WINDOWS_USE_API_KEY env)'),
      base_url: z.string().optional().describe('OpenAI-compatible base URL (or set WINDOWS_USE_BASE_URL env)'),
      model: z.string().optional().describe('Model name (or set WINDOWS_USE_MODEL env)'),
      cdp_url: z.string().optional().describe('Chrome CDP URL (default: http://localhost:9222)'),
      timeout_ms: z.number().optional().describe('Session inactivity timeout in ms (default: 300000)'),
      max_steps: z.number().optional().describe('Max tool-calling steps per instruction (default: 50)'),
    },
    async (args) => {
      const config = loadConfig({
        apiKey: args.api_key,
        baseURL: args.base_url,
        model: args.model,
        cdpUrl: args.cdp_url,
        timeoutMs: args.timeout_ms,
        maxSteps: args.max_steps,
      });

      const session = registry.create(config);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ session_id: session.id }),
          },
        ],
      };
    },
  );

  // Tool 2: send_instruction
  server.tool(
    'send_instruction',
    'Send a task instruction to the agent in a session. The agent executes it and returns a status report.',
    {
      session_id: z.string().describe('Session ID from create_session'),
      instruction: z.string().describe('What you want the agent to do, in natural language'),
    },
    async (args) => {
      const session = registry.get(args.session_id);
      if (!session) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Session "${args.session_id}" not found or expired`,
              }),
            },
          ],
          isError: true,
        };
      }

      registry.touch(args.session_id);

      const result = await session.runner.run(args.instruction);

      registry.touch(args.session_id);

      const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
        {
          type: 'text',
          text: JSON.stringify({
            status: result.status,
            summary: result.summary,
            steps_used: result.stepsUsed,
            ...(result.data !== undefined ? { data: result.data } : {}),
          }),
        },
      ];

      if (result.screenshot) {
        content.push({
          type: 'image',
          data: result.screenshot,
          mimeType: 'image/png',
        });
      }

      return { content: content as any };
    },
  );

  // Tool 3: done_session
  server.tool(
    'done_session',
    'Terminate a session and free all resources.',
    {
      session_id: z.string().describe('Session ID to terminate'),
    },
    async (args) => {
      await registry.destroy(args.session_id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true }),
          },
        ],
      };
    },
  );
}
