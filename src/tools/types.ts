import type { z } from 'zod';

export interface ToolContext {
  sessionId: string;
  cdpUrl: string;
  /** Lazy browser client getter — only connects on first call */
  getBrowser: () => Promise<import('./browser/client.js').BrowserClient>;
}

export type ToolResult =
  | { type: 'text'; content: string }
  | { type: 'image'; base64: string; mimeType: 'image/png' | 'image/jpeg' }
  | {
      type: 'report';
      status: 'completed' | 'blocked' | 'need_guidance';
      summary: string;
      screenshot?: string;
      data?: unknown;
    };

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType;
  execute(args: any, context: ToolContext): Promise<ToolResult>;
}
