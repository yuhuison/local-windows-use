import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'cli': 'src/cli.ts',
    'mcp/server': 'src/mcp/server.ts',
  },
  format: ['esm'],
  target: 'node20',
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    '@nut-tree-fork/nut-js',
    'node-screenshots',
    'playwright',
  ],
});
