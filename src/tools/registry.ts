import type { ToolDefinition, ToolContext, ToolResult } from './types.js';
import { zodToJsonSchema } from './zod-to-json.js';
import type OpenAI from 'openai';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  toOpenAIFormat(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters),
      },
    }));
  }

  async execute(
    name: string,
    args: unknown,
    context: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { type: 'text', content: `Error: unknown tool "${name}"` };
    }

    const parsed = tool.parameters.safeParse(args);
    if (!parsed.success) {
      return {
        type: 'text',
        content: `Error: invalid arguments for "${name}": ${parsed.error.message}`,
      };
    }

    return tool.execute(parsed.data, context);
  }
}
