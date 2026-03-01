import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

async function getNutJs() {
  return import('@nut-tree-fork/nut-js');
}

export const clipboardTypeTool: ToolDefinition = {
  name: 'clipboard_type',
  description:
    'Type text by copying it to the clipboard and pasting (Ctrl+V). This bypasses input method (IME) issues and is faster than keyboard_type. Use this when the current IME might interfere, or for non-ASCII text (Chinese, Japanese, etc.).',
  parameters: z.object({
    text: z.string().describe('The text to paste'),
  }),
  async execute(args) {
    const nut = await getNutJs();
    await nut.clipboard.setContent(args.text);
    await nut.keyboard.pressKey(nut.Key.LeftControl, nut.Key.V);
    await nut.keyboard.releaseKey(nut.Key.LeftControl, nut.Key.V);
    return { type: 'text', content: `Pasted: "${args.text}"` };
  },
};

export const switchInputMethodTool: ToolDefinition = {
  name: 'switch_input_method',
  description:
    'Toggle the input method (IME) by pressing Win+Space. Use this before keyboard_type if the current IME is wrong. Take a screenshot afterward to verify the switch.',
  parameters: z.object({}),
  async execute() {
    const nut = await getNutJs();
    await nut.keyboard.pressKey(nut.Key.LeftWin, nut.Key.Space);
    await nut.keyboard.releaseKey(nut.Key.LeftWin, nut.Key.Space);
    return { type: 'text', content: 'Toggled input method (Win+Space)' };
  },
};
