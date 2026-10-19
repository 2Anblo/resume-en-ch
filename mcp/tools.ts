import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import resumeCss from '../src/styles/resume.css?raw';
import { toLatex } from '../src/latex';
import { redact } from '../src/redact';
import { entry, section as newSection } from '../src/samples';
import { normalize } from '../src/store';
import { templateOf, templatesFor } from '../src/templates';
import type { Entry, Resume, Section, SectionKind } from '../src/types';
import { esc } from '../src/util';

/** A mistake in the tool call (bad section, index, template...): reported to the agent, not a crash. */
export class ToolError extends Error {}

const KINDS = ['entries', 'projects', 'skills', 'text', 'table', 'exam'] as const satisfies readonly SectionKind[];

/* ---------- schemas ---------- */

const sectionRef = z
  .union([z.number().int().min(0), z.string().min(1)])
  .describe('Section to act on: its 0-based index, its id, or its exact title (see list_sections).');
const index = z.number().int().min(0);
const contact = z.object({
  text: z.string().describe('Shown text, e.g. "jake@su.edu" or "电话：138-0000-0000".'),
  link: z.string().optional().describe('Optional URL (https:, mailto:, tel:).'),
}).strict();
const entryFields = {
  title: z.string().optional().describe('Bold left text: school, company, project name.'),
  subtitle: z.string().optional().describe('Degree / role (entries) or tech stack (projects).'),
  location: z.string().optional(),
  date: z.string().optional(),
  bullets: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('One bullet per line (or an array of bullets). Supports **bold** and [text](url).'),
};
const entryPatch = z.object(entryFields).strict();
const skillLine = z.object({ label: z.string(), value: z.string() }).strict();

/* ---------- file I/O ---------- */

/** Reads and normalizes the resume file, the same way the site's "Import JSON" does. */
export async function loadResume(file: string): Promise<Resume> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (e) {
    throw new ToolError(`Cannot read ${file}: ${(e as Error).message}. Export JSON from the site first and pass its path.`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new ToolError(`${file} is not valid JSON.`);
  }
  const lang = (raw as { lang?: unknown } | null)?.lang === 'zh' ? 'zh' : 'en';
  return normalize(raw, lang);
}

/** Writes through a temp file and a rename, so a crash never leaves a half-written resume. */
export async function saveResume(file: string, r: Resume): Promise<void> {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(r, null, 2) + '\n', 'utf8');
    await rename(tmp, file);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}

/* ---------- helpers ---------- */

function findSection(r: Resume, ref: number | string): Section {
  const s =
    typeof ref === 'number'
      ? r.sections[ref]
      : r.sections.find((x) => x.id === ref) ?? r.sections.find((x) => x.title.trim().toLowerCase() === ref.trim().toLowerCase());
  if (!s) throw new ToolError(`No section ${JSON.stringify(ref)}. Sections: ${r.sections.map((x, i) => `${i}:${x.id} "${x.title}"`).join(', ') || 'none'}.`);
  return s;
}

function checkIndex(list: unknown[], i: number, what: string, allowEnd = false): void {
  const max = allowEnd ? list.length : list.length - 1;
  if (i > max) throw new ToolError(`${what} ${i} is out of range (${list.length ? `0–${max}` : allowEnd ? '0' : 'list is empty'}).`);
}

function move<T>(list: T[], from: number, to: number): void {
  const [x] = list.splice(from, 1);
  list.splice(to, 0, x);
}

const bulletsText = (b: string | string[] | undefined) => (Array.isArray(b) ? b.join('\n') : b);

function patchEntry(e: Entry, p: z.infer<typeof entryPatch>): Entry {
  const next = { ...e };
  for (const k of ['title', 'subtitle', 'location', 'date'] as const) if (p[k] !== undefined) next[k] = p[k];
  if (p.bullets !== undefined) next.bullets = bulletsText(p.bullets)!;
  return next;
}

/** Entries are shown for these kinds; skills lines for these. */
const HAS_ENTRIES: SectionKind[] = ['entries', 'projects', 'exam'];
const HAS_SKILLS: SectionKind[] = ['skills', 'exam'];

function entriesOf(s: Section): Entry[] {
  if (!HAS_ENTRIES.includes(s.kind)) throw new ToolError(`Section "${s.title}" is a ${s.kind} section; entries only apply to ${HAS_ENTRIES.join('/')} sections.`);
  return s.entries;
}

/** The photo is a data URL that can be hundreds of KB; agents rarely need it. */
function withoutPhoto<T extends Resume>(r: T): T {
  return r.photo ? { ...r, photo: `<data URL, ${r.photo.length} chars, omitted>` } : r;
}

function summary(r: Resume) {
  return {
    lang: r.lang,
    template: r.template,
    name: r.name,
    sections: r.sections.map((s, i) => ({ index: i, id: s.id, kind: s.kind, title: s.title, entries: s.entries.length, skills: s.skills.length, textLines: s.text ? s.text.split('\n').length : 0 })),
  };
}

/** A standalone page: the template's HTML plus resume.css (web fonts are left to the viewer's system). */
export function htmlPage(r: Resume): string {
  const css = resumeCss.replace(/@font-face\s*{[^}]*}\s*/g, '');
  return `<!doctype html>
<html lang="${r.lang === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8">
<title>${esc(r.name || 'Resume')}</title>
<style>
@page { size: ${r.pageSize === 'a4' ? 'A4' : 'letter'}; margin: 0; }
body { margin: 0; background: #fff; }
${css}
</style>
</head>
<body>
<div class="page" data-size="${r.pageSize}">${templateOf(r).render(r)}</div>
</body>
</html>
`;
}

/* ---------- tools ---------- */

type Shape = z.ZodRawShape;

export interface ToolDef<S extends Shape = Shape> {
  name: string;
  description: string;
  input: S;
  /** true when the tool only reads the file. */
  readOnly: boolean;
  run: (r: Resume, args: z.infer<z.ZodObject<S>>) => unknown;
}

const tool = <S extends Shape>(t: ToolDef<S>): ToolDef => t as unknown as ToolDef;
const write = (message: string, extra: Record<string, unknown> = {}) => ({ ok: true, message, ...extra });

export const TOOLS: ToolDef[] = [
  tool({
    name: 'get_resume',
    description: 'Returns the resume JSON (the same format as the site\'s Export JSON), or a single section when `section` is given. The photo data URL is omitted.',
    input: { section: sectionRef.optional() },
    readOnly: true,
    run: (r, a) => (a.section === undefined ? withoutPhoto(r) : findSection(r, a.section)),
  }),
  tool({
    name: 'list_sections',
    description: 'Lists the sections with their index, id, kind, title and how many entries / skill lines they hold. Start here before editing.',
    input: {},
    readOnly: true,
    run: (r) => summary(r),
  }),
  tool({
    name: 'update_basics',
    description: 'Updates the name, the headline (求职意向, shown by templates with a headline) and/or the page size. `contacts` replaces the whole contact list.',
    input: {
      name: z.string().optional(),
      headline: z.string().optional(),
      contacts: z.array(contact).optional(),
      pageSize: z.enum(['letter', 'a4']).optional(),
    },
    readOnly: false,
    run: (r, a) => {
      if (a.name !== undefined) r.name = a.name;
      if (a.headline !== undefined) r.headline = a.headline;
      if (a.contacts) r.contacts = a.contacts.map((c) => ({ text: c.text, link: c.link ?? '' }));
      if (a.pageSize) r.pageSize = a.pageSize;
      return write('Basics updated.');
    },
  }),
  tool({
    name: 'add_section',
    description: 'Adds a section. Kinds: entries (Education/Experience), projects, skills ("Label: value" lines), text (paragraph), table (rows in `text`, cells split by "|", first row is the header), exam (考研 报考信息). Returns the new section id.',
    input: {
      kind: z.enum(KINDS),
      title: z.string().min(1),
      text: z.string().optional().describe('Body for text / table sections.'),
      position: index.optional().describe('Index to insert at; defaults to the end.'),
    },
    readOnly: false,
    run: (r, a) => {
      const pos = a.position ?? r.sections.length;
      checkIndex(r.sections, pos, 'Position', true);
      const s = newSection(a.kind, a.title, { text: a.text ?? '' });
      r.sections.splice(pos, 0, s);
      return write(`Added section "${a.title}" at ${pos}.`, { id: s.id, index: pos });
    },
  }),
  tool({
    name: 'update_section',
    description: 'Renames a section, changes its kind, or replaces its `text` (text / table sections).',
    input: { section: sectionRef, title: z.string().min(1).optional(), kind: z.enum(KINDS).optional(), text: z.string().optional() },
    readOnly: false,
    run: (r, a) => {
      const s = findSection(r, a.section);
      if (a.title !== undefined) s.title = a.title;
      if (a.kind !== undefined) s.kind = a.kind;
      if (a.text !== undefined) s.text = a.text;
      return write(`Section "${s.title}" updated.`);
    },
  }),
  tool({
    name: 'remove_section',
    description: 'Deletes a section and everything in it.',
    input: { section: sectionRef },
    readOnly: false,
    run: (r, a) => {
      const s = findSection(r, a.section);
      r.sections.splice(r.sections.indexOf(s), 1);
      return write(`Removed section "${s.title}".`);
    },
  }),
  tool({
    name: 'move_section',
    description: 'Moves a section to another position (0-based).',
    input: { section: sectionRef, to: index },
    readOnly: false,
    run: (r, a) => {
      const s = findSection(r, a.section);
      checkIndex(r.sections, a.to, 'Position');
      move(r.sections, r.sections.indexOf(s), a.to);
      return write(`Moved "${s.title}" to ${a.to}.`);
    },
  }),
  tool({
    name: 'add_entry',
    description: 'Adds an entry (school, job, project) to an entries / projects / exam section.',
    input: { section: sectionRef, entry: entryPatch, position: index.optional().describe('Index to insert at; defaults to the end.') },
    readOnly: false,
    run: (r, a) => {
      const list = entriesOf(findSection(r, a.section));
      const pos = a.position ?? list.length;
      checkIndex(list, pos, 'Position', true);
      list.splice(pos, 0, patchEntry(entry(), a.entry));
      return write(`Added entry at ${pos}.`, { index: pos });
    },
  }),
  tool({
    name: 'update_entry',
    description: 'Changes fields of one entry; fields you leave out stay as they are. `bullets` replaces all bullets.',
    input: { section: sectionRef, index, patch: entryPatch },
    readOnly: false,
    run: (r, a) => {
      const list = entriesOf(findSection(r, a.section));
      checkIndex(list, a.index, 'Entry');
      list[a.index] = patchEntry(list[a.index], a.patch);
      return write(`Entry ${a.index} updated.`, { entry: list[a.index] });
    },
  }),
  tool({
    name: 'remove_entry',
    description: 'Deletes one entry from a section.',
    input: { section: sectionRef, index },
    readOnly: false,
    run: (r, a) => {
      const list = entriesOf(findSection(r, a.section));
      checkIndex(list, a.index, 'Entry');
      const [e] = list.splice(a.index, 1);
      return write(`Removed entry "${e.title}".`);
    },
  }),
  tool({
    name: 'move_entry',
    description: 'Moves an entry to another position within its section.',
    input: { section: sectionRef, index, to: index },
    readOnly: false,
    run: (r, a) => {
      const list = entriesOf(findSection(r, a.section));
      checkIndex(list, a.index, 'Entry');
      checkIndex(list, a.to, 'Position');
      move(list, a.index, a.to);
      return write(`Moved entry ${a.index} to ${a.to}.`);
    },
  }),
  tool({
    name: 'set_skills',
    description: 'Replaces the "Label: value" lines of a skills section (or the 科目/分数 of an exam section).',
    input: { section: sectionRef, skills: z.array(skillLine) },
    readOnly: false,
    run: (r, a) => {
      const s = findSection(r, a.section);
      if (!HAS_SKILLS.includes(s.kind)) throw new ToolError(`Section "${s.title}" is a ${s.kind} section; skills only apply to ${HAS_SKILLS.join('/')} sections.`);
      s.skills = a.skills;
      return write(`Set ${a.skills.length} skill lines in "${s.title}".`);
    },
  }),
  tool({
    name: 'get_redacted',
    description: 'Returns a copy with the name, photo, contacts and schools masked (the site\'s one-click redaction), safe to post publicly for feedback. The file is not changed.',
    input: {},
    readOnly: true,
    run: (r) => redact(r),
  }),
  tool({
    name: 'render_html',
    description: 'Renders the resume with its current template as a standalone HTML page (or only the template markup with `fragment`).',
    input: { redacted: z.boolean().optional().describe('Render the redacted copy.'), fragment: z.boolean().optional() },
    readOnly: true,
    run: (r, a) => {
      const shown = a.redacted ? redact(r) : r;
      return { text: a.fragment ? templateOf(shown).render(shown) : htmlPage(shown) };
    },
  }),
  tool({
    name: 'export_latex',
    description: 'Exports LaTeX source: Jake\'s Resume for pdfLaTeX (English) or ctexart for XeLaTeX (Chinese).',
    input: { redacted: z.boolean().optional() },
    readOnly: true,
    run: (r, a) => ({ text: toLatex(a.redacted ? redact(r) : r) }),
  }),
  tool({
    name: 'list_templates',
    description: 'Lists the templates available for the resume\'s language and which one is current.',
    input: {},
    readOnly: true,
    run: (r) =>
      templatesFor(r.lang).map((t) => ({ id: t.id, name: t.name[r.lang], current: t.id === templateOf(r).id, photo: t.photo, headline: t.headline })),
  }),
  tool({
    name: 'set_template',
    description: 'Switches the template (see list_templates).',
    input: { template: z.string() },
    readOnly: false,
    run: (r, a) => {
      const ids = templatesFor(r.lang).map((t) => t.id);
      if (!ids.includes(a.template as Resume['template'])) throw new ToolError(`Template "${a.template}" is not available for ${r.lang} resumes. Use one of: ${ids.join(', ')}.`);
      r.template = a.template as Resume['template'];
      return write(`Template set to ${a.template}.`);
    },
  }),
];

/**
 * Validates `args`, runs the tool on a freshly loaded copy of the file and, for writes,
 * normalizes and saves it atomically. Returns the result as text: plain for rendered
 * HTML / LaTeX, pretty JSON otherwise.
 */
export function callTool(file: string, name: string, args: unknown): Promise<string> {
  // One call at a time, so two parallel edits cannot both read the old file and lose one write.
  const run = queue.then(() => runTool(file, name, args));
  queue = run.catch(() => undefined);
  return run;
}

let queue: Promise<unknown> = Promise.resolve();

async function runTool(file: string, name: string, args: unknown): Promise<string> {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new ToolError(`Unknown tool ${name}.`);
  const parsed = z.object(t.input).strict().safeParse(args ?? {});
  if (!parsed.success) throw new ToolError(`Invalid arguments for ${name}: ${z.prettifyError(parsed.error)}`);
  const r = await loadResume(file);
  const out = t.run(r, parsed.data);
  if (!t.readOnly) await saveResume(file, normalize(r, r.lang));
  if (out && typeof out === 'object' && 'text' in out && Object.keys(out).length === 1) return String(out.text);
  return JSON.stringify(out, null, 2);
}
