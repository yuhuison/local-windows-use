import { ToolRegistry } from './registry.js';
import { screenshotTool } from './windows/screenshot.js';
import { mouseClickTool, mouseMoveTool, mouseScrollTool } from './windows/mouse.js';
import { keyboardTypeTool, keyboardPressTool } from './windows/keyboard.js';
import { clipboardTypeTool, switchInputMethodTool } from './windows/clipboard.js';
import { listWindowsTool, focusWindowTool, windowScreenshotTool } from './windows/window.js';
import { runCommandTool } from './windows/command.js';
import { fileReadTool } from './file/read.js';
import { fileWriteTool } from './file/write.js';
import { useLocalImageTool } from './file/image.js';
import { browserNavigateTool } from './browser/navigate.js';
import { browserClickTool } from './browser/click.js';
import { browserTypeTool } from './browser/type.js';
import { browserScreenshotTool } from './browser/screenshot.js';
import { browserContentTool } from './browser/content.js';
import { browserScrollTool } from './browser/scroll.js';
import { reportTool } from './control/report.js';

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Windows tools
  registry.register(screenshotTool);
  registry.register(mouseClickTool);
  registry.register(mouseMoveTool);
  registry.register(mouseScrollTool);
  registry.register(keyboardTypeTool);
  registry.register(keyboardPressTool);
  registry.register(clipboardTypeTool);
  registry.register(switchInputMethodTool);
  registry.register(listWindowsTool);
  registry.register(focusWindowTool);
  registry.register(windowScreenshotTool);
  registry.register(runCommandTool);

  // File tools
  registry.register(fileReadTool);
  registry.register(fileWriteTool);
  registry.register(useLocalImageTool);

  // Browser tools
  registry.register(browserNavigateTool);
  registry.register(browserClickTool);
  registry.register(browserTypeTool);
  registry.register(browserScreenshotTool);
  registry.register(browserContentTool);
  registry.register(browserScrollTool);

  // Control tools
  registry.register(reportTool);

  return registry;
}
