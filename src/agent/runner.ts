import type OpenAI from 'openai';
import type { Config } from '../config/schema.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { ToolContext, ToolResult } from '../tools/types.js';
import { ContextManager } from './context-manager.js';
import { LLMClient } from './llm-client.js';
import { buildSystemPrompt } from './system-prompt.js';

export interface RunResult {
  status: 'completed' | 'blocked' | 'need_guidance';
  /** Rich content with [Image:img_X] markers. Use parseReportContent() to expand. */
  content: string;
  data?: unknown;
  stepsUsed: number;
}

export type StepEvent =
  | { type: 'thinking'; step: number; content: string }
  | { type: 'tool_call'; step: number; name: string; args: unknown }
  | { type: 'tool_result'; step: number; name: string; result: string }
  | { type: 'error'; step: number; message: string };

export type OnStepCallback = (event: StepEvent) => void;

export class AgentRunner {
  private llmClient: LLMClient;
  private contextManager: ContextManager;
  private toolRegistry: ToolRegistry;
  private config: Config;
  private toolContext: ToolContext;
  private initialized = false;
  private onStep: OnStepCallback | null = null;
  private roundsUsed = 0;

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

  /** Register a callback to receive step-by-step progress events */
  setOnStep(cb: OnStepCallback): void {
    this.onStep = cb;
  }

  private emit(event: StepEvent): void {
    this.onStep?.(event);
  }

  /** How many instruction rounds have been used in this session */
  get currentRound(): number {
    return this.roundsUsed;
  }

  /** Whether this session has exhausted its max rounds */
  get roundsExhausted(): boolean {
    return this.roundsUsed >= this.config.maxRounds;
  }

  async run(instruction: string): Promise<RunResult> {
    // Check round limit
    if (this.roundsExhausted) {
      return {
        status: 'blocked',
        content: `Session has reached the maximum number of instruction rounds (${this.config.maxRounds}). Create a new session to continue.`,
        stepsUsed: 0,
      };
    }

    this.roundsUsed++;

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

      const messages = this.contextManager.getMessages();

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
        this.emit({ type: 'error', step: stepsUsed, message: `LLM API error: ${msg}` });
        return {
          status: 'blocked',
          content: `LLM API error: ${msg}`,
          stepsUsed,
        };
      }

      const choice = response.choices[0];
      if (!choice) {
        return {
          status: 'blocked',
          content: 'LLM returned empty response',
          stepsUsed,
        };
      }

      const message = choice.message;

      // If model has text content (thinking), emit it
      if (message.content) {
        this.emit({ type: 'thinking', step: stepsUsed, content: message.content });
      }

      // If model stops without tool calls, treat as implicit report
      if (choice.finish_reason === 'stop' || !message.tool_calls?.length) {
        const text = message.content ?? '';
        this.contextManager.append({ role: 'assistant', content: text });
        return {
          status: 'need_guidance',
          content: text || 'Agent stopped without calling report.',
          stepsUsed,
        };
      }

      // Append assistant message with tool_calls to history
      this.contextManager.append(message as any);

      // Process tool calls sequentially
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        let args: unknown;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          this.emit({ type: 'error', step: stepsUsed, message: `Failed to parse args for ${toolName}` });
          this.contextManager.append({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'Error: could not parse tool arguments as JSON',
          });
          continue;
        }

        this.emit({ type: 'tool_call', step: stepsUsed, name: toolName, args });

        let result: ToolResult;
        try {
          result = await this.toolRegistry.execute(
            toolName,
            args,
            this.toolContext,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.emit({ type: 'error', step: stepsUsed, message: `${toolName} failed: ${msg}` });
          this.contextManager.append({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Error executing tool: ${msg}`,
          });
          continue;
        }

        // Check for report signal — the only clean exit
        if (result.type === 'report') {
          this.emit({ type: 'tool_result', step: stepsUsed, name: toolName, result: `[${result.status}] report submitted` });
          this.contextManager.append({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: 'Report submitted. Returning control to caller.',
          });
          return {
            status: result.status,
            content: result.content,
            data: result.data,
            stepsUsed,
          };
        }

        // Image results: send as multimodal content with screenshot ID
        if (result.type === 'image') {
          this.emit({ type: 'tool_result', step: stepsUsed, name: toolName, result: `Screenshot captured (${result.screenshotId})` });
          const textPart = result.content
            ? `Screenshot captured. ID: ${result.screenshotId}\n${result.content}`
            : `Screenshot captured. ID: ${result.screenshotId}`;
          this.contextManager.append({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: [
              { type: 'text', text: textPart },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${result.mimeType};base64,${result.base64}`,
                },
              },
            ],
          } as any);
        } else {
          // Text results — truncate for display
          const preview = result.content.length > 200
            ? result.content.slice(0, 200) + '...'
            : result.content;
          this.emit({ type: 'tool_result', step: stepsUsed, name: toolName, result: preview });
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
      content: `Exceeded maximum steps limit (${this.config.maxSteps}). Task may be incomplete.`,
      stepsUsed,
    };
  }
}
