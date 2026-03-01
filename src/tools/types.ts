import type { z } from 'zod';

export interface StoredScreenshot {
  id: string;
  base64: string;
  mimeType: 'image/png' | 'image/jpeg';
  label: string; // e.g. "desktop", "browser"
}

/**
 * Simple in-memory screenshot store.
 * Screenshot tools save images here with auto-incrementing IDs.
 * Report content references them via [Image:img_1] markers.
 */
export class ScreenshotStore {
  private counter = 0;
  private store = new Map<string, StoredScreenshot>();

  save(base64: string, mimeType: 'image/png' | 'image/jpeg', label: string): string {
    this.counter++;
    const id = `img_${this.counter}`;
    this.store.set(id, { id, base64, mimeType, label });
    return id;
  }

  get(id: string): StoredScreenshot | undefined {
    return this.store.get(id);
  }

  listIds(): string[] {
    return [...this.store.keys()];
  }
}

/** A block in parsed report content */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; id: string; base64: string; mimeType: 'image/png' | 'image/jpeg'; label: string };

/**
 * Parse report content string, expanding [Image:img_X] markers into image blocks.
 * Returns an array of text and image content blocks.
 */
export function parseReportContent(content: string, store: ScreenshotStore): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const regex = /\[Image:(img_\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    // Text before the marker
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', text: content.slice(lastIndex, match.index) });
    }

    const id = match[1];
    const screenshot = store.get(id);
    if (screenshot) {
      blocks.push({
        type: 'image',
        id: screenshot.id,
        base64: screenshot.base64,
        mimeType: screenshot.mimeType,
        label: screenshot.label,
      });
    } else {
      // Unknown ID — keep as text
      blocks.push({ type: 'text', text: match[0] });
    }

    lastIndex = regex.lastIndex;
  }

  // Remaining text after last marker
  if (lastIndex < content.length) {
    blocks.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return blocks;
}

/** Strip [Image:...] markers, returning text-only content */
export function stripImageMarkers(content: string): string {
  return content.replace(/\[Image:img_\d+\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export interface ToolContext {
  sessionId: string;
  cdpUrl: string;
  /** Lazy browser client getter — only connects on first call */
  getBrowser: () => Promise<import('./browser/client.js').BrowserClient>;
  /** Screenshot store — tools save screenshots here, report references by [Image:id] */
  screenshots: ScreenshotStore;
}

export type ToolResult =
  | { type: 'text'; content: string }
  | { type: 'image'; base64: string; mimeType: 'image/png' | 'image/jpeg'; screenshotId: string; content?: string }
  | {
      type: 'report';
      status: 'completed' | 'blocked' | 'need_guidance';
      content: string; // Rich content with [Image:img_1] markers
      data?: unknown;
    };

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType;
  execute(args: any, context: ToolContext): Promise<ToolResult>;
}
