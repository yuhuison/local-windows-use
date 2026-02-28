import { z } from 'zod';

export const ConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  baseURL: z.string().url('Must be a valid URL'),
  model: z.string().min(1, 'Model name is required'),
  maxSteps: z.number().int().positive().default(50),
  contextWindowSize: z.number().int().positive().default(20),
  cdpUrl: z.string().default('http://localhost:9222'),
  timeoutMs: z.number().default(300_000),
});

export type Config = z.infer<typeof ConfigSchema>;
