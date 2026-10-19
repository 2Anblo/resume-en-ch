import { defineConfig } from 'vite';

// Bundles the stdio MCP server (mcp/server.ts) for Node; npm dependencies stay external.
// No publicDir: the site's icons do not belong next to the server.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'mcp/server.ts',
    outDir: 'dist-mcp',
    target: 'node20',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'server.js' } },
  },
});
