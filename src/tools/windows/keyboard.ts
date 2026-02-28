import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

async function getNutJs() {
  return import('@nut-tree-fork/nut-js');
}

export const keyboardTypeTool: ToolDefinition = {
  name: 'keyboard_type',
  description: 'Type text using the keyboard. The text is typed character by character.',
  parameters: z.object({
    text: z.string().describe('The text to type'),
  }),
  async execute(args) {
    const nut = await getNutJs();
    await nut.keyboard.type(args.text);
    return { type: 'text', content: `Typed: "${args.text}"` };
  },
};

/**
 * Map common key names to nut-js Key enum values.
 */
function resolveKey(nut: any, keyName: string): number {
  const keyMap: Record<string, string> = {
    'ctrl': 'LeftControl',
    'control': 'LeftControl',
    'shift': 'LeftShift',
    'alt': 'LeftAlt',
    'meta': 'LeftWin',
    'win': 'LeftWin',
    'windows': 'LeftWin',
    'enter': 'Return',
    'return': 'Return',
    'tab': 'Tab',
    'escape': 'Escape',
    'esc': 'Escape',
    'backspace': 'Backspace',
    'delete': 'Delete',
    'space': 'Space',
    'up': 'Up',
    'down': 'Down',
    'left': 'Left',
    'right': 'Right',
    'home': 'Home',
    'end': 'End',
    'pageup': 'PageUp',
    'pagedown': 'PageDown',
    'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4',
    'f5': 'F5', 'f6': 'F6', 'f7': 'F7', 'f8': 'F8',
    'f9': 'F9', 'f10': 'F10', 'f11': 'F11', 'f12': 'F12',
  };

  const normalized = keyName.toLowerCase().trim();
  const mapped = keyMap[normalized] ?? keyName;

  // Try to find in the Key enum
  const key = nut.Key[mapped];
  if (key !== undefined) return key;

  // Try uppercase single char (e.g., 'a' -> 'A')
  if (mapped.length === 1) {
    const upper = mapped.toUpperCase();
    const k = nut.Key[upper];
    if (k !== undefined) return k;
  }

  throw new Error(`Unknown key: "${keyName}"`);
}

export const keyboardPressTool: ToolDefinition = {
  name: 'keyboard_press',
  description: 'Press a key combination. Examples: ["Ctrl", "C"] for copy, ["Enter"] for enter, ["Alt", "F4"] to close window.',
  parameters: z.object({
    keys: z.array(z.string()).min(1).describe('Array of key names to press simultaneously'),
  }),
  async execute(args) {
    const nut = await getNutJs();
    const resolved = args.keys.map((k: string) => resolveKey(nut, k));
    await nut.keyboard.pressKey(...resolved);
    await nut.keyboard.releaseKey(...resolved);
    return { type: 'text', content: `Pressed: ${args.keys.join('+')}` };
  },
};
