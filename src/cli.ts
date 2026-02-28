#!/usr/bin/env node

import { program } from 'commander';
import { loadConfig } from './config/loader.js';
import { SessionRegistry } from './mcp/session-registry.js';

program
  .name('windows-use')
  .description('Run Windows/browser automation tasks using a small LLM agent')
  .argument('[instruction]', 'The task to perform')
  .option('--api-key <key>', 'LLM API key')
  .option('--base-url <url>', 'OpenAI-compatible base URL')
  .option('--model <name>', 'Model name')
  .option('--cdp-url <url>', 'Chrome CDP URL (default: http://localhost:9222)')
  .option('--max-steps <n>', 'Max steps before forced stop', parseInt)
  .option('--mcp', 'Start as MCP server instead of running a task')
  .action(async (instruction: string | undefined, opts: any) => {
    if (opts.mcp || !instruction) {
      // MCP server mode
      await import('./mcp/server.js');
      return;
    }

    // CLI single-task mode
    let config;
    try {
      config = loadConfig({
        apiKey: opts.apiKey,
        baseURL: opts.baseUrl,
        model: opts.model,
        cdpUrl: opts.cdpUrl,
        maxSteps: opts.maxSteps,
      });
    } catch (err) {
      console.error(
        'Configuration error. Set WINDOWS_USE_API_KEY, WINDOWS_USE_BASE_URL, WINDOWS_USE_MODEL env vars or pass --api-key, --base-url, --model flags.',
      );
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }

    const registry = new SessionRegistry();
    const session = registry.create(config);

    console.error(`[windows-use] Session ${session.id} created`);
    console.error(`[windows-use] Running: "${instruction}"`);

    try {
      const result = await session.runner.run(instruction);
      console.log(JSON.stringify(result, null, 2));
      await registry.destroy(session.id);
      process.exit(result.status === 'completed' ? 0 : 1);
    } catch (err) {
      console.error('Fatal error:', err instanceof Error ? err.message : err);
      await registry.destroyAll();
      process.exit(1);
    }
  });

program.parse();
