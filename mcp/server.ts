import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { callTool, loadResume, TOOLS, ToolError } from './tools';

const USAGE = `Usage: resume-en-ch-mcp <path-to-resume.json>

Local MCP server (stdio) for a resume exported with "Export JSON" from resume-en-ch.
Edits are written back to the same file; import it into the site again to see them.`;

/** Builds the MCP server for one resume file. */
export function createServer(file: string): McpServer {
  const server = new McpServer(
    { name: 'resume-en-ch', version: '0.1.0' },
    {
      instructions:
        `Edits the resume JSON at ${file}. Call list_sections first; sections are addressed by index, id or title, entries by 0-based index. ` +
        'Every write is validated and saved immediately. To post the resume publicly for feedback use get_redacted, never get_resume. ' +
        'Tell the user to re-import the file in the site (Import JSON) to see the changes.',
    },
  );

  for (const t of TOOLS) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: t.input, annotations: { readOnlyHint: t.readOnly, destructiveHint: t.name.startsWith('remove_'), openWorldHint: false } },
      async (args: unknown) => {
        try {
          return { content: [{ type: 'text' as const, text: await callTool(file, t.name, args) }] };
        } catch (e) {
          if (!(e instanceof ToolError)) throw e;
          return { content: [{ type: 'text' as const, text: e.message }], isError: true };
        }
      },
    );
  }

  server.registerPrompt(
    'review_resume',
    {
      description: 'Review the resume and suggest concrete improvements.',
      argsSchema: { role: z.string().optional().describe('Target role or job description') },
    },
    ({ role }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Review my resume${role ? ` for this role: ${role}` : ''}. Read it with get_resume, then give specific feedback ` +
              '(impact and numbers in bullets, wording, ordering, length, consistency of dates). ' +
              'Ask before applying any change, then apply the ones I accept with the editing tools.',
          },
        },
      ],
    }),
  );

  return server;
}

async function main() {
  const arg = process.argv[2];
  if (!arg || arg === '-h' || arg === '--help') {
    console.error(USAGE);
    process.exit(arg ? 0 : 1);
  }
  const file = resolve(arg);
  try {
    await loadResume(file);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  await createServer(file).connect(new StdioServerTransport());
  console.error(`resume-en-ch MCP server running on stdio for ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
