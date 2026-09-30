import type { Dict } from './i18n';
import type { Resume, Section, SectionKind } from './types';
import { entry, examSection, section } from './samples';
import { esc } from './util';
import { templateOf } from './templates';

const KINDS: SectionKind[] = ['exam', 'entries', 'projects', 'skills', 'text', 'table'];

function field(label: string, path: string, value: string, opts: { area?: boolean; rows?: number; wide?: boolean } = {}): string {
  const control = opts.area
    ? `<textarea data-path="${path}" rows="${opts.rows ?? 3}">${esc(value)}</textarea>`
    : `<input type="text" data-path="${path}" value="${esc(value)}">`;
  return `<label class="field${opts.wide ? ' wide' : ''}"><span>${esc(label)}</span>${control}</label>`;
}

function iconBtn(action: string, args: string, label: string, glyph: string, danger = false): string {
  return `<button type="button" class="icon${danger ? ' danger' : ''}" data-action="${action}" data-args="${args}" title="${esc(label)}" aria-label="${esc(label)}">${glyph}</button>`;
}

function moveBtns(action: string, args: string, i: number, n: number, d: Dict): string {
  return `${i > 0 ? iconBtn(action, `${args}|-1`, d.up, '↑') : ''}${i < n - 1 ? iconBtn(action, `${args}|1`, d.down, '↓') : ''}`;
}

export function renderEditor(r: Resume, d: Dict, collapsed: Set<string>): string {
  const tpl = templateOf(r);
  const contacts = r.contacts
    .map(
      (c, i) => `<div class="row-fields">
        ${field(d.contactText, `contacts.${i}.text`, c.text)}
        ${field(d.contactLink, `contacts.${i}.link`, c.link)}
        <div class="row-actions">${moveBtns('moveContact', `${i}`, i, r.contacts.length, d)}${iconBtn('removeContact', `${i}`, d.remove, '✕', true)}</div>
      </div>`,
    )
    .join('');

  const photo =
    tpl.photo
      ? `<div class="field wide"><span>${d.photo}</span><div class="photo-row">
          ${r.photo ? `<img src="${esc(r.photo)}" alt="">` : ''}
          <label class="btn small">${d.uploadPhoto}<input type="file" accept="image/*" data-photo hidden></label>
          ${r.photo ? `<button type="button" class="btn small ghost" data-action="removePhoto" data-args="">${d.removePhoto}</button>` : ''}
        </div></div>`
      : '';

  return `
<details class="card" open>
  <summary><span class="card-title">${d.basics}</span></summary>
  <div class="grid">
    ${field(d.name, 'name', r.name, { wide: !tpl.headline })}
    ${tpl.headline ? field(d.headline, 'headline', r.headline) : ''}
    ${photo}
  </div>
  <h4>${d.contacts}</h4>
  ${contacts}
  <button type="button" class="btn small ghost" data-action="addContact" data-args="">+ ${d.addContact}</button>
</details>
${r.sections.map((s, i) => renderSection(s, i, r.sections.length, d, collapsed)).join('')}
<div class="add-section">
  <span>${d.addSection}：</span>
  ${KINDS.map((k) => `<button type="button" class="btn small ghost" data-action="addSection" data-args="${k}">+ ${d.kinds[k]}</button>`).join('')}
</div>`;
}

function renderSection(s: Section, si: number, n: number, d: Dict, collapsed: Set<string>): string {
  const p = `sections.${si}`;
  let body = '';
  if (s.kind === 'entries' || s.kind === 'projects') {
    const proj = s.kind === 'projects';
    body =
      s.entries
        .map(
          (e, ei) => `<div class="entry-card">
      <div class="entry-head"><span>#${ei + 1}</span><div class="row-actions">${moveBtns('moveEntry', `${si}|${ei}`, ei, s.entries.length, d)}${iconBtn('removeEntry', `${si}|${ei}`, d.remove, '✕', true)}</div></div>
      <div class="grid">
        ${field(proj ? d.projTitle : d.title, `${p}.entries.${ei}.title`, e.title)}
        ${proj ? field(d.date, `${p}.entries.${ei}.date`, e.date) : field(d.location, `${p}.entries.${ei}.location`, e.location)}
        ${field(proj ? d.projSubtitle : d.subtitle, `${p}.entries.${ei}.subtitle`, e.subtitle)}
        ${proj ? '' : field(d.date, `${p}.entries.${ei}.date`, e.date)}
        ${field(d.bullets, `${p}.entries.${ei}.bullets`, e.bullets, { area: true, rows: Math.max(2, e.bullets.split('\n').length), wide: true })}
      </div>
    </div>`,
        )
        .join('') + `<button type="button" class="btn small ghost" data-action="addEntry" data-args="${si}">+ ${d.addEntry}</button>`;
  } else if (s.kind === 'exam') {
    if (!s.entries.length) s.entries.push(entry());
    const e = s.entries[0];
    body =
      `<div class="grid">
        ${field(d.examSchool, `${p}.entries.0.title`, e.title)}
        ${field(d.examMajor, `${p}.entries.0.subtitle`, e.subtitle)}
        ${field(d.examDirection, `${p}.entries.0.location`, e.location, { wide: true })}
      </div><h4>${d.examScores}</h4>` +
      s.skills
        .map(
          (k, ki) => `<div class="row-fields">
        ${field(d.examSubject, `${p}.skills.${ki}.label`, k.label)}
        ${field(d.examScore, `${p}.skills.${ki}.value`, k.value)}
        <div class="row-actions">${moveBtns('moveSkill', `${si}|${ki}`, ki, s.skills.length, d)}${iconBtn('removeSkill', `${si}|${ki}`, d.remove, '✕', true)}</div>
      </div>`,
        )
        .join('') + `<button type="button" class="btn small ghost" data-action="addSkill" data-args="${si}">+ ${d.examAddSubject}</button>`;
  } else if (s.kind === 'skills') {
    body =
      s.skills
        .map(
          (k, ki) => `<div class="row-fields skills">
        ${field(d.skillLabel, `${p}.skills.${ki}.label`, k.label)}
        ${field(d.skillValue, `${p}.skills.${ki}.value`, k.value)}
        <div class="row-actions">${moveBtns('moveSkill', `${si}|${ki}`, ki, s.skills.length, d)}${iconBtn('removeSkill', `${si}|${ki}`, d.remove, '✕', true)}</div>
      </div>`,
        )
        .join('') + `<button type="button" class="btn small ghost" data-action="addSkill" data-args="${si}">+ ${d.addSkill}</button>`;
  } else {
    const table = s.kind === 'table';
    body = `<div class="grid">${field(table ? d.table : d.text, `${p}.text`, s.text, { area: true, rows: table ? Math.max(3, s.text.split('\n').length) : 4, wide: true })}</div>`;
  }

  return `
<details class="card" data-section="${s.id}"${collapsed.has(s.id) ? '' : ' open'}>
  <summary>
    <span class="card-title">${esc(s.title) || '—'}</span><span class="kind">${d.kinds[s.kind]}</span>
    <span class="row-actions">${moveBtns('moveSection', `${si}`, si, n, d)}${iconBtn('removeSection', `${si}`, d.remove, '✕', true)}</span>
  </summary>
  <div class="grid">${field(d.sectionTitle, `${p}.title`, s.title, { wide: true })}</div>
  ${body}
</details>`;
}

function move<T>(arr: T[], i: number, delta: number): void {
  const j = i + delta;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

/** Applies a structural edit. Returns true when the editor must be re-rendered. */
export function applyAction(r: Resume, action: string, args: string): boolean {
  const a = args.split('|');
  const n = a.map(Number);
  switch (action) {
    case 'addContact': r.contacts.push({ text: '', link: '' }); break;
    case 'removeContact': r.contacts.splice(n[0], 1); break;
    case 'moveContact': move(r.contacts, n[0], n[1]); break;
    case 'removePhoto': r.photo = ''; break;
    case 'addSection': {
      const kind = a[0] as SectionKind;
      const s = section(kind, '');
      if (kind === 'entries' || kind === 'projects') s.entries.push(entry());
      if (kind === 'skills') s.skills.push({ label: '', value: '' });
      if (kind === 'exam') Object.assign(s, examSection());
      r.sections.push(s);
      break;
    }
    case 'removeSection': r.sections.splice(n[0], 1); break;
    case 'moveSection': move(r.sections, n[0], n[1]); break;
    case 'addEntry': r.sections[n[0]].entries.push(entry()); break;
    case 'removeEntry': r.sections[n[0]].entries.splice(n[1], 1); break;
    case 'moveEntry': move(r.sections[n[0]].entries, n[1], n[2]); break;
    case 'addSkill': r.sections[n[0]].skills.push({ label: '', value: '' }); break;
    case 'removeSkill': r.sections[n[0]].skills.splice(n[1], 1); break;
    case 'moveSkill': move(r.sections[n[0]].skills, n[1], n[2]); break;
    default: return false;
  }
  return true;
}

export function setPath(obj: unknown, path: string, value: string): void {
  const keys = path.split('.');
  let cur = obj as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
}
