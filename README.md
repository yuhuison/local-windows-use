<p align="center">
  <h1 align="center">windows-use</h1>
  <p align="center">
    <strong>Save 90% context — let cheap models do the clicking.</strong>
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/windows-use"><img src="https://img.shields.io/npm/v/windows-use.svg" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/windows-use"><img src="https://img.shields.io/npm/dm/windows-use.svg" alt="npm downloads"></a>
    <a href="https://github.com/yuhuison/local-windows-use/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/windows-use.svg" alt="license"></a>
    <a href="https://github.com/yuhuison/local-windows-use"><img src="https://img.shields.io/github/stars/yuhuison/local-windows-use.svg?style=social" alt="GitHub stars"></a>
  </p>
</p>

---

## The Problem

When AI agents operate Windows or browsers, **every screenshot eats 1000+ tokens**. A single "open Chrome and search something" task can burn through 10K–50K tokens of your expensive model's context — just on screenshots and tool calls.

**That's like hiring a CEO to move the mouse.**

## The Solution

`windows-use` introduces a **"big model directs, small model executes"** architecture:

| | Without windows-use | With windows-use |
|---|---|---|
| **Who clicks?** | Claude / GPT-4o (expensive) | Qwen, GPT-4o-mini, DeepSeek (cheap) |
| **Context cost per task** | 10K–50K tokens of screenshots | ~200 tokens (text summary) |
| **What big model sees** | Raw screenshots + coordinates | Clean text report + optional images |
| **Cost** | $$$ | ¢ |

```
Big Model                    windows-use                    Small Model
   │                              │                              │
   ├─ create_session ────────►    │                              │
   │                              │                              │
   ├─ send_instruction ──────►    │  ── tools + instruction ──► │
   │                              │     screenshot → analyze     │
   │                              │     → click → verify → ...   │
   │                              │  ◄── report ──────────────── │
   │  ◄── text + images ──────   │                              │
   │                              │                              │
   ├─ done_session ──────────►    │  cleanup                     │
```

Your big model just says *"open Notepad and type Hello"* — the small model handles all the screenshots, clicking, and verification autonomously, then reports back a concise summary.

## Key Features

- **Context savings** — Keep your expensive model's context window for reasoning, not screenshots
- **Any OpenAI-compatible model** — Qwen, DeepSeek, Ollama, vLLM, GPT-4o-mini, or any local model
- **16 built-in tools** — Screen capture with coordinate grid, mouse, keyboard, browser automation, file I/O
- **Real Chrome via CDP** — Uses your existing cookies, login state, and extensions (no webdriver detection)
- **MCP server** — Drop-in integration with Claude Desktop, VS Code, and any MCP client
- **Rich reports** — Text + embedded screenshots, so the big model sees exactly what it needs
- **CLI + REPL + API** — Use from terminal, interactively, or programmatically

## Install

```bash
npm install -g windows-use
```

## Quick Start

```bash
# Interactive setup — saves config to ~/.windows-use.json
windows-use init

# Export config as a shareable base64 string
windows-use init --export

# Import config from a base64 string
windows-use init eyJiYXNlVVJMIjoiaHR0cHM6Ly...
```

You'll be prompted for:
- **Base URL** — any OpenAI-compatible endpoint (Qwen, DeepSeek, Ollama, vLLM, etc.)
- **API Key**
- **Model name** — e.g. `qwen3.5-flash`, `gpt-4o-mini`

## Usage

### CLI Mode

```bash
# Single task
windows-use "Open Notepad and type Hello World"

# Interactive REPL session
windows-use
> Open Chrome and go to github.com
> Find the trending repositories
> exit

# With explicit config flags
windows-use --api-key sk-xxx --base-url https://api.example.com/v1 --model gpt-4o-mini "Take a screenshot"
```

CLI shows real-time step-by-step progress:

```
> Take a screenshot of the desktop
[windows-use] Running...

  [step 1] 🔧 screenshot
  [step 1] 📎 Screenshot captured (img_1)
  [step 1] 💭 I can see the Windows desktop with...
  [step 2] 🔧 report { status: 'completed', content: '...' }

✅ [completed]
Here is the current desktop:
   📸 desktop: http://127.0.0.1:54321/s1.jpg
```

### MCP Server Mode

```bash
windows-use --mcp
```

Exposes 3 tools over MCP (stdio transport):

| Tool | Description |
|------|-------------|
| `create_session` | Create a new agent session. Returns `session_id`. |
| `send_instruction` | Send a task to the agent. Returns rich report with text + images. |
| `done_session` | Terminate a session and free resources. |

## MCP Client Configuration

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "windows-use": {
      "command": "npx",
      "args": ["-y", "windows-use", "--mcp"],
      "env": {
        "WINDOWS_USE_API_KEY": "sk-xxx",
        "WINDOWS_USE_BASE_URL": "https://your-api.com/v1",
        "WINDOWS_USE_MODEL": "qwen3.5-flash"
      }
    }
  }
}
```

### VS Code (Claude Code / Copilot Chat)

Add to `.vscode/settings.json` or global settings:

```json
{
  "mcp": {
    "servers": {
      "windows-use": {
        "command": "npx",
        "args": ["-y", "windows-use", "--mcp"],
        "env": {
          "WINDOWS_USE_API_KEY": "sk-xxx",
          "WINDOWS_USE_BASE_URL": "https://your-api.com/v1",
          "WINDOWS_USE_MODEL": "qwen3.5-flash"
        }
      }
    }
  }
}
```

> If you've run `windows-use init`, the config is saved in `~/.windows-use.json` and you can omit the `env` block entirely.

## Configuration

Config priority: **CLI flags > environment variables > `~/.windows-use.json` > defaults**

| Option | CLI Flag | Env Var | Default |
|--------|----------|---------|---------|
| API Key | `--api-key` | `WINDOWS_USE_API_KEY` | — (required) |
| Base URL | `--base-url` | `WINDOWS_USE_BASE_URL` | — (required) |
| Model | `--model` | `WINDOWS_USE_MODEL` | — (required) |
| CDP URL | `--cdp-url` | `WINDOWS_USE_CDP_URL` | `http://localhost:9222` |
| Max Steps | `--max-steps` | `WINDOWS_USE_MAX_STEPS` | `50` |
| Max Rounds | `--max-rounds` | `WINDOWS_USE_MAX_ROUNDS` | `20` |
| Timeout | — | `WINDOWS_USE_TIMEOUT_MS` | `300000` (5 min) |

- **Max Steps** — tool-calling rounds per instruction (how many actions the small model can take for one task)
- **Max Rounds** — instruction rounds per session (how many `send_instruction` calls before the session expires)

## Browser Setup

Browser tools connect to your real Chrome via CDP. Start Chrome with remote debugging:

```bash
# Windows
chrome.exe --remote-debugging-port=9222

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

Uses your existing cookies, login state, and extensions — no webdriver detection flags.

## Small Model Tools

The small model agent has access to 16 tools:

### Screen & Input

| Tool | Description |
|------|-------------|
| `screenshot` | Full-screen capture with **coordinate grid overlay** (auto-scaled to logical resolution, grid coordinates match mouse_click) |
| `mouse_click(x, y, button)` | Click at screen coordinates |
| `mouse_move(x, y)` | Move mouse without clicking |
| `mouse_scroll(direction, amount)` | Scroll up/down |
| `keyboard_type(text)` | Type text character by character |
| `keyboard_press(keys)` | Key combos like `["Ctrl", "C"]`, `["Alt", "F4"]` |
| `run_command(command)` | Execute shell command (PowerShell on Windows) |

### Browser

| Tool | Description |
|------|-------------|
| `browser_navigate(url)` | Open a URL |
| `browser_click(selector)` | Click element by CSS selector or `text=...` |
| `browser_type(selector, text)` | Type into input field |
| `browser_screenshot(fullPage?)` | Page screenshot (JPEG quality 70) |
| `browser_content` | Get visible text content of page |
| `browser_scroll(direction, amount)` | Scroll page |

### File & Image

| Tool | Description |
|------|-------------|
| `file_read(path)` | Read file contents |
| `file_write(path, content)` | Write file |
| `use_local_image(path)` | Load a local image and get a screenshot ID for embedding in reports |

### Control

| Tool | Description |
|------|-------------|
| `report(status, content)` | Submit a rich report and stop execution |

### Rich Reports

Each screenshot tool returns an ID (e.g. `img_1`, `img_2`). The `report` tool supports a rich document format — mix text with embedded screenshots using `[Image:img_X]` markers:

```
report({
  status: "completed",
  content: "Here's what I found:\n[Image:img_2]\nThe page shows search results.\n[Image:img_3]\nI also checked the sidebar."
})
```

When delivered to the user (CLI) or big model (MCP), these markers expand into actual multimodal image content.

## Programmatic API

```typescript
import { loadConfig, SessionRegistry } from 'windows-use';

const config = loadConfig({
  apiKey: 'sk-xxx',
  baseURL: 'https://api.example.com/v1',
  model: 'qwen3.5-flash',
});

const registry = new SessionRegistry();
const session = registry.create(config);

// Real-time step events
session.runner.setOnStep((event) => {
  if (event.type === 'tool_call') console.log(`Step ${event.step}: ${event.name}`);
  if (event.type === 'thinking') console.log(`Step ${event.step}: ${event.content}`);
});

const result = await session.runner.run('Open calculator and compute 2+2');
console.log(result.status);  // 'completed' | 'blocked' | 'need_guidance'
console.log(result.content); // Rich text with [Image:img_X] markers

await registry.destroyAll();
```

## Architecture

```
src/
├── cli.ts                      # CLI entry (single task + interactive REPL)
├── index.ts                    # Public API exports
├── config/                     # Zod config schema + env/file loader
├── mcp/
│   ├── server.ts               # MCP stdio transport
│   ├── tools.ts                # 3 MCP tools (create/send/done)
│   └── session-registry.ts     # Session lifecycle + timeout
├── agent/
│   ├── runner.ts               # Tool-calling loop + step events
│   ├── llm-client.ts           # OpenAI SDK wrapper (any compatible endpoint)
│   ├── context-manager.ts      # Full message history
│   └── system-prompt.ts        # Small model system prompt
└── tools/
    ├── windows/                # screenshot (with grid), mouse, keyboard, command
    ├── browser/                # navigate, click, type, screenshot, content, scroll
    ├── file/                   # read, write, use_local_image
    └── control/                # report
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
