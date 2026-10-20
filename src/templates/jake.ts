import type { Entry, Resume, Section } from '../types';
import { contactHref, esc, inline, src, srcLines, srcSpan, tableHtml, examHtml } from '../util';

/** HTML port of Jake's Resume (https://github.com/jakegut/resume, MIT). */
export function renderJake(r: Resume): string {
  const contacts = r.contacts
    .flatMap((c, i) => {
      if (!c.text.trim()) return [];
      const href = contactHref(c);
      const at = src(`contacts.${i}.text`);
      return [href ? `<a href="${href}"><u${at}>${esc(c.text)}</u></a>` : `<span${at}>${esc(c.text)}</span>`];
    })
    .join('<span class="sep">|</span>');

  return `
<div class="jake">
  <header class="heading">
    <h1${src('name')}>${esc(r.name)}</h1>
    ${contacts ? `<div class="contacts">${contacts}</div>` : ''}
  </header>
  ${r.sections.map(renderSection).join('')}
</div>`;
}

function renderSection(s: Section, si: number): string {
  const p = `sections.${si}`;
  let body = '';
  if (s.kind === 'entries') body = `<ul class="subheadings">${s.entries.map((e, ei) => subheading(e, `${p}.entries.${ei}`)).join('')}</ul>`;
  else if (s.kind === 'projects') body = `<ul class="subheadings">${s.entries.map((e, ei) => project(e, `${p}.entries.${ei}`)).join('')}</ul>`;
  else if (s.kind === 'skills')
    body = `<ul class="subheadings skills"><li>${s.skills
      .flatMap((k, ki) =>
        k.label.trim() || k.value.trim()
          ? [`<div><strong${src(`${p}.skills.${ki}.label`)}>${inline(k.label)}</strong>${k.label.trim() ? ': ' : ''}${srcSpan(`${p}.skills.${ki}.value`, k.value)}</div>`]
          : [],
      )
      .join('')}</li></ul>`;
  else if (s.kind === 'table') body = `<ul class="subheadings skills"><li>${tableHtml(s.text, `${p}.text`)}</li></ul>`;
  else if (s.kind === 'exam') body = `<ul class="subheadings skills"><li>${examHtml(s, p)}</li></ul>`;
  else body = `<ul class="subheadings skills"><li>${srcLines(s.text).map((l) => `<p${src(`${p}.text`, l.line, l.off)}>${inline(l.text)}</p>`).join('')}</li></ul>`;
  return `<section><h2${src(`${p}.title`)}>${esc(s.title)}</h2>${body}</section>`;
}

function bullets(e: Entry, ep: string): string {
  const items = srcLines(e.bullets);
  return items.length ? `<ul class="items">${items.map((b) => `<li${src(`${ep}.bullets`, b.line, b.off)}>${inline(b.text)}</li>`).join('')}</ul>` : '';
}

function subheading(e: Entry, ep: string): string {
  return `<li class="sub">
  <div class="row"><strong${src(`${ep}.title`)}>${inline(e.title)}</strong><span${src(`${ep}.location`)}>${inline(e.location)}</span></div>
  ${e.subtitle || e.date ? `<div class="row small"><em${src(`${ep}.subtitle`)}>${inline(e.subtitle)}</em><em${src(`${ep}.date`)}>${inline(e.date)}</em></div>` : ''}
  ${bullets(e, ep)}
</li>`;
}

function project(e: Entry, ep: string): string {
  const sub = e.subtitle.trim() ? ` <span class="sep">|</span> <em${src(`${ep}.subtitle`)}>${inline(e.subtitle)}</em>` : '';
  return `<li class="sub">
  <div class="row small"><span><strong${src(`${ep}.title`)}>${inline(e.title)}</strong>${sub}</span><span${src(`${ep}.date`)}>${inline(e.date)}</span></div>
  ${bullets(e, ep)}
</li>`;
}
