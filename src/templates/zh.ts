import type { Entry, Resume, Section } from '../types';
import { contactHref, esc, inline, src, srcLines, srcSpan, tableHtml, examHtml } from '../util';

export function renderZh(r: Resume): string {
  const contacts = r.contacts
    .flatMap((c, i) => {
      if (!c.text.trim()) return [];
      const href = contactHref(c);
      return [`<span${src(`contacts.${i}.text`)}>${href ? `<a href="${href}">${esc(c.text)}</a>` : esc(c.text)}</span>`];
    })
    .join('');
  const photo = r.photo && r.photo.startsWith('data:image/') ? `<img class="photo" src="${esc(r.photo)}" alt="">` : '';

  return `
<div class="zh">
  <header class="heading">
    <div class="who">
      <h1${src('name')}>${esc(r.name)}</h1>
      ${r.headline.trim() ? `<div class="headline"${src('headline')}>${inline(r.headline)}</div>` : ''}
      ${contacts ? `<div class="contacts">${contacts}</div>` : ''}
    </div>
    ${photo}
  </header>
  ${r.sections.map(renderSection).join('')}
</div>`;
}

function renderSection(s: Section, si: number): string {
  const p = `sections.${si}`;
  let body = '';
  if (s.kind === 'entries' || s.kind === 'projects') body = s.entries.map((e, ei) => entry(e, s.kind === 'projects', `${p}.entries.${ei}`)).join('');
  else if (s.kind === 'skills')
    body = `<ul class="skills">${s.skills
      .flatMap((k, ki) =>
        k.label.trim() || k.value.trim()
          ? [`<li>${k.label.trim() ? `<strong>${srcSpan(`${p}.skills.${ki}.label`, k.label)}：</strong>` : ''}${srcSpan(`${p}.skills.${ki}.value`, k.value)}</li>`]
          : [],
      )
      .join('')}</ul>`;
  else if (s.kind === 'table') body = tableHtml(s.text, `${p}.text`);
  else if (s.kind === 'exam') body = examHtml(s, p);
  else body = srcLines(s.text).map((l) => `<p${src(`${p}.text`, l.line, l.off)}>${inline(l.text)}</p>`).join('');
  return `<section><h2><span${src(`${p}.title`)}>${esc(s.title)}</span></h2>${body}</section>`;
}

function entry(e: Entry, isProject: boolean, ep: string): string {
  const items = srcLines(e.bullets);
  const mid = (isProject ? (['subtitle'] as const) : (['subtitle', 'location'] as const))
    .filter((f) => e[f].trim())
    .map((f) => srcSpan(`${ep}.${f}`, e[f]))
    .join('<i class="dot">·</i>');
  return `<div class="entry">
  <div class="row"><strong${src(`${ep}.title`)}>${inline(e.title)}</strong>${mid ? `<span class="mid">${mid}</span>` : ''}<span class="date"${src(`${ep}.date`)}>${inline(e.date)}</span></div>
  ${items.length ? `<ul>${items.map((b) => `<li${src(`${ep}.bullets`, b.line, b.off)}>${inline(b.text)}</li>`).join('')}</ul>` : ''}
</div>`;
}
