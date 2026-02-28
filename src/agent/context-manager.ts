import type OpenAI from 'openai';

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/**
 * Sliding window message history.
 * Always keeps: system prompt (index 0) + most recent N messages.
 */
export class ContextManager {
  private messages: Message[] = [];
  private readonly maxMessages: number;

  constructor(maxMessages: number) {
    this.maxMessages = maxMessages;
  }

  append(message: Message): void {
    this.messages.push(message);
  }

  /** Returns the system prompt + the most recent messages within the window. */
  getWindow(): Message[] {
    if (this.messages.length === 0) return [];

    const systemPrompt = this.messages[0]?.role === 'system' ? this.messages[0] : null;
    const nonSystem = systemPrompt ? this.messages.slice(1) : this.messages;

    // Keep the most recent messages within the window
    const windowSize = this.maxMessages - (systemPrompt ? 1 : 0);
    const windowed = nonSystem.length > windowSize
      ? nonSystem.slice(-windowSize)
      : nonSystem;

    return systemPrompt ? [systemPrompt, ...windowed] : windowed;
  }

  /** Total messages stored (before windowing). */
  get length(): number {
    return this.messages.length;
  }
}
