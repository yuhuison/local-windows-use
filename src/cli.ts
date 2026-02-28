#!/usr/bin/env node

import { program } from 'commander';
import { createInterface } from 'readline';
import { createServer } from 'http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig, getConfigPath } from './config/loader.js';
import { SessionRegistry } from './mcp/session-registry.js';
import type { RunResult, StepEvent } from './agent/runner.js';
import { parseReportContent } from './tools/types.js';

/** Tiny static file server for screenshots (node:http, zero deps) */
function startScreenshotServer(screenshotDir: string): Promise<{ port: number; save: (base64: string) => string }> {
  let counter = 0;
  const files = new Map<string, Buffer>();

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const name = req.url?.slice(1) ?? '';
      const buf = files.get(name);
      if (buf) {
        const ct = name.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
        res.writeHead(200, { 'Content-Type': ct });
        res.end(buf);
      } else {
        // Index page — list all screenshots
        res.writeHead(200, { 'Content-Type': 'text/html' });
        const links = [...files.keys()]
          .map((f) => `<a href="/${f}"><img src="/${f}" style="max-width:400px;margin:8px"></a>`)
          .join('\n');
        res.end(`<html><body style="background:#1a1a1a;display:flex;flex-wrap:wrap">${links}</body></html>`);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;

      const save = (base64: string): string => {
        counter++;
        const name = `screenshot-${counter}.jpg`;
        const buf = Buffer.from(base64, 'base64');
        files.set(name, buf);
        // Also save to disk
        const filePath = join(screenshotDir, name);
        writeFileSync(filePath, buf);
        return `http://127.0.0.1:${port}/${name}`;
      };

      resolve({ port, save });
    });
  });
}

program
  .name('windows-use')
  .description('Run Windows/browser automation tasks using a small LLM agent')
  .version('0.2.0');

// init command
program
  .command('init')
  .description('Interactive setup, or import/export config via base64')
  .argument('[base64]', 'Import config from a base64 string')
  .option('--export', 'Export current config as a base64 string')
  .action(async (base64Input: string | undefined, opts: { export?: boolean }) => {
    const configPath = getConfigPath();

    // Export mode
    if (opts.export) {
      if (!existsSync(configPath)) {
        console.error('No config found. Run `windows-use init` first.');
        process.exit(1);
      }
      const raw = readFileSync(configPath, 'utf-8');
      const encoded = Buffer.from(raw).toString('base64');
      console.log(encoded);
      return;
    }

    // Import mode
    if (base64Input) {
      try {
        const decoded = Buffer.from(base64Input, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        writeFileSync(configPath, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
        console.log(`✅ Config imported to ${configPath}`);
        // Show what was imported (mask API key)
        const display = { ...parsed };
        if (display.apiKey) {
          display.apiKey = display.apiKey.slice(0, 6) + '...' + display.apiKey.slice(-4);
        }
        console.log(JSON.stringify(display, null, 2));
      } catch {
        console.error('Invalid base64 or JSON. Make sure you copied the full string.');
        process.exit(1);
      }
      return;
    }

    // Interactive mode (default)
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

    console.log('\n🔧 windows-use setup\n');

    const baseURL = await ask('Base URL (OpenAI-compatible endpoint): ');
    const apiKey = await ask('API Key: ');
    const model = await ask('Model name (e.g. qwen3.5-flash): ');

    rl.close();

    const config: Record<string, string> = {};
    if (baseURL) config.baseURL = baseURL;
    if (apiKey) config.apiKey = apiKey;
    if (model) config.model = model;

    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    console.log(`\n✅ Config saved to ${configPath}`);
    console.log('You can now run: windows-use "your task here"\n');
  });

// default command — run a task
program
  .argument('[instruction]', 'The task to perform')
  .option('--api-key <key>', 'LLM API key')
  .option('--base-url <url>', 'OpenAI-compatible base URL')
  .option('--model <name>', 'Model name')
  .option('--cdp-url <url>', 'Chrome CDP URL (default: http://localhost:9222)')
  .option('--max-steps <n>', 'Max tool-calling steps per instruction', parseInt)
  .option('--max-rounds <n>', 'Max instruction rounds per session', parseInt)
  .option('--mcp', 'Start as MCP server instead of running a task')
  .action(async (instruction: string | undefined, opts: any) => {
    if (opts.mcp) {
      await import('./mcp/server.js');
      return;
    }

    let config;
    try {
      config = loadConfig({
        apiKey: opts.apiKey,
        baseURL: opts.baseUrl,
        model: opts.model,
        cdpUrl: opts.cdpUrl,
        maxSteps: opts.maxSteps,
        maxRounds: opts.maxRounds,
      });
    } catch (err) {
      console.error(
        'Configuration error. Run `windows-use init` to set up, or pass --api-key, --base-url, --model flags.',
      );
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }

    // Set up screenshot server
    const screenshotDir = join(tmpdir(), 'windows-use-screenshots');
    mkdirSync(screenshotDir, { recursive: true });
    const { port, save: saveScreenshot } = await startScreenshotServer(screenshotDir);

    const registry = new SessionRegistry();
    const session = registry.create(config);

    // Hook step-by-step progress display
    session.runner.setOnStep((event: StepEvent) => {
      const prefix = `  [step ${event.step}]`;
      switch (event.type) {
        case 'thinking':
          console.log(`${prefix} 💭 ${event.content}`);
          break;
        case 'tool_call': {
          const argsStr = typeof event.args === 'object'
            ? JSON.stringify(event.args, null, 0)
            : String(event.args);
          const preview = argsStr.length > 120 ? argsStr.slice(0, 120) + '...' : argsStr;
          console.log(`${prefix} 🔧 ${event.name}(${preview})`);
          break;
        }
        case 'tool_result':
          console.log(`${prefix} ✓ ${event.name} → ${event.result}`);
          break;
        case 'error':
          console.log(`${prefix} ✗ ${event.message}`);
          break;
      }
    });

    console.log(`\n[windows-use] Session ${session.id} created`);
    console.log(`[windows-use] Model: ${config.model}`);
    console.log(`[windows-use] Screenshots: http://127.0.0.1:${port}`);
    console.log(`[windows-use] Type "exit" or Ctrl+C to quit.\n`);

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, (a) => resolve(a.trim())));

    let nextInstruction = instruction ?? '';

    const printResult = (result: RunResult) => {
      const statusIcon = result.status === 'completed' ? '✅' :
                         result.status === 'blocked' ? '🚫' : '❓';
      console.log(`\n${statusIcon} [${result.status}]`);

      // Expand [Image:img_X] markers → screenshot URLs
      const blocks = parseReportContent(result.content, session.screenshots);
      for (const block of blocks) {
        if (block.type === 'text') {
          process.stdout.write(block.text);
        } else {
          const url = saveScreenshot(block.base64);
          process.stdout.write(`\n   📸 ${block.label}: ${url}\n`);
        }
      }

      if (result.data) {
        console.log(`\n   Data: ${JSON.stringify(result.data)}`);
      }
      const roundInfo = `round ${session.runner.currentRound}/${config.maxRounds}`;
      console.log(`\n   (${result.stepsUsed} steps, ${roundInfo})\n`);
    };

    try {
      while (true) {
        if (!nextInstruction) {
          nextInstruction = await ask('> ');
        } else {
          console.log(`> ${nextInstruction}`);
        }

        if (!nextInstruction || nextInstruction.toLowerCase() === 'exit') {
          break;
        }

        if (session.runner.roundsExhausted) {
          console.log(`[windows-use] Session reached max rounds (${config.maxRounds}). Type "exit" to quit.\n`);
          nextInstruction = '';
          continue;
        }

        console.log('[windows-use] Running...\n');
        const result = await session.runner.run(nextInstruction);
        printResult(result);

        nextInstruction = '';
      }
    } catch (err) {
      console.error('\nFatal error:', err instanceof Error ? err.message : err);
    } finally {
      rl.close();
      await registry.destroyAll();
      console.log('[windows-use] Session ended.');
      process.exit(0);
    }
  });

program.parse();
