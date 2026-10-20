import type { Entry, Resume, Section } from '../types';
import { contactHref, esc, inline, src, srcLines, srcSpan, tableHtml, examHtml } from '../util';

/** HTML take on Resume-NG by Feng Kaiyu (https://github.com/fky2015/resume-ng, LPPL 1.3c). */
export function renderNg(r: Resume): string {
  const contacts = r.contacts
    .flatMap((c, i) => {
      if (!c.text.trim()) return [];
      const href = contactHref(c);
      const at = src(`contacts.${i}.text`);
      return [href ? `<a href="${href}"><u${at}>${esc(c.text)}</u></a>` : `<span${at}>${esc(c.text)}</span>`];
    })
    .join('<span class="sep">|</span>');
  const photo = r.photo && r.photo.startsWith('data:image/') ? `<img class="photo" src="${esc(r.photo)}" alt="">` : '';

  return `
<div class="ng" lang="${r.lang === 'zh' ? 'zh-CN' : 'en'}">
  ${photo}
  <header class="heading${photo ? ' has-photo' : ''}">
    <h1${src('name')}>${esc(r.name)}</h1>
    ${r.headline.trim() ? `<div class="headline"${src('headline')}>${inline(r.headline)}</div>` : ''}
    ${contacts ? `<div class="contacts">${contacts}</div>` : ''}
  </header>
  ${r.sections.map(renderSection).join('')}
</div>`;
}

function renderSection(s: Section, si: number): string {
  const p = `sections.${si}`;
  let body = '';
  if (s.kind === 'entries' || s.kind === 'projects') body = s.entries.map((e, ei) => entry(e, `${p}.entries.${ei}`)).join('');
  else if (s.kind === 'skills')
    body = `<ul>${s.skills
      .flatMap((k, ki) =>
        k.label.trim() || k.value.trim()
          ? [`<li>${k.label.trim() ? `<strong${src(`${p}.skills.${ki}.label`)}>${inline(k.label)}</strong>: ` : ''}${srcSpan(`${p}.skills.${ki}.value`, k.value)}</li>`]
          : [],
      )
      .join('')}</ul>`;
  else if (s.kind === 'table') body = tableHtml(s.text, `${p}.text`);
  else if (s.kind === 'exam') body = examHtml(s, p);
  else body = `<ul>${srcLines(s.text).map((l) => `<li${src(`${p}.text`, l.line, l.off)}>${inline(l.text)}</li>`).join('')}</ul>`;
  return `<section><h2${src(`${p}.title`)}>${esc(s.title)}</h2>${body}</section>`;
}

function entry(e: Entry, ep: string): string {
  const items = srcLines(e.bullets);
  const extra = (['subtitle', 'location'] as const)
    .filter((f) => e[f].trim())
    .map((f) => `<span class="sep">|</span><span class="kai"${src(`${ep}.${f}`)}>${inline(e[f])}</span>`)
    .join('');
  return `<div class="entry">
  <div class="row"><span><strong class="hei"${src(`${ep}.title`)}>${inline(e.title)}</strong>${extra}</span><span class="date"${src(`${ep}.date`)}>${inline(e.date)}</span></div>
  ${items.length ? `<ul>${items.map((b) => `<li${src(`${ep}.bullets`, b.line, b.off)}>${inline(b.text)}</li>`).join('')}</ul>` : ''}
</div>`;
}
