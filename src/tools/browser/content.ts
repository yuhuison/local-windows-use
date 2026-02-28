import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

const MAX_CONTENT_LENGTH = 20_000;

export const browserContentTool: ToolDefinition = {
  name: 'browser_content',
  description: 'Get the text content of the current web page. Returns visible text, not HTML.',
  parameters: z.object({}),
  async execute(_args, ctx) {
    const browser = await ctx.getBrowser();
    const page = await browser.getPage();
    const url = page.url();
    const title = await page.title();
    let text = await page.innerText('body').catch(() => '');

    if (text.length > MAX_CONTENT_LENGTH) {
      text = text.slice(0, MAX_CONTENT_LENGTH) + '\n...(truncated)';
    }

    return {
      type: 'text',
      content: `URL: ${url}\nTitle: ${title}\n\n${text}`,
    };
  },
};
