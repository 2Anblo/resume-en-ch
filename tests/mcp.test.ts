import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { callTool, ToolError, TOOLS } from '../mcp/tools';
import { sampleEn, sampleFushi, sampleZh } from '../src/samples';
import { normalize } from '../src/store';
import type { Resume } from '../src/types';

let dir: string;
let file: string;

const put = (r: unknown) => writeFile(file, JSON.stringify(r, null, 2));
const disk = async (): Promise<Resume> => JSON.parse(await readFile(file, 'utf8'));
const call = async (name: string, args: unknown = {}) => {
  const out = await callTool(file, name, args);
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'resume-mcp-'));
  file = join(dir, 'resume.json');
  await put(sampleEn());
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('mcp tools', () => {
  it('registers every tool with a description', () => {
    const names = TOOLS.map((t) => t.name);
    for (const n of ['get_resume', 'list_sections', 'update_basics', 'add_section', 'update_section', 'remove_section', 'move_section',
      'add_entry', 'update_entry', 'remove_entry', 'move_entry', 'set_skills', 'get_redacted', 'render_html', 'export_latex',
      'list_templates', 'set_template']) expect(names).toContain(n);
    for (const t of TOOLS) expect(t.description.length).toBeGreaterThan(10);
  });

  it('reads the resume and single sections by index, id or title', async () => {
    const r = await call('get_resume');
    expect(r.name).toBe('Jake Ryan');
    const list = await call('list_sections');
    expect(list.sections.map((s: { title: string }) => s.title)).toEqual(r.sections.map((s: { title: string }) => s.title));
    const byTitle = await call('get_resume', { section: 'experience' });
    expect(byTitle.title).toBe('Experience');
    expect(await call('get_resume', { section: byTitle.id })).toEqual(byTitle);
    expect(await call('get_resume', { section: 1 })).toEqual(byTitle);
  });

  it('round-trips edits through normalize and saves the file', async () => {
    await call('update_basics', { name: 'Jane Doe', contacts: [{ text: 'jane@example.com' }] });
    const { id } = await call('add_section', { kind: 'skills', title: 'Languages', position: 0 });
    await call('set_skills', { section: id, skills: [{ label: 'Spoken', value: 'English, 中文' }] });
    await call('add_entry', { section: 'Experience', entry: { title: 'Acme', bullets: ['Shipped **X**', 'Cut cost 30%'] }, position: 0 });
    await call('update_entry', { section: 'Experience', index: 0, patch: { date: '2024 – Present' } });
    await call('move_entry', { section: 'Experience', index: 0, to: 1 });
    await call('move_section', { section: 'Languages', to: 2 });
    await call('remove_section', { section: 'Projects' });

    const saved = await disk();
    // What is on disk is already normalized: normalizing it again changes nothing.
    expect(normalize(saved, 'en')).toEqual(saved);
    expect(saved.name).toBe('Jane Doe');
    expect(saved.contacts).toEqual([{ text: 'jane@example.com', link: '' }]);
    expect(saved.sections[2]).toMatchObject({ title: 'Languages', kind: 'skills', skills: [{ label: 'Spoken', value: 'English, 中文' }] });
    const exp = saved.sections.find((s) => s.title === 'Experience')!;
    expect(exp.entries[1]).toEqual({ title: 'Acme', subtitle: '', location: '', date: '2024 – Present', bullets: 'Shipped **X**\nCut cost 30%' });
    expect(saved.sections.some((s) => s.title === 'Projects')).toBe(false);
    // No temp files are left next to the resume.
    expect(await readdir(dir)).toEqual(['resume.json']);
  });

  it('normalizes a hand-written file on the first write', async () => {
    await put({ lang: 'zh', name: '张三', sections: [{ kind: 'bogus', title: '教育', entries: [{ title: 'X大学', bullets: ['a', 'b'] }] }] });
    await call('update_basics', { headline: '求职意向：前端' });
    const saved = await disk();
    expect(saved).toMatchObject({ version: 1, lang: 'zh', template: 'zh-simple', pageSize: 'a4', headline: '求职意向：前端' });
    expect(saved.sections[0]).toMatchObject({ kind: 'entries', entries: [{ title: 'X大学', bullets: 'a\nb', date: '' }] });
    expect(saved.sections[0].id).toBeTruthy();
  });

  it('switches templates and keeps the fushi exam section', async () => {
    await put(sampleZh());
    const templates = await call('list_templates');
    expect(templates.map((t: { id: string }) => t.id)).toEqual(['zh-simple', 'fushi', 'ng']);
    await call('set_template', { template: 'fushi' });
    const saved = await disk();
    expect(saved.template).toBe('fushi');
    expect(saved.sections[0].kind).toBe('exam');
    await expect(call('set_template', { template: 'jake' })).rejects.toThrow(/not available for zh/);
  });

  it('get_redacted leaks none of the sample\'s personal data', async () => {
    for (const r of [sampleEn(), sampleZh(), sampleFushi()]) {
      await put(r);
      const redacted: Resume = await call('get_redacted');
      const out = JSON.stringify(redacted);
      const html = await call('render_html', { redacted: true });
      const tex = await call('export_latex', { redacted: true });
      const values = r.contacts.map((c) => c.text.replace(/^[^:：]{1,8}[：:]\s*/, ''));
      // Every contact value is masked in the contact list...
      for (const v of values) expect(JSON.stringify(redacted.contacts)).not.toContain(v);
      expect(redacted.photo).toBe('');
      // ...and the identifying ones (email, phone, URLs) everywhere. A bare city like 上海 may stay as a work location.
      const secrets = [
        r.name,
        ...values.filter((v) => /[@\d.]/.test(v)),
        ...r.contacts.map((c) => c.link).filter(Boolean),
        ...r.sections.filter((s) => /education|教育/i.test(s.title) || s.kind === 'exam').flatMap((s) => s.entries.map((e) => e.title)),
      ].filter((s) => s.trim().length >= 2);
      expect(secrets.length).toBeGreaterThan(2);
      for (const s of secrets) {
        // Whole tokens only: the LaTeX header credits github.com/jakegut/resume, which is not the sample's github.com/jake.
        const leak = new RegExp(`${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
        expect(out).not.toMatch(leak);
        expect(html).not.toMatch(leak);
        expect(tex).not.toMatch(leak);
      }
      // Redaction never touches the file itself.
      expect((await disk()).name).toBe(r.name);
    }
  });

  it('renders HTML and LaTeX for the current template', async () => {
    const html = await call('render_html');
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('class="jake"');
    expect(html).toContain('Jake Ryan');
    expect(html).not.toContain('@font-face');
    expect(await call('render_html', { fragment: true })).not.toContain('<html');
    expect(await call('export_latex')).toContain('\\documentclass[letterpaper,11pt]{article}');
  });

  it('rejects invalid input without touching the file', async () => {
    const before = await readFile(file, 'utf8');
    const bad: [string, unknown, RegExp][] = [
      ['update_basics', { name: 42 }, /Invalid arguments/],
      ['update_basics', { nickname: 'x' }, /Invalid arguments/],
      ['add_section', { kind: 'gallery', title: 'X' }, /Invalid arguments/],
      ['add_section', { kind: 'text', title: '' }, /Invalid arguments/],
      ['update_entry', { section: 'Experience', index: -1, patch: {} }, /Invalid arguments/],
      ['update_entry', { section: 'Experience', index: 99, patch: { title: 'x' } }, /out of range/],
      ['update_entry', { section: 'Nope', index: 0, patch: {} }, /No section "Nope"/],
      ['add_entry', { section: 'Technical Skills', entry: { title: 'x' } }, /skills section/],
      ['set_skills', { section: 'Education', skills: [] }, /entries section/],
      ['move_section', { section: 0, to: 99 }, /out of range/],
      ['no_such_tool', {}, /Unknown tool/],
    ];
    for (const [name, args, msg] of bad) {
      const p = callTool(file, name, args);
      await expect(p).rejects.toThrow(ToolError);
      await expect(p).rejects.toThrow(msg);
    }
    expect(await readFile(file, 'utf8')).toBe(before);
  });

  it('reports a missing or broken file', async () => {
    await expect(callTool(join(dir, 'missing.json'), 'get_resume', {})).rejects.toThrow(/Export JSON from the site/);
    await writeFile(file, '{ not json');
    await expect(call('get_resume')).rejects.toThrow(/not valid JSON/);
  });

  it('serializes parallel writes', async () => {
    await Promise.all(['A', 'B', 'C'].map((title) => call('add_entry', { section: 'Experience', entry: { title } })));
    const titles = (await disk()).sections.find((s) => s.title === 'Experience')!.entries.map((e) => e.title);
    expect(titles.slice(-3).sort()).toEqual(['A', 'B', 'C']);
  });
});
