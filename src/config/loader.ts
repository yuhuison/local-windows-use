import { ConfigSchema, type Config } from './schema.js';

export function loadConfig(overrides?: Partial<Config>): Config {
  const raw = {
    apiKey: overrides?.apiKey ?? process.env.WINDOWS_USE_API_KEY ?? '',
    baseURL: overrides?.baseURL ?? process.env.WINDOWS_USE_BASE_URL ?? '',
    model: overrides?.model ?? process.env.WINDOWS_USE_MODEL ?? '',
    maxSteps: overrides?.maxSteps ?? intEnv('WINDOWS_USE_MAX_STEPS') ?? 50,
    contextWindowSize: overrides?.contextWindowSize ?? intEnv('WINDOWS_USE_CONTEXT_WINDOW') ?? 20,
    cdpUrl: overrides?.cdpUrl ?? process.env.WINDOWS_USE_CDP_URL ?? 'http://localhost:9222',
    timeoutMs: overrides?.timeoutMs ?? intEnv('WINDOWS_USE_TIMEOUT_MS') ?? 300_000,
  };

  return ConfigSchema.parse(raw);
}

function intEnv(name: string): number | undefined {
  const val = process.env[name];
  if (val === undefined) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}
