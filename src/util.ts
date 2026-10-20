const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Escape, then allow **bold** and [text](url). */
export function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
      const href = safeUrl(url);
      return href ? `<a href="${href}">${text}</a>` : text;
    });
}

/** Only allow http(s), mailto and tel links; bare domains get https://. Returns the URL unescaped. */
export function cleanUrl(url: string): string {
  const u = String(url ?? '').trim();
  if (!u) return '';
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return 'mailto:' + u;
  return 'https://' + u;
}

/** cleanUrl, HTML-escaped. */
export function safeUrl(url: string): string {
  return esc(cleanUrl(url));
}

export function lines(s: string): string[] {
  return srcLines(s).map((l) => l.text);
}

/** A shown line of a multi-line field: its text, its 0-based line in the source and where the text starts in that line. */
export interface SrcLine {
  text: string;
  line: number;
  off: number;
}

/** Like lines(), but remembers where each line came from so a click in the preview can find it again. */
export function srcLines(s: string): SrcLine[] {
  return String(s ?? '')
    .split('\n')
    .flatMap((raw, line) => {
      const stripped = raw.replace(/^\s*[-•*]\s+/, '');
      const text = stripped.trim();
      return text ? [{ text, line, off: raw.length - stripped.trimStart().length }] : [];
    });
}

/**
 * Attributes tying a piece of preview text to the editor field it came from (`path` is the field's
 * data-path). For multi-line fields, `line` is the source line and `off` where the shown text starts in it.
 */
export function src(path: string, line?: number, off = 0): string {
  return ` data-src="${path}"${line === undefined ? '' : ` data-line="${line}"`}${off ? ` data-off="${off}"` : ''}`;
}

/** inline(value) in a span tied to its editor field. */
export function srcSpan(path: string, value: string): string {
  return `<span${src(path)}>${inline(value)}</span>`;
}

/**
 * Source offset of the `shown`-th character inline(s) displays (markup like ** and [text](url)
 * is hidden in the preview). Past the end it returns the end of the last shown character.
 */
export function sourceOffset(s: string, shown: number): number {
  const hidden = new Set<number>();
  const hide = (from: number, n: number) => {
    for (let i = from; i < from + n; i++) hidden.add(i);
  };
  for (const m of s.matchAll(/\*\*(.+?)\*\*/g)) {
    hide(m.index, 2);
    hide(m.index + m[0].length - 2, 2);
  }
  for (const m of s.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    hide(m.index, 1);
    hide(m.index + 1 + m[1].length, m[0].length - 1 - m[1].length);
  }
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    if (hidden.has(i)) continue;
    if (shown-- === 0) return i;
    last = i + 1;
  }
  return last;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Link for a contact: the explicit link, else the text itself when it looks like an email or URL. */
export function contactHref(c: { text: string; link: string }): string {
  return esc(contactUrl(c));
}

/** contactHref, unescaped. */
export function contactUrl(c: { text: string; link: string }): string {
  const explicit = cleanUrl(c.link);
  if (explicit) return explicit;
  const t = splitLabel(c.text)[1].trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) || /^(https?:\/\/|www\.)\S+$/i.test(t) || /^[\w-]+(\.[\w-]+)+\/\S*$/.test(t)) return cleanUrl(t);
  return '';
}

/** "电话：123" -> ["电话", "123"]; text without a short label -> ["", text]. URLs are never split. */
export function splitLabel(text: string): [string, string] {
  const m = /^([^:：/@]{1,8})[：:]\s*(.+)$/.exec(String(text ?? '').trim());
  return m && !/^(https?|mailto|tel)$/i.test(m[1]) ? [m[1], m[2]] : ['', String(text ?? '')];
}

/**
 * Renders a table section. Lines with "|" are table rows (the first one is the header);
 * a line without "|" is a plain paragraph. Short rows stretch their last cell.
 */
export function tableHtml(text: string, path?: string): string {
  const out: string[] = [];
  let rows: SrcLine[][] = [];
  const at = (c: SrcLine) => (path ? src(path, c.line, c.off) : '');
  const flush = () => {
    if (!rows.length) return;
    const n = Math.max(...rows.map((r) => r.length));
    const tr = (r: SrcLine[], tag: string) =>
      `<tr>${r.map((c, i) => `<${tag}${i === r.length - 1 && r.length < n ? ` colspan="${n - r.length + 1}"` : ''}${at(c)}>${inline(c.text)}</${tag}>`).join('')}</tr>`;
    out.push(`<table class="tbl"><thead>${tr(rows[0], 'th')}</thead><tbody>${rows.slice(1).map((r) => tr(r, 'td')).join('')}</tbody></table>`);
    rows = [];
  };
  String(text ?? '')
    .split('\n')
    .forEach((raw, ln) => {
      const line = raw.trim();
      if (!line) return;
      const lead = raw.length - raw.trimStart().length;
      if (line.includes('|')) {
        // Cells with where each one starts in the raw line, skipping the optional outer pipes.
        let pos = lead + (line.startsWith('|') ? 1 : 0);
        rows.push(
          line
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((cell) => {
              const c = { text: cell.trim(), line: ln, off: pos + cell.length - cell.trimStart().length };
              pos += cell.length + 1;
              return c;
            }),
        );
      } else {
        flush();
        out.push(`<p class="tbl-note"${at({ text: line, line: ln, off: lead })}>${inline(line)}</p>`);
      }
    });
  flush();
  return out.join('');
}

/** Subjects plus a 总分 column, computed when every score is a number and no total was entered. */
export function examScores(skills: { label: string; value: string }[]): { label: string; value: string; total?: boolean; index?: number }[] {
  const rows: { label: string; value: string; total?: boolean; index?: number }[] = skills
    .map((k, index) => ({ ...k, index, total: /^(总分|合计|total)$/i.test(k.label.trim()) }))
    .filter((k) => k.label.trim() || k.value.trim());
  if (rows.length && !rows.some((r) => r.total) && rows.every((r) => /^\d+(\.\d+)?$/.test(r.value.trim()))) {
    const sum = rows.reduce((a, r) => a + Number(r.value), 0);
    rows.push({ label: '总分', value: String(Math.round(sum * 10) / 10), total: true });
  }
  return rows;
}

/** 报考信息: a 院校 / 专业 / 方向 line and a 初试成绩 table. */
export function examHtml(
  s: { entries: { title: string; subtitle: string; location: string }[]; skills: { label: string; value: string }[] },
  path?: string,
): string {
  const e = s.entries[0] ?? { title: '', subtitle: '', location: '' };
  const facts = ([['报考院校', e.title, 'title'], ['报考专业', e.subtitle, 'subtitle'], ['研究方向', e.location, 'location']] as const)
    .filter(([, v]) => v.trim())
    .map(([k, v, f]) => `<span><strong>${k}：</strong>${path ? srcSpan(`${path}.entries.0.${f}`, v) : inline(v)}</span>`)
    .join('');
  const rows = examScores(s.skills);
  // The computed 总分 has no field to jump to.
  const at = (r: { index?: number }, f: string) => (path && r.index !== undefined ? src(`${path}.skills.${r.index}.${f}`) : '');
  const table = rows.length
    ? `<table class="tbl exam"><tbody>
  <tr><th rowspan="2" class="exam-label">初试成绩</th>${rows.map((r) => `<td${at(r, 'label')}>${inline(r.label)}</td>`).join('')}</tr>
  <tr>${rows.map((r) => `<td${at(r, 'value')}>${r.total ? `<strong>${inline(r.value)}</strong>` : inline(r.value)}</td>`).join('')}</tr>
</tbody></table>`
    : '';
  return `${facts ? `<div class="exam-facts">${facts}</div>` : ''}${table}`;
}
