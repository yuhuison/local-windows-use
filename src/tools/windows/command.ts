import { z } from 'zod';
import { exec } from 'child_process';
import type { ToolDefinition } from '../types.js';

const MAX_OUTPUT_LENGTH = 10_000;

export const runCommandTool: ToolDefinition = {
  name: 'run_command',
  description: 'Execute a shell command and return its output. Uses PowerShell on Windows.',
  parameters: z.object({
    command: z.string().describe('The command to execute'),
    timeout: z.number().positive().default(30_000).describe('Timeout in milliseconds'),
  }),
  async execute(args) {
    return new Promise((resolve) => {
      exec(
        args.command,
        {
          timeout: args.timeout,
          maxBuffer: 1024 * 1024,
          shell: 'powershell.exe',
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          let output = '';
          if (stdout) output += stdout;
          if (stderr) output += `\n[stderr] ${stderr}`;
          if (error && error.killed) output += '\n[timeout] Command timed out';
          else if (error) output += `\n[exit code ${error.code}]`;

          // Truncate to protect context
          if (output.length > MAX_OUTPUT_LENGTH) {
            output = output.slice(0, MAX_OUTPUT_LENGTH) + '\n...(truncated)';
          }

          resolve({ type: 'text', content: output.trim() || '(no output)' });
        },
      );
    });
  },
};
