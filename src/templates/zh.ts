import type { Entry, Resume, Section } from '../types';
import { contactHref, esc, inline, lines } from '../util';

export function renderZh(r: Resume): string {
  const contacts = r.contacts
    .filter((c) => c.text.trim())
    .map((c) => {
      const href = contactHref(c);
      return `<span>${href ? `<a href="${href}">${esc(c.text)}</a>` : esc(c.text)}</span>`;
    })
    .join('');
  const photo = r.photo && r.photo.startsWith('data:image/') ? `<img class="photo" src="${esc(r.photo)}" alt="">` : '';

  return `
<div class="zh">
  <header class="heading">
    <div class="who">
      <h1>${esc(r.name)}</h1>
      ${r.headline.trim() ? `<div class="headline">${inline(r.headline)}</div>` : ''}
      ${contacts ? `<div class="contacts">${contacts}</div>` : ''}
    </div>
    ${photo}
  </header>
  ${r.sections.map(renderSection).join('')}
</div>`;
}

function renderSection(s: Section): string {
  let body = '';
  if (s.kind === 'entries' || s.kind === 'projects') body = s.entries.map((e) => entry(e, s.kind === 'projects')).join('');
  else if (s.kind === 'skills')
    body = `<ul class="skills">${s.skills
      .filter((k) => k.label.trim() || k.value.trim())
      .map((k) => `<li>${k.label.trim() ? `<strong>${inline(k.label)}：</strong>` : ''}${inline(k.value)}</li>`)
      .join('')}</ul>`;
  else body = lines(s.text).map((l) => `<p>${inline(l)}</p>`).join('');
  return `<section><h2><span>${esc(s.title)}</span></h2>${body}</section>`;
}

function entry(e: Entry, isProject: boolean): string {
  const items = lines(e.bullets);
  const mid = [e.subtitle, isProject ? '' : e.location].filter((x) => x.trim()).map(inline).join('<i class="dot">·</i>');
  return `<div class="entry">
  <div class="row"><strong>${inline(e.title)}</strong>${mid ? `<span class="mid">${mid}</span>` : ''}<span class="date">${inline(e.date)}</span></div>
  ${items.length ? `<ul>${items.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>` : ''}
</div>`;
}
