import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/tinos/400.css';
import '@fontsource/tinos/700.css';
import '@fontsource/noto-sans-sc/700.css';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/700.css';
import 'lxgw-wenkai-webfont/lxgwwenkai-regular.css';
import './styles/app.css';
import './styles/resume.css';

import { applyAction, renderEditor, setPath } from './editor';
import { t, type UiLang } from './i18n';
import { toLatex } from './latex';
import { redact } from './redact';
import { ensureExam, load, normalize, sample, save } from './store';
import { canSync, FileSync, pickFile, requestWrite, type FileSource, type Resolution } from './sync';
import { templateOf, templatesFor } from './templates';
import type { Lang, PageSize, Resume, TemplateId } from './types';

const PREF = 'resume-en-ch:prefs';
const prefs = (() => {
  try {
    return JSON.parse(localStorage.getItem(PREF) || '{}') as { lang?: Lang; ui?: UiLang };
  } catch {
    return {};
  }
})();

let lang: Lang = prefs.lang === 'zh' || prefs.lang === 'en' ? prefs.lang : 'en';
let ui: UiLang = prefs.ui === 'en' || prefs.ui === 'zh' ? prefs.ui : navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
const docs: Record<Lang, Resume> = { en: load('en'), zh: load('zh') };
const collapsed = new Set<string>();
/** Not persisted: forgetting it is on would send a masked resume to a real employer. */
let redacted = false;
/** Local files kept in step by "Live sync": one per resume language, so both can be edited on one page. */
const syncs: Partial<Record<Lang, FileSync>> = {};
const cur = () => docs[lang];

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const editor = $('#editor');
const page = $('#page');
const pageStyle = $<HTMLStyleElement>('#page-style');

function savePrefs() {
  try {
    localStorage.setItem(PREF, JSON.stringify({ lang, ui }));
  } catch {
    /* ignore */
  }
}

function renderPreview() {
  const r = cur();
  page.dataset.size = r.pageSize;
  const shown = redacted ? redact(r) : r;
  page.innerHTML = templateOf(shown).render(shown);
  // Zero @page margin leaves browsers no room for their date/URL header and footer;
  // the template's own padding (cloned onto every printed page) provides the margins.
  pageStyle.textContent = `@page { size: ${r.pageSize === 'a4' ? 'A4' : 'letter'}; margin: 0; }`;
  fitPreview();
}

function renderAll() {
  const d = t(ui);
  document.documentElement.lang = ui === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = d[el.dataset.i18n as keyof typeof d] as string;
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    el.title = d[el.dataset.i18nTitle as keyof typeof d] as string;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-tpl]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tpl === lang)));
  const redactBtn = $<HTMLButtonElement>('#redact');
  redactBtn.textContent = redacted ? d.redactOn : d.redact;
  redactBtn.setAttribute('aria-pressed', String(redacted));
  $('#redact-notice').hidden = !redacted;
  renderSync();
  $<HTMLButtonElement>('#ui-lang').textContent = ui === 'zh' ? 'EN' : '中';
  $<HTMLSelectElement>('#page-size').value = cur().pageSize;
  $<HTMLSelectElement>('#template').innerHTML = templatesFor(lang)
    .map((tp) => `<option value="${tp.id}"${tp.id === templateOf(cur()).id ? ' selected' : ''}>${tp.name[ui]}</option>`)
    .join('');
  editor.innerHTML = renderEditor(cur(), d, collapsed);
  renderPreview();
}

function renderSync() {
  const d = t(ui);
  const btn = $<HTMLButtonElement>('#sync');
  const f = syncs[lang];
  btn.textContent = f ? `${f.writable ? d.syncOn : d.syncReadOnly} · ${f.source.name}` : d.sync;
  btn.title = f ? (f.writable ? d.syncStop : d.syncReadOnlyTip + d.syncStop) : d.syncTip;
  btn.setAttribute('aria-pressed', String(!!f));
  // A dot on each language tab whose resume is synced, so the other tab's sync is not forgotten.
  document.querySelectorAll<HTMLButtonElement>('[data-tpl]').forEach((b) => b.classList.toggle('synced', !!syncs[b.dataset.tpl as Lang]));
}

function stopSync(l: Lang) {
  syncs[l]?.stop();
  delete syncs[l];
  renderSync();
}

let saveTimer = 0;
function changed(rerenderEditor = false) {
  if (rerenderEditor) {
    const y = editor.scrollTop;
    editor.innerHTML = renderEditor(cur(), t(ui), collapsed);
    editor.scrollTop = y;
  }
  renderPreview();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => save(cur()), 300);
  fileEdited();
}

/** Tells live sync the open resume changed, if a file is synced for it. */
function fileEdited() {
  syncs[lang]?.edited();
}

/* ---------- preview scaling ---------- */
const stage = $('#stage');
function fitPreview() {
  const avail = stage.clientWidth - 32;
  const w = page.offsetWidth;
  const scale = Math.min(1, avail / w);
  page.style.transform = `scale(${scale})`;
  (page.parentElement as HTMLElement).style.height = `${page.offsetHeight * scale}px`;
  (page.parentElement as HTMLElement).style.width = `${w * scale}px`;
  drawBreaks();
}

/** Dashed guides where printed page breaks will fall. */
function drawBreaks() {
  page.querySelectorAll('.page-break').forEach((el) => el.remove());
  const pageH = cur().pageSize === 'a4' ? (297 * 96) / 25.4 : 11 * 96;
  const [top, bottom] = templateOf(cur()).pad;
  const contentH = pageH - top - bottom;
  for (let y = top + contentH; y < page.scrollHeight - bottom; y += contentH) {
    const line = document.createElement('div');
    line.className = 'page-break';
    line.style.top = `${y}px`;
    page.appendChild(line);
  }
}
new ResizeObserver(fitPreview).observe(stage);

/* ---------- editor events ---------- */
editor.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.path) {
    setPath(cur(), el.dataset.path, el.value);
    if (/^sections\.\d+\.title$/.test(el.dataset.path)) {
      const title = el.closest('details')?.querySelector('.card-title');
      if (title) title.textContent = el.value || '—';
    }
    changed();
  }
});

editor.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.photo === undefined || !el.files?.[0]) return;
  const file = el.files[0];
  const img = new Image();
  img.onload = () => {
    // Downscale so the photo does not bloat localStorage.
    const W = 300, H = 390;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const s = Math.max(W / img.width, H / img.height);
    ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    cur().photo = canvas.toDataURL('image/jpeg', 0.88);
    URL.revokeObjectURL(img.src);
    changed(true);
  };
  img.src = URL.createObjectURL(file);
});

/* ---------- drag to reorder sections ---------- */
// Pointer events (not HTML5 drag and drop) so it also works with touch. While dragging, the card stays
// in place (faded), a ghost of its header follows the pointer and a line marks where it will land.
interface Drag {
  card: HTMLElement;
  id: number;
  startY: number;
  offsetY: number;
  active: boolean;
  ghost?: HTMLElement;
  line?: HTMLElement;
  /** Index among section cards (excluding the dragged one) to insert before. */
  target: number;
}
let drag: Drag | null = null;
let suppressClick = false;

const sectionCards = () => [...editor.querySelectorAll<HTMLElement>('details[data-section]')];

editor.addEventListener('pointerdown', (e) => {
  const zone = (e.target as HTMLElement).closest<HTMLElement>('summary.drag-zone');
  if (!zone || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
  const card = zone.parentElement as HTMLElement;
  drag = { card, id: e.pointerId, startY: e.clientY, offsetY: e.clientY - zone.getBoundingClientRect().top, active: false, target: -1 };
});

function startDrag(e: PointerEvent, d: Drag) {
  d.active = true;
  const summary = d.card.querySelector('summary') as HTMLElement;
  summary.setPointerCapture(e.pointerId);
  const rect = summary.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.style.width = `${d.card.getBoundingClientRect().width}px`;
  ghost.innerHTML = summary.innerHTML;
  ghost.querySelector('.row-actions')?.remove();
  ghost.style.left = `${rect.left}px`;
  document.body.appendChild(ghost);
  const line = document.createElement('div');
  line.className = 'drop-line';
  editor.appendChild(line);
  d.ghost = ghost;
  d.line = line;
  d.card.classList.add('dragging');
  editor.classList.add('is-dragging');
}

editor.addEventListener('pointermove', (e) => {
  const d = drag;
  if (!d || e.pointerId !== d.id) return;
  if (!d.active) {
    if (Math.abs(e.clientY - d.startY) < 6) return;
    startDrag(e, d);
  }
  e.preventDefault();
  d.ghost!.style.top = `${e.clientY - d.offsetY}px`;

  const others = sectionCards().filter((c) => c !== d.card);
  let target = others.findIndex((c) => {
    const r = c.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2;
  });
  if (target < 0) target = others.length;
  d.target = target;

  // Place the line in the gap before `others[target]` (or after the last card).
  const box = editor.getBoundingClientRect();
  const gap = 6;
  const y =
    target < others.length
      ? others[target].getBoundingClientRect().top - gap
      : (others[others.length - 1] ?? d.card).getBoundingClientRect().bottom + gap;
  d.line!.style.top = `${y - box.top + editor.scrollTop}px`;
  // Hide the line when dropping would not change anything.
  const from = sectionCards().indexOf(d.card);
  d.line!.classList.toggle('noop', target === from);

  if (e.clientY < box.top + 40) editor.scrollTop -= 12;
  else if (e.clientY > box.bottom - 40) editor.scrollTop += 12;
});

function endDrag() {
  const d = drag;
  drag = null;
  if (!d?.active) return;
  d.ghost?.remove();
  d.line?.remove();
  d.card.classList.remove('dragging');
  editor.classList.remove('is-dragging');
  suppressClick = true; // the pointerup is followed by a click on <summary>; don't toggle the card
  const r = cur();
  const from = r.sections.findIndex((s) => s.id === d.card.dataset.section);
  if (from < 0 || d.target < 0 || d.target === from) return;
  const [moved] = r.sections.splice(from, 1);
  r.sections.splice(d.target, 0, moved);
  changed(true);
  const card = editor.querySelector<HTMLElement>(`details[data-section="${moved.id}"]`);
  card?.classList.add('just-dropped');
  setTimeout(() => card?.classList.remove('just-dropped'), 700);
}
editor.addEventListener('pointerup', endDrag);
editor.addEventListener('pointercancel', endDrag);

editor.addEventListener('click', (e) => {
  if (suppressClick) {
    suppressClick = false;
    if ((e.target as HTMLElement).closest('summary')) {
      e.preventDefault();
      return;
    }
  }
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!btn) return;
  e.preventDefault(); // buttons live inside <summary>; don't toggle the card
  if (btn.dataset.action === 'removeSection') {
    const s = cur().sections[Number(btn.dataset.args)];
    if (s && !confirm(`${t(ui).remove}「${s.title || '—'}」?`)) return;
  }
  if (applyAction(cur(), btn.dataset.action!, btn.dataset.args ?? '')) changed(true);
});

editor.addEventListener('toggle', (e) => {
  const d = e.target as HTMLDetailsElement;
  const id = d.dataset.section;
  if (!id) return;
  if (d.open) collapsed.delete(id);
  else collapsed.add(id);
}, true);

/* ---------- toolbar ---------- */
document.querySelectorAll<HTMLButtonElement>('[data-tpl]').forEach((b) =>
  b.addEventListener('click', () => {
    lang = b.dataset.tpl as Lang;
    savePrefs();
    renderAll();
  }),
);

$('#ui-lang').addEventListener('click', () => {
  ui = ui === 'zh' ? 'en' : 'zh';
  savePrefs();
  renderAll();
});

$('#redact').addEventListener('click', () => {
  redacted = !redacted;
  renderAll();
});

$<HTMLSelectElement>('#page-size').addEventListener('change', (e) => {
  cur().pageSize = (e.target as HTMLSelectElement).value as PageSize;
  changed();
});

$<HTMLSelectElement>('#template').addEventListener('change', (e) => {
  const r = cur();
  r.template = (e.target as HTMLSelectElement).value as TemplateId;
  // 报考信息 is the heart of the 考研复试 template: add it on top if the resume has none.
  ensureExam(r);
  changed(true);
});

$('#reset').addEventListener('click', () => {
  if (!confirm(t(ui).resetConfirm)) return;
  docs[lang] = sample(lang, cur().template);
  save(cur());
  renderAll();
  fileEdited();
});

function fileName(ext: string) {
  const base = (redacted ? 'redacted' : cur().name.trim() || 'resume').replace(/[\\/:*?"<>|\s]+/g, '_');
  return `${base}_${lang === 'en' ? 'Resume' : '简历'}.${ext}`;
}

function downloadText(text: string, type: string, name: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#export').addEventListener('click', () => downloadText(JSON.stringify(cur(), null, 2), 'application/json', fileName('json')));

$('#export-tex').addEventListener('click', () => downloadText(toLatex(redacted ? redact(cur()) : cur()), 'application/x-tex', fileName('tex')));

/** Parses an exported resume JSON. Throws if `text` is not valid JSON. */
const parseResume = (text: string, fallback: Lang): Resume => normalize(JSON.parse(text.replace(/^﻿/, '')), fallback);

/** Puts `r` in its language's slot, switching to that tab when `show`; redraws only if it is on screen. */
function applyResume(r: Resume, show: boolean) {
  docs[r.lang] = r;
  save(r);
  if (show && r.lang !== lang) {
    lang = r.lang;
    savePrefs();
  }
  if (r.lang !== lang) return;
  // Keep the editor where it was, including the focused field, when the file is reloaded under it.
  const y = editor.scrollTop;
  const focused = (document.activeElement as HTMLElement | null)?.dataset?.path;
  renderAll();
  editor.scrollTop = y;
  if (focused) editor.querySelector<HTMLElement>(`[data-path="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
}

$<HTMLInputElement>('#import-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    applyResume(parseResume(await file.text(), lang), true);
    fileEdited();
  } catch {
    alert(t(ui).importError);
  }
});

/* ---------- live sync with a local file (e.g. one an AI agent edits over MCP) ---------- */
const syncBtn = $<HTMLButtonElement>('#sync');
syncBtn.hidden = !canSync();
syncBtn.addEventListener('click', async () => {
  const current = syncs[lang];
  if (current) {
    await current.flush();
    stopSync(lang);
    return;
  }
  let source: FileSource | null;
  try {
    source = await pickFile();
  } catch {
    alert(t(ui).importError);
    return;
  }
  if (!source) return;
  const writable = await requestWrite(source);
  // The file's own language decides which resume it syncs with, whichever tab is open.
  let fileLang: Lang;
  try {
    fileLang = parseResume(await (await source.getFile()).text(), lang).lang;
  } catch {
    alert(t(ui).importError);
    return;
  }
  const old = syncs[fileLang];
  if (old) {
    await old.flush();
    old.stop();
  }
  const name = source.name;
  const file = new FileSync(
    source,
    {
      load(text) {
        applyResume({ ...parseResume(text, fileLang), lang: fileLang }, false);
      },
      dump: () => JSON.stringify(docs[fileLang], null, 2) + '\n',
      conflict: () => askConflict(name),
      fail() {
        if (syncs[fileLang] === file) stopSync(fileLang);
        alert(`${t(ui).syncLost} ${name}`);
      },
    },
    writable,
  );
  syncs[fileLang] = file;
  if (fileLang !== lang) {
    lang = fileLang;
    savePrefs();
    renderAll();
  } else renderSync();
  file.start();
});

/** One conflict dialog at a time: with two files synced, both could ask at once. */
let conflictQueue: Promise<unknown> = Promise.resolve();
function askConflict(name: string): Promise<Resolution> {
  const next = conflictQueue.then(() => showConflict(name));
  conflictQueue = next.catch(() => {});
  return next;
}

/** Modal choice between the file's and the page's version; it cannot be dismissed without choosing. */
function showConflict(name: string): Promise<Resolution> {
  const dlg = $<HTMLDialogElement>('#conflict');
  $('#conflict-file').textContent = name;
  return new Promise((resolve) => {
    let chosen = false;
    const onClick = (e: Event) => {
      const v = (e.target as HTMLElement).closest('button')?.value;
      if (v !== 'file' && v !== 'page') return;
      chosen = true;
      dlg.removeEventListener('click', onClick);
      dlg.removeEventListener('close', onClose);
      dlg.close();
      resolve(v);
    };
    const onClose = () => {
      if (!chosen) dlg.showModal();
    };
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('close', onClose);
    dlg.showModal();
  });
}
$<HTMLDialogElement>('#conflict').addEventListener('cancel', (e) => e.preventDefault());

window.addEventListener('beforeunload', (e) => {
  const pending = Object.values(syncs).filter((f) => f.pending);
  if (!pending.length) return;
  for (const f of pending) void f.flush();
  e.preventDefault();
});

$('#download').addEventListener('click', async () => {
  save(cur());
  await document.fonts.ready;
  // Browsers use the document title as the default PDF file name.
  const title = document.title;
  document.title = fileName('pdf').replace(/\.pdf$/, '');
  window.print();
  document.title = title;
});

renderAll();
document.fonts.ready.then(fitPreview);
