import type { Entry, Resume, Section } from '../types';
import { contactHref, esc, inline, lines, tableHtml, examHtml } from '../util';

/** HTML take on Resume-NG by Feng Kaiyu (https://github.com/fky2015/resume-ng, LPPL 1.3c). */
export function renderNg(r: Resume): string {
  const contacts = r.contacts
    .filter((c) => c.text.trim())
    .map((c) => {
      const href = contactHref(c);
      return href ? `<a href="${href}"><u>${esc(c.text)}</u></a>` : esc(c.text);
    })
    .join('<span class="sep">|</span>');
  const photo = r.photo && r.photo.startsWith('data:image/') ? `<img class="photo" src="${esc(r.photo)}" alt="">` : '';

  return `
<div class="ng" lang="${r.lang === 'zh' ? 'zh-CN' : 'en'}">
  ${photo}
  <header class="heading${photo ? ' has-photo' : ''}">
    <h1>${esc(r.name)}</h1>
    ${r.headline.trim() ? `<div class="headline">${inline(r.headline)}</div>` : ''}
    ${contacts ? `<div class="contacts">${contacts}</div>` : ''}
  </header>
  ${r.sections.map(renderSection).join('')}
</div>`;
}

function renderSection(s: Section): string {
  let body = '';
  if (s.kind === 'entries' || s.kind === 'projects') body = s.entries.map(entry).join('');
  else if (s.kind === 'skills')
    body = `<ul>${s.skills
      .filter((k) => k.label.trim() || k.value.trim())
      .map((k) => `<li>${k.label.trim() ? `<strong>${inline(k.label)}</strong>: ` : ''}${inline(k.value)}</li>`)
      .join('')}</ul>`;
  else if (s.kind === 'table') body = tableHtml(s.text);
  else if (s.kind === 'exam') body = examHtml(s);
  else body = `<ul>${lines(s.text).map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`;
  return `<section><h2>${esc(s.title)}</h2>${body}</section>`;
}

function entry(e: Entry): string {
  const items = lines(e.bullets);
  const extra = [e.subtitle, e.location].filter((x) => x.trim()).map((x) => `<span class="sep">|</span><span class="kai">${inline(x)}</span>`).join('');
  return `<div class="entry">
  <div class="row"><span><strong class="hei">${inline(e.title)}</strong>${extra}</span><span class="date">${inline(e.date)}</span></div>
  ${items.length ? `<ul>${items.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>` : ''}
</div>`;
}
