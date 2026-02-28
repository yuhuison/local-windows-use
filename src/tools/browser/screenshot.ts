import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const browserScreenshotTool: ToolDefinition = {
  name: 'browser_screenshot',
  description: 'Take a screenshot of the current browser page.',
  parameters: z.object({
    fullPage: z.boolean().default(false).describe('Whether to capture the full scrollable page'),
  }),
  async execute(args, ctx) {
    const browser = await ctx.getBrowser();
    const page = await browser.getPage();
    const buf = await page.screenshot({
      type: 'png',
      fullPage: args.fullPage,
    });
    return {
      type: 'image',
      base64: buf.toString('base64'),
      mimeType: 'image/png',
    };
  },
};
