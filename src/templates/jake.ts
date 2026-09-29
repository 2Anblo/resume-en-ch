import type { Entry, Resume, Section } from '../types';
import { contactHref, esc, inline, lines } from '../util';

/** HTML port of Jake's Resume (https://github.com/jakegut/resume, MIT). */
export function renderJake(r: Resume): string {
  const contacts = r.contacts
    .filter((c) => c.text.trim())
    .map((c) => {
      const href = contactHref(c);
      return href ? `<a href="${href}"><u>${esc(c.text)}</u></a>` : esc(c.text);
    })
    .join('<span class="sep">|</span>');

  return `
<div class="jake">
  <header class="heading">
    <h1>${esc(r.name)}</h1>
    ${contacts ? `<div class="contacts">${contacts}</div>` : ''}
  </header>
  ${r.sections.map(renderSection).join('')}
</div>`;
}

function renderSection(s: Section): string {
  let body = '';
  if (s.kind === 'entries') body = `<ul class="subheadings">${s.entries.map(subheading).join('')}</ul>`;
  else if (s.kind === 'projects') body = `<ul class="subheadings">${s.entries.map(project).join('')}</ul>`;
  else if (s.kind === 'skills')
    body = `<ul class="subheadings skills"><li>${s.skills
      .filter((k) => k.label.trim() || k.value.trim())
      .map((k) => `<div><strong>${inline(k.label)}</strong>${k.label.trim() ? ': ' : ''}${inline(k.value)}</div>`)
      .join('')}</li></ul>`;
  else body = `<ul class="subheadings skills"><li>${lines(s.text).map((l) => `<p>${inline(l)}</p>`).join('')}</li></ul>`;
  return `<section><h2>${esc(s.title)}</h2>${body}</section>`;
}

function bullets(e: Entry): string {
  const items = lines(e.bullets);
  return items.length ? `<ul class="items">${items.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>` : '';
}

function subheading(e: Entry): string {
  return `<li class="sub">
  <div class="row"><strong>${inline(e.title)}</strong><span>${inline(e.location)}</span></div>
  ${e.subtitle || e.date ? `<div class="row small"><em>${inline(e.subtitle)}</em><em>${inline(e.date)}</em></div>` : ''}
  ${bullets(e)}
</li>`;
}

function project(e: Entry): string {
  const sub = e.subtitle.trim() ? ` <span class="sep">|</span> <em>${inline(e.subtitle)}</em>` : '';
  return `<li class="sub">
  <div class="row small"><span><strong>${inline(e.title)}</strong>${sub}</span><span>${inline(e.date)}</span></div>
  ${bullets(e)}
</li>`;
}
