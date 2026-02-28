import { z } from 'zod';
import { readFile } from 'fs/promises';
import type { ToolDefinition } from '../types.js';

const MAX_FILE_SIZE = 100_000; // chars

export const fileReadTool: ToolDefinition = {
  name: 'file_read',
  description: 'Read the contents of a file at the given path.',
  parameters: z.object({
    path: z.string().describe('Absolute path to the file'),
  }),
  async execute(args) {
    try {
      const content = await readFile(args.path, 'utf-8');
      if (content.length > MAX_FILE_SIZE) {
        return {
          type: 'text',
          content: content.slice(0, MAX_FILE_SIZE) + '\n...(truncated)',
        };
      }
      return { type: 'text', content };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'text', content: `Error reading file: ${msg}` };
    }
  },
};
