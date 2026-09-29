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

/** Only allow http(s), mailto and tel links; bare domains get https://. */
export function safeUrl(url: string): string {
  const u = String(url ?? '').trim();
  if (!u) return '';
  if (/^(https?:|mailto:|tel:)/i.test(u)) return esc(u);
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return esc('mailto:' + u);
  return esc('https://' + u);
}

export function lines(s: string): string[] {
  return String(s ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*]\s+/, '').trim())
    .filter(Boolean);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Link for a contact: the explicit link, else the text itself when it looks like an email or URL. */
export function contactHref(c: { text: string; link: string }): string {
  const explicit = safeUrl(c.link);
  if (explicit) return explicit;
  const t = splitLabel(c.text)[1].trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) || /^(https?:\/\/|www\.)\S+$/i.test(t) || /^[\w-]+(\.[\w-]+)+\/\S*$/.test(t)) return safeUrl(t);
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
export function tableHtml(text: string): string {
  const out: string[] = [];
  let rows: string[][] = [];
  const flush = () => {
    if (!rows.length) return;
    const n = Math.max(...rows.map((r) => r.length));
    const tr = (r: string[], tag: string) =>
      `<tr>${r.map((c, i) => `<${tag}${i === r.length - 1 && r.length < n ? ` colspan="${n - r.length + 1}"` : ''}>${inline(c)}</${tag}>`).join('')}</tr>`;
    out.push(`<table class="tbl"><thead>${tr(rows[0], 'th')}</thead><tbody>${rows.slice(1).map((r) => tr(r, 'td')).join('')}</tbody></table>`);
    rows = [];
  };
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.includes('|')) rows.push(line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    else {
      flush();
      out.push(`<p class="tbl-note">${inline(line)}</p>`);
    }
  }
  flush();
  return out.join('');
}
