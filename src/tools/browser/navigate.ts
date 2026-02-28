import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const browserNavigateTool: ToolDefinition = {
  name: 'browser_navigate',
  description: 'Navigate the browser to a URL.',
  parameters: z.object({
    url: z.string().describe('The URL to navigate to'),
  }),
  async execute(args, ctx) {
    const browser = await ctx.getBrowser();
    const page = await browser.getPage();
    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const title = await page.title();
    return { type: 'text', content: `Navigated to: ${args.url}\nPage title: ${title}` };
  },
};
