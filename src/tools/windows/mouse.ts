import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

async function getNutJs() {
  return import('@nut-tree-fork/nut-js');
}

export const mouseClickTool: ToolDefinition = {
  name: 'mouse_click',
  description: 'Click the mouse at the given screen coordinates.',
  parameters: z.object({
    x: z.number().describe('X coordinate on screen'),
    y: z.number().describe('Y coordinate on screen'),
    button: z.enum(['left', 'right', 'middle']).default('left').describe('Mouse button'),
  }),
  async execute(args) {
    const nut = await getNutJs();
    const point = new nut.Point(args.x, args.y);
    await nut.mouse.move(nut.straightTo(point));

    const buttonMap = {
      left: nut.Button.LEFT,
      right: nut.Button.RIGHT,
      middle: nut.Button.MIDDLE,
    };
    await nut.mouse.click(buttonMap[args.button]);

    return { type: 'text', content: `Clicked ${args.button} at (${args.x}, ${args.y})` };
  },
};

export const mouseMoveTool: ToolDefinition = {
  name: 'mouse_move',
  description: 'Move the mouse to the given screen coordinates without clicking.',
  parameters: z.object({
    x: z.number().describe('X coordinate on screen'),
    y: z.number().describe('Y coordinate on screen'),
  }),
  async execute(args) {
    const nut = await getNutJs();
    const point = new nut.Point(args.x, args.y);
    await nut.mouse.move(nut.straightTo(point));
    return { type: 'text', content: `Mouse moved to (${args.x}, ${args.y})` };
  },
};

export const mouseScrollTool: ToolDefinition = {
  name: 'mouse_scroll',
  description: 'Scroll the mouse wheel.',
  parameters: z.object({
    direction: z.enum(['up', 'down']).describe('Scroll direction'),
    amount: z.number().positive().default(3).describe('Number of scroll steps'),
  }),
  async execute(args) {
    const nut = await getNutJs();
    for (let i = 0; i < args.amount; i++) {
      if (args.direction === 'down') {
        await nut.mouse.scrollDown(1);
      } else {
        await nut.mouse.scrollUp(1);
      }
    }
    return { type: 'text', content: `Scrolled ${args.direction} ${args.amount} steps` };
  },
};
