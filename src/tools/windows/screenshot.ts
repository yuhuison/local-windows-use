import { z } from 'zod';
import sharp from 'sharp';
import type { ToolDefinition } from '../types.js';
import { addCoordinateGrid } from './grid-overlay.js';

export const screenshotTool: ToolDefinition = {
  name: 'screenshot',
  description:
    'Capture the full screen with a coordinate grid overlay. The grid shows pixel coordinates that match mouse_click/mouse_move coordinates. Returns a screenshot ID.',
  parameters: z.object({}),
  async execute(_args, ctx) {
    const { Monitor } = await import('node-screenshots');

    const monitors = Monitor.all();
    const primary = monitors.find((m: any) => m.isPrimary()) ?? monitors[0];
    if (!primary) {
      return { type: 'text', content: 'Error: No monitor found' };
    }

    const image = primary.captureImageSync();
    const physW = image.width;
    const physH = image.height;
    const scaleFactor: number = (primary as any).scaleFactor() ?? 1;

    // Logical dimensions (matching OS coordinate system used by nut-js)
    const logicalW = Math.round(physW / scaleFactor);
    const logicalH = Math.round(physH / scaleFactor);

    // Resize to logical resolution using raw RGBA pixels
    const raw = image.toRawSync();
    const resized = await sharp(raw, {
      raw: { width: physW, height: physH, channels: 4 },
    })
      .resize(logicalW, logicalH)
      .jpeg({ quality: 70 })
      .toBuffer();

    // Clean version → ScreenshotStore (for report to user/main model)
    const cleanBase64 = resized.toString('base64');
    const id = ctx.screenshots.save(cleanBase64, 'image/jpeg', 'desktop');

    // Grid version → LLM (for coordinate reference)
    const { image: gridImage, gridRef } = await addCoordinateGrid(resized, logicalW, logicalH);
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
