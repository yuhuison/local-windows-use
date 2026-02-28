import type { Browser, BrowserContext, Page } from 'playwright';

/**
 * Manages a Playwright CDP connection to the user's Chrome.
 * Lazy-initialized: only connects when first browser tool is called.
 */
export class BrowserClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private _page: Page | null = null;
  private cdpUrl: string;

  constructor(cdpUrl: string) {
    this.cdpUrl = cdpUrl;
  }

  async connect(): Promise<void> {
    if (this.browser) return;

    const { chromium } = await import('playwright');
    this.browser = await chromium.connectOverCDP(this.cdpUrl);

    const contexts = this.browser.contexts();
    this.context = contexts[0] ?? await this.browser.newContext();

    const pages = this.context.pages();
    this._page = pages[0] ?? await this.context.newPage();
  }

  async getPage(): Promise<Page> {
    await this.connect();
    return this._page!;
  }

  /** Create a new tab and switch to it. */
  async newPage(): Promise<Page> {
    await this.connect();
    this._page = await this.context!.newPage();
    return this._page;
  }

  async close(): Promise<void> {
    if (this.browser) {
      // Only disconnect — don't close the user's Chrome
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.context = null;
      this._page = null;
    }
  }

  get connected(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }
}
