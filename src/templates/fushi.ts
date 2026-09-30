import type { Entry, Resume, Section } from '../types';
import { contactHref, esc, inline, lines, splitLabel, tableHtml, examHtml } from '../util';

/** HTML take on Kody's 中文考研复试简历模板 (https://github.com/kody1126/Chinese-resume-template-postgraduate, MIT). */
export function renderFushi(r: Resume): string {
  const contacts = r.contacts
    .filter((c) => c.text.trim())
    .map((c) => {
      const [label, value] = splitLabel(c.text);
      const href = contactHref(c);
      const v = href ? `<a href="${href}">${esc(value)}</a>` : esc(value);
      return label ? `<span class="k">${esc(label)}：</span><span class="v">${v}</span>` : `<span class="v full">${v}</span>`;
    })
    .join('');
  const photo = r.photo && r.photo.startsWith('data:image/') ? `<img class="photo" src="${esc(r.photo)}" alt="">` : '';

  return `
<div class="fushi">
  <header class="heading">
    <div class="who">
      <h1>${esc(r.name)}</h1>
      ${contacts ? `<div class="info">${contacts}</div>` : ''}
    </div>
    ${photo ? `<div class="photo-box">${photo}</div>` : ''}
  </header>
  ${r.sections.map(renderSection).join('')}
</div>`;
}

function bullets(text: string): string {
  return lines(text).map((l) => `<p class="b">• ${inline(l)}</p>`).join('');
}

function renderSection(s: Section): string {
  let body = '';
  if (s.kind === 'entries' || s.kind === 'projects') body = s.entries.map(entry).join('');
  else if (s.kind === 'skills')
    body = s.skills
      .filter((k) => k.label.trim() || k.value.trim())
      .map((k) => `<p class="b">• ${k.label.trim() ? `<strong>${inline(k.label)}：</strong>` : ''}${inline(k.value)}</p>`)
      .join('');
  else if (s.kind === 'table') body = tableHtml(s.text);
  else if (s.kind === 'exam') body = examHtml(s);
  else body = bullets(s.text);
  return `<section><h2>${esc(s.title)}</h2>${body}</section>`;
}

function entry(e: Entry): string {
  const extra = [e.subtitle, e.location].filter((x) => x.trim()).map((x) => ` ｜ ${inline(x)}`).join('');
  return `<div class="entry">
  <div class="row"><strong>${inline(e.title)}${extra}</strong><strong class="date">${inline(e.date)}</strong></div>
  ${bullets(e.bullets)}
</div>`;
}
