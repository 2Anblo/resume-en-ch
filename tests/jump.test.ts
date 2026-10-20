import { describe, expect, it } from 'vitest';
import { sampleEn, sampleFushi, sampleZh } from '../src/samples';
import { renderFushi } from '../src/templates/fushi';
import { renderJake } from '../src/templates/jake';
import { renderNg } from '../src/templates/ng';
import { renderZh } from '../src/templates/zh';
import type { Resume } from '../src/types';
import { examHtml, lines, sourceOffset, srcLines, tableHtml } from '../src/util';

/** Every data-src / data-line / data-off tag in the HTML, with the text right after it. */
function tags(html: string) {
  return [...html.matchAll(/data-src="([^"]+)"(?: data-line="(\d+)")?(?: data-off="(\d+)")?[^>]*>([^<]*)/g)].map((m) => ({
    path: m[1],
    line: m[2] === undefined ? undefined : Number(m[2]),
    off: Number(m[3] ?? 0),
    text: m[4],
  }));
}

describe('srcLines', () => {
  it('keeps the source line and where the text starts, like lines()', () => {
    const s = 'first\n\n  - second\n• third  \n   ';
    expect(srcLines(s)).toEqual([
      { text: 'first', line: 0, off: 0 },
      { text: 'second', line: 2, off: 4 },
      { text: 'third', line: 3, off: 2 },
    ]);
    expect(lines(s)).toEqual(['first', 'second', 'third']);
  });
});

describe('sourceOffset', () => {
  it('skips markup the preview hides', () => {
    expect(sourceOffset('plain', 3)).toBe(3);
    // "Built **Zelda** app" shows as "Built Zelda app".
    const s = 'Built **Zelda** app';
    expect(sourceOffset(s, 6)).toBe(8); // Z
    expect(sourceOffset(s, 12)).toBe(16); // a of "app"
    // "[site](x.com) ok" shows as "site ok".
    expect(sourceOffset('[site](x.com) ok', 0)).toBe(1);
    expect(sourceOffset('[site](x.com) ok', 5)).toBe(14);
  });
  it('clamps past the end', () => {
    expect(sourceOffset('abc', 10)).toBe(3);
    expect(sourceOffset('', 2)).toBe(0);
  });
});

describe('tableHtml / examHtml tags', () => {
  it('tags each cell with its line and offset', () => {
    const t = tags(tableHtml('note\n| A |  B\nx|y', 'sections.1.text'));
    expect(t).toEqual([
      { path: 'sections.1.text', line: 0, off: 0, text: 'note' },
      { path: 'sections.1.text', line: 1, off: 2, text: 'A' },
      { path: 'sections.1.text', line: 1, off: 7, text: 'B' },
      { path: 'sections.1.text', line: 2, off: 0, text: 'x' },
      { path: 'sections.1.text', line: 2, off: 2, text: 'y' },
    ]);
    expect(tableHtml('a|b')).not.toContain('data-src');
  });
  it('keeps original score indices and leaves the computed total untagged', () => {
    const html = examHtml(
      { entries: [{ title: '北大', subtitle: '', location: '' }], skills: [{ label: '', value: '' }, { label: '政治', value: '70' }] },
      'sections.0',
    );
    const paths = tags(html).map((x) => x.path);
    expect(paths).toEqual(['sections.0.entries.0.title', 'sections.0.skills.1.label', 'sections.0.skills.1.value']);
    expect(html).toContain('总分');
  });
});

describe('templates tag shown text with its editor field', () => {
  const cases: [string, (r: Resume) => string, Resume][] = [
    ['jake', renderJake, sampleEn()],
    ['zh', renderZh, sampleZh()],
    ['ng', renderNg, sampleZh()],
    ['fushi', renderFushi, sampleFushi()],
  ];
  for (const [name, render, r] of cases) {
    it(name, () => {
      const t = tags(render(r));
      const at = (path: string) => t.filter((x) => x.path === path);
      expect(at('name')[0].text).toBe(r.name);
      r.sections.forEach((s, si) => expect(at(`sections.${si}.title`)[0]?.text, `section ${si} title`).toBe(s.title));

      const si = r.sections.findIndex((s) => (s.kind === 'entries' || s.kind === 'projects') && s.entries.some((e) => srcLines(e.bullets).length));
      const s = r.sections[si];
      const ei = s.entries.findIndex((e) => srcLines(e.bullets).length);
      const e = s.entries[ei];
      const p = `sections.${si}.entries.${ei}`;
      expect(at(`${p}.title`)).toHaveLength(1);
      if (e.date.trim()) expect(at(`${p}.date`)).toHaveLength(1);
      // Each shown bullet points at its own source line.
      const shown = at(`${p}.bullets`);
      expect(shown.map((x) => x.line)).toEqual(srcLines(e.bullets).map((l) => l.line));
      for (const x of shown) {
        const raw = e.bullets.split('\n')[x.line!];
        expect(raw.slice(x.off).startsWith(x.text.slice(0, 3))).toBe(true);
      }

      // Every tag names a field the editor has.
      for (const x of t) expect(x.path).toMatch(/^(name|headline|contacts\.\d+\.text|sections\.\d+\.(title|text|entries\.\d+\.(title|subtitle|location|date|bullets)|skills\.\d+\.(label|value)))$/);
    });
  }
});
