import type { Entry, Resume, Section } from '../types';
import { contactHref, esc, inline, splitLabel, src, srcLines, srcSpan, tableHtml, examHtml } from '../util';

/** HTML take on Kody's 中文考研复试简历模板 (https://github.com/kody1126/Chinese-resume-template-postgraduate, MIT). */
export function renderFushi(r: Resume): string {
  const contacts = r.contacts
    .flatMap((c, i) => {
      if (!c.text.trim()) return [];
      const [label, value] = splitLabel(c.text);
      const href = contactHref(c);
      const path = `contacts.${i}.text`;
      const v = href ? `<a href="${href}">${esc(value)}</a>` : esc(value);
      // The value follows "label：" in the same field.
      const off = label ? c.text.indexOf(value, label.length) : 0;
      return [
        label
          ? `<span class="k"${src(path)}>${esc(label)}：</span><span class="v"${src(path, 0, off)}>${v}</span>`
          : `<span class="v full"${src(path)}>${v}</span>`,
      ];
    })
    .join('');
  const photo = r.photo && r.photo.startsWith('data:image/') ? `<img class="photo" src="${esc(r.photo)}" alt="">` : '';

  return `
<div class="fushi">
  <header class="heading">
    <div class="who">
      <h1${src('name')}>${esc(r.name)}</h1>
      ${contacts ? `<div class="info">${contacts}</div>` : ''}
    </div>
    ${photo ? `<div class="photo-box">${photo}</div>` : ''}
  </header>
  ${r.sections.map(renderSection).join('')}
</div>`;
}

function bullets(text: string, path: string): string {
  return srcLines(text)
    .map((l) => `<p class="b">• <span${src(path, l.line, l.off)}>${inline(l.text)}</span></p>`)
    .join('');
}

function renderSection(s: Section, si: number): string {
  const p = `sections.${si}`;
  let body = '';
  if (s.kind === 'entries' || s.kind === 'projects') body = s.entries.map((e, ei) => entry(e, `${p}.entries.${ei}`)).join('');
  else if (s.kind === 'skills')
    body = s.skills
      .flatMap((k, ki) =>
        k.label.trim() || k.value.trim()
          ? [`<p class="b">• ${k.label.trim() ? `<strong>${srcSpan(`${p}.skills.${ki}.label`, k.label)}：</strong>` : ''}${srcSpan(`${p}.skills.${ki}.value`, k.value)}</p>`]
          : [],
      )
      .join('');
  else if (s.kind === 'table') body = tableHtml(s.text, `${p}.text`);
  else if (s.kind === 'exam') body = examHtml(s, p);
  else body = bullets(s.text, `${p}.text`);
  return `<section><h2${src(`${p}.title`)}>${esc(s.title)}</h2>${body}</section>`;
}

function entry(e: Entry, ep: string): string {
  const extra = (['subtitle', 'location'] as const)
    .filter((f) => e[f].trim())
    .map((f) => ` ｜ ${srcSpan(`${ep}.${f}`, e[f])}`)
    .join('');
  return `<div class="entry">
  <div class="row"><strong>${srcSpan(`${ep}.title`, e.title)}${extra}</strong><strong class="date"${src(`${ep}.date`)}>${inline(e.date)}</strong></div>
  ${bullets(e.bullets, `${ep}.bullets`)}
</div>`;
}
