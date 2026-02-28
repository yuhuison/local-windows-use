# windows-use

Let big LLMs delegate Windows/browser automation to small LLMs via sessions.

When AI agents use tools to operate Windows or browsers, screenshots and other multimodal returns consume massive context. This project solves that by having a big model (Claude, GPT, etc.) direct a small model (Qwen, etc.) through sessions — the small model does the actual work and reports back concise text summaries.

```
Big Model                    windows-use                    Small Model
   │                              │                              │
   ├─ create_session ────────►    │                              │
   │                              │                              │
   ├─ send_instruction ──────►    │  ── tools + instruction ──► │
   │                              │  ◄── report (summary) ────── │
   │  ◄── text summary ──────    │                              │
   │                              │                              │
   ├─ done_session ──────────►    │  cleanup                     │
```

## Install

```bash
npm install -g windows-use
```

## Configuration

Set these environment variables (or pass as CLI flags / MCP tool params):

```bash
export WINDOWS_USE_API_KEY=your-api-key
export WINDOWS_USE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
export WINDOWS_USE_MODEL=qwen3.5-flash
```

Any OpenAI-compatible endpoint works (Qwen, DeepSeek, Ollama, vLLM, etc.).

## Usage

### CLI Mode

```bash
# Run a single task
windows-use "Open Notepad and type Hello World"

# With explicit config
windows-use --api-key sk-xxx --base-url https://api.example.com/v1 --model gpt-4o "Take a screenshot"
```

### MCP Server Mode

```bash
windows-use --mcp
```

Add to Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "windows-use": {
      "command": "npx",
      "args": ["-y", "windows-use", "--mcp"],
      "env": {
        "WINDOWS_USE_API_KEY": "your-key",
        "WINDOWS_USE_BASE_URL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "WINDOWS_USE_MODEL": "qwen3.5-flash"
      }
    }
  }
}
```

The MCP server exposes 3 tools:

| Tool | Description |
|------|-------------|
| `create_session` | Create a new agent session. Returns `session_id`. |
| `send_instruction` | Send a task to the agent. Returns status + summary. |
| `done_session` | Terminate a session and free resources. |

### Programmatic Usage

```typescript
import { loadConfig, SessionRegistry } from 'windows-use';

const config = loadConfig({
  apiKey: 'sk-xxx',
  baseURL: 'https://api.example.com/v1',
  model: 'qwen3.5-flash',
});

const registry = new SessionRegistry();
const session = registry.create(config);

const result = await session.runner.run('Open calculator and compute 2+2');
console.log(result.summary);

await registry.destroy(session.id);
```

## Browser Automation

Browser tools connect to your real Chrome via CDP. Start Chrome with remote debugging enabled:

```bash
# Windows
m

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

This uses your existing cookies, login state, and extensions — no automation detection flags.

## Small Model Tools

The small model agent has access to these tools:

**Windows**
- `screenshot` — Capture full screen
- `mouse_click` / `mouse_move` / `mouse_scroll` — Mouse control
- `keyboard_type` / `keyboard_press` — Keyboard input
- `run_command` — Execute shell commands

**File**
- `file_read` / `file_write` — Read and write files

**Browser**
- `browser_navigate` — Open URL
- `browser_click` / `browser_type` — Interact with page elements
- `browser_screenshot` — Capture page
- `browser_content` — Get page text
- `browser_scroll` — Scroll page

**Control**
- `report` — Report progress back to the big model (completed / blocked / need_guidance)

## How It Works

1. The big model calls `create_session` to initialize an agent with a small LLM.
2. The big model sends high-level instructions via `send_instruction`.
3. The small model autonomously executes tasks using the tools above:
   - Takes screenshots to understand the current state
   - Performs actions (clicks, types, navigates)
   - Verifies results with another screenshot
   - Calls `report` when done or stuck
4. The big model receives only a text summary + optional screenshot — not all the intermediate data.
5. The big model can send follow-up instructions or end the session.

## License

MIT
