import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const browserScrollTool: ToolDefinition = {
  name: 'browser_scroll',
  description: 'Scroll the current web page.',
  parameters: z.object({
    direction: z.enum(['up', 'down']).describe('Scroll direction'),
    amount: z.number().positive().default(500).describe('Pixels to scroll'),
  }),
  async execute(args, ctx) {
    const browser = await ctx.getBrowser();
    const page = await browser.getPage();
    const delta = args.direction === 'down' ? args.amount : -args.amount;
    await page.evaluate((d: number) => window.scrollBy(0, d), delta);
    return { type: 'text', content: `Scrolled ${args.direction} ${args.amount}px` };
  },
};
