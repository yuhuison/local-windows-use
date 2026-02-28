import crypto from 'crypto';
import type { Config } from '../config/schema.js';
import { ContextManager } from '../agent/context-manager.js';
import { LLMClient } from '../agent/llm-client.js';
import { AgentRunner } from '../agent/runner.js';
import { BrowserClient } from '../tools/browser/client.js';
import { createToolRegistry } from '../tools/index.js';
import type { ToolContext } from '../tools/types.js';

export interface Session {
  id: string;
  createdAt: Date;
  lastActivityAt: Date;
  config: Config;
  runner: AgentRunner;
  browserClient: BrowserClient;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

export class SessionRegistry {
  private sessions = new Map<string, Session>();

  create(config: Config): Session {
    const id = crypto.randomUUID();
    const contextManager = new ContextManager(config.contextWindowSize);
    const llmClient = new LLMClient(config);
    const browserClient = new BrowserClient(config.cdpUrl);
    const toolRegistry = createToolRegistry();

    const toolContext: ToolContext = {
      sessionId: id,
      cdpUrl: config.cdpUrl,
      getBrowser: () => {
        // Lazy connection
        return browserClient.connect().then(() => browserClient);
      },
    };

    const runner = new AgentRunner(
      llmClient,
      contextManager,
      toolRegistry,
      config,
      toolContext,
    );

    const timeoutHandle = setTimeout(
      () => this.destroy(id),
      config.timeoutMs,
    );

    const session: Session = {
      id,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      config,
      runner,
      browserClient,
      timeoutHandle,
    };

    this.sessions.set(id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  touch(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.lastActivityAt = new Date();
    clearTimeout(session.timeoutHandle);
    session.timeoutHandle = setTimeout(
      () => this.destroy(id),
      session.config.timeoutMs,
    );
  }

  async destroy(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    clearTimeout(session.timeoutHandle);
    await session.browserClient.close().catch(() => {});
    this.sessions.delete(id);
  }

  async destroyAll(): Promise<void> {
    await Promise.allSettled(
      [...this.sessions.keys()].map((id) => this.destroy(id)),
    );
  }
}
