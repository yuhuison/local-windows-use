import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { ToolDefinition } from '../types.js';

export const fileWriteTool: ToolDefinition = {
  name: 'file_write',
  description: 'Write content to a file at the given path. Creates parent directories if needed.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file'),
    content: z.string().describe('Content to write'),
  }),
  async execute(args) {
    try {
      await mkdir(dirname(args.path), { recursive: true });
      await writeFile(args.path, args.content, 'utf-8');
      return { type: 'text', content: `File written: ${args.path}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'text', content: `Error writing file: ${msg}` };
    }
  },
};
