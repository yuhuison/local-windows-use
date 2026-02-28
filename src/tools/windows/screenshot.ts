import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const screenshotTool: ToolDefinition = {
  name: 'screenshot',
  description: 'Capture the full screen and return it as an image. Use this to see what is currently displayed.',
  parameters: z.object({}),
  async execute() {
    // Dynamic import to avoid crashes if native module not available
    const { Monitor } = await import('node-screenshots');

    const monitors = Monitor.all();
    const primary = monitors.find((m: any) => m.isPrimary()) ?? monitors[0];
    if (!primary) {
      return { type: 'text', content: 'Error: No monitor found' };
    }

    const image = primary.captureImageSync();
    const buf = image.toPngSync();

    return {
      type: 'image',
      base64: buf.toString('base64'),
      mimeType: 'image/png',
    };
  },
};
