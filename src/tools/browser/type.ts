import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const browserTypeTool: ToolDefinition = {
  name: 'browser_type',
  description: 'Type text into an input field on the web page.',
  parameters: z.object({
    selector: z.string().describe('CSS selector for the input element'),
    text: z.string().describe('Text to type'),
    clear: z.boolean().default(true).describe('Whether to clear the field before typing'),
  }),
  async execute(args, ctx) {
    const browser = await ctx.getBrowser();
    const page = await browser.getPage();
    if (args.clear) {
      await page.fill(args.selector, args.text, { timeout: 10_000 });
    } else {
      await page.type(args.selector, args.text, { timeout: 10_000 });
    }
    return { type: 'text', content: `Typed "${args.text}" into ${args.selector}` };
  },
};
