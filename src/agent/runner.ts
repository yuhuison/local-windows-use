import type OpenAI from 'openai';
import type { Config } from '../config/schema.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { ToolContext, ToolResult } from '../tools/types.js';
import { ContextManager } from './context-manager.js';
import { LLMClient } from './llm-client.js';
import { buildSystemPrompt } from './system-prompt.js';

export interface RunResult {
  status: 'completed' | 'blocked' | 'need_guidance';
  summary: string;
  screenshot?: string;
  data?: unknown;
  stepsUsed: number;
}

export class AgentRunner {
  private llmClient: LLMClient;
  private contextManager: ContextManager;
  private toolRegistry: ToolRegistry;
  private config: Config;
  private toolContext: ToolContext;
  private initialized = false;

  constructor(
    llmClient: LLMClient,
    contextManager: ContextManager,
    toolRegistry: ToolRegistry,
    config: Config,
    toolContext: ToolContext,
  ) {
    this.llmClient = llmClient;
    this.contextManager = contextManager;
    this.toolRegistry = toolRegistry;
    this.config = config;
    this.toolContext = toolContext;
  }

  async run(instruction: string): Promise<RunResult> {
    // Inject system prompt on first run
    if (!this.initialized) {
      this.contextManager.append({
        role: 'system',
        content: buildSystemPrompt(),
      });
      this.initialized = true;
    }

    // Add the instruction as a user message
    this.contextManager.append({
      role: 'user',
      content: instruction,
    });

    let stepsUsed = 0;

    while (stepsUsed < this.config.maxSteps) {
      stepsUsed++;
      const remaining = this.config.maxSteps - stepsUsed;

      const messages = this.contextManager.getWindow();

      // Warn the model when steps are running low
      if (remaining <= 3 && remaining >= 0) {
        messages.push({
          role: 'system',
          content: `⚠️ You have ${remaining} steps remaining. Call \`report\` NOW to summarize your progress. If you do not call report, your work will be lost.`,
        });
      }

      const tools = this.toolRegistry.toOpenAIFormat();

      let response: OpenAI.Chat.Completions.ChatCompletion;
      try {
        response = await this.llmClient.chat(messages, tools);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          status: 'blocked',
          summary: `LLM API error: ${msg}`,
          stepsUsed,
        };
      }

      const choice = response.choices[0];
      if (!choice) {
        return {
          status: 'blocked',
          summary: 'LLM returned empty response',
          stepsUsed,
        };
      }

      const message = choice.message;

      // If model stops without tool calls, treat as implicit report
      if (choice.finish_reason === 'stop' || !message.tool_calls?.length) {
        const text = message.content ?? '';
        this.contextManager.append({ role: 'assistant', content: text });
        return {
          status: 'need_guidance',
          summary: text || 'Agent stopped without calling report.',
          stepsUsed,
        };
      }

      // Append assistant message with tool_calls to history
      this.contextManager.append(message as any);

      // Process tool calls sequentially
      for (const toolCall of message.tool_calls) {
        let args: unknown;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          this.contextManager.append({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'Error: could not parse tool arguments as JSON',
          });
          continue;
        }

        let result: ToolResult;
        try {
          result = await this.toolRegistry.execute(
            toolCall.function.name,
            args,
            this.toolContext,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.contextManager.append({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Error executing tool: ${msg}`,
          });
          continue;
        }

        // Check for report signal — the only clean exit
        if (result.type === 'report') {
          this.contextManager.append({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'Report submitted. Returning control to caller.',
          });
          return {
            status: result.status,
            summary: result.summary,
            screenshot: result.screenshot,
            data: result.data,
            stepsUsed,
          };
        }

        // Image results: send as multimodal content
        if (result.type === 'image') {
          this.contextManager.append({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: [
              { type: 'text', text: 'Screenshot captured.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${result.mimeType};base64,${result.base64}`,
                },
              },
            ],
          } as any);
        } else {
          // Text results
          this.contextManager.append({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.content,
          });
        }
      }
    }

    // Max steps exceeded
    return {
      status: 'blocked',
      summary: `Exceeded maximum steps limit (${this.config.maxSteps}). Task may be incomplete.`,
      stepsUsed,
    };
  }
}
