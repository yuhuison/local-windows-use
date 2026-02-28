import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const browserClickTool: ToolDefinition = {
  name: 'browser_click',
  description: 'Click an element on the web page using a CSS selector or text content.',
  parameters: z.object({
    selector: z.string().describe('CSS selector or text to find the element (e.g., "button.submit", "text=Login")'),
  }),
  async execute(args, ctx) {
    const browser = await ctx.getBrowser();
    const page = await browser.getPage();
    await page.click(args.selector, { timeout: 10_000 });
    return { type: 'text', content: `Clicked element: ${args.selector}` };
  },
};
