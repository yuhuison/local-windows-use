import { z } from 'zod';
import sharp from 'sharp';
import type { ToolDefinition } from '../types.js';
import { addCoordinateGrid } from './grid-overlay.js';

async function getNutJs() {
  return import('@nut-tree-fork/nut-js');
}

async function getNodeScreenshots() {
  return import('node-screenshots');
}

function findWindowByTitle(windows: any[], title: string) {
  const lower = title.toLowerCase();
  // Exact match first
  const exact = windows.find(
    (w: any) => w.title().toLowerCase() === lower,
  );
  if (exact) return exact;
  // Partial match
  return windows.find((w: any) =>
    w.title().toLowerCase().includes(lower),
  );
}

export const listWindowsTool: ToolDefinition = {
  name: 'list_windows',
  description:
    'List all visible windows with their titles, positions, and sizes.',
  parameters: z.object({}),
  async execute() {
    const { Window } = await getNodeScreenshots();
    const windows = Window.all();
    const list = windows
      .filter((w: any) => w.title().trim().length > 0)
      .map((w: any) => ({
        id: w.id(),
        title: w.title(),
        appName: w.appName(),
        x: w.x(),
        y: w.y(),
        width: w.width(),
        height: w.height(),
        isMinimized: w.isMinimized(),
        isFocused: w.isFocused(),
      }));

    const formatted = list
      .map(
        (w: any) =>
          `[${w.isFocused ? '*' : ' '}] "${w.title}" (${w.appName}) — pos:(${w.x},${w.y}) size:${w.width}x${w.height}${w.isMinimized ? ' [minimized]' : ''}`,
      )
      .join('\n');

    return {
      type: 'text',
      content: `Found ${list.length} windows:\n${formatted}`,
    };
  },
};

export const focusWindowTool: ToolDefinition = {
  name: 'focus_window',
  description:
    'Focus (activate) a window by its title. Uses partial, case-insensitive matching.',
  parameters: z.object({
    title: z.string().describe('Window title to search for (partial match)'),
  }),
  async execute(args) {
    const nut = await getNutJs();
    const windows = await nut.getWindows();

    const lower = args.title.toLowerCase();
    let target: any = null;
    for (const w of windows) {
      const t = await w.title;
      if (t.toLowerCase() === lower) {
        target = w;
        break;
      }
      if (!target && t.toLowerCase().includes(lower)) {
        target = w;
      }
    }

    if (!target) {
      return {
        type: 'text',
        content: `Error: No window found matching "${args.title}"`,
      };
    }

    const title = await target.title;
    await target.focus();
    return { type: 'text', content: `Focused window: "${title}"` };
  },
};

export const windowScreenshotTool: ToolDefinition = {
  name: 'window_screenshot',
  description:
    'Capture a screenshot of a specific window by its title. The coordinate grid shows screen-absolute coordinates (matching mouse_click). Returns a screenshot ID.',
  parameters: z.object({
    title: z.string().describe('Window title to search for (partial match)'),
  }),
  async execute(args, ctx) {
    const { Window, Monitor } = await getNodeScreenshots();
    const windows = Window.all().filter(
      (w: any) => w.title().trim().length > 0,
    );
    const target = findWindowByTitle(windows, args.title);

    if (!target) {
      return {
        type: 'text',
        content: `Error: No window found matching "${args.title}"`,
      };
    }

    const winTitle = target.title();
    const winX = target.x();
    const winY = target.y();

    const image = target.captureImageSync();
    const physW = image.width;
    const physH = image.height;

    // Get DPI scale from the monitor this window is on
    const monitor = target.currentMonitor();
    const scaleFactor: number = monitor ? monitor.scaleFactor() : 1;

    const logicalW = Math.round(physW / scaleFactor);
    const logicalH = Math.round(physH / scaleFactor);

    // Resize to logical resolution
    const raw = image.toRawSync();
    const resized = await sharp(raw, {
      raw: { width: physW, height: physH, channels: 4 },
    })
      .resize(logicalW, logicalH)
      .jpeg({ quality: 70 })
      .toBuffer();

    // Clean version for report
    const cleanBase64 = resized.toString('base64');
    const id = ctx.screenshots.save(
      cleanBase64,
      'image/jpeg',
      `window: ${winTitle}`,
    );

    // Grid version with screen-absolute coordinates
    const { image: gridImage, gridRef } = await addCoordinateGrid(resized, logicalW, logicalH, {
      offsetX: winX,
      offsetY: winY,
    });
    const gridBase64 = gridImage.toString('base64');

    return {
      type: 'image',
      base64: gridBase64,
      mimeType: 'image/jpeg',
      screenshotId: id,
      content: gridRef,
    };
  },
};
