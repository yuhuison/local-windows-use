import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const reportTool: ToolDefinition = {
  name: 'report',
  description:
    'Report progress back to the caller. Call this when the task is completed, when you are blocked, or when you need guidance. Calling this STOPS your execution immediately.',
  parameters: z.object({
    status: z
      .enum(['completed', 'blocked', 'need_guidance'])
      .describe(
        '"completed" = task done, "blocked" = cannot proceed, "need_guidance" = need a decision',
      ),
    summary: z
      .string()
      .describe('Concise human-readable summary of what was accomplished or what the problem is'),
    include_screenshot: z
      .boolean()
      .default(false)
      .describe('Whether to capture and include a screenshot of the current state'),
    data: z.unknown().optional().describe('Optional structured data to return'),
  }),
  async execute(args) {
    let screenshot: string | undefined;

    if (args.include_screenshot) {
      try {
        const { Monitor } = await import('node-screenshots');
        const monitors = Monitor.all();
        const primary = monitors.find((m: any) => m.isPrimary()) ?? monitors[0];
        if (primary) {
          const image = primary.captureImageSync();
          const buf = image.toPngSync();
          screenshot = buf.toString('base64');
        }
      } catch {
        // Silently skip if screenshot fails
      }
    }

    return {
      type: 'report',
      status: args.status,
      summary: args.summary,
      screenshot,
      data: args.data,
    };
  },
};
