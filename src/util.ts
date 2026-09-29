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
  const t = c.text.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) || /^(https?:\/\/|www\.)\S+$/i.test(t) || /^[\w-]+(\.[\w-]+)+\/\S*$/.test(t)) return safeUrl(t);
  return '';
}
