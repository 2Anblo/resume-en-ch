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
import { load, normalize, sample, save } from './store';
import { examSection, section } from './samples';
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
  page.innerHTML = templateOf(r).render(r);
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
  $<HTMLButtonElement>('#ui-lang').textContent = ui === 'zh' ? 'EN' : '中';
  $<HTMLSelectElement>('#page-size').value = cur().pageSize;
  $<HTMLSelectElement>('#template').innerHTML = templatesFor(lang)
    .map((tp) => `<option value="${tp.id}"${tp.id === templateOf(cur()).id ? ' selected' : ''}>${tp.name[ui]}</option>`)
    .join('');
  editor.innerHTML = renderEditor(cur(), d, collapsed);
  renderPreview();
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

editor.addEventListener('click', (e) => {
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

$<HTMLSelectElement>('#page-size').addEventListener('change', (e) => {
  cur().pageSize = (e.target as HTMLSelectElement).value as PageSize;
  changed();
});

$<HTMLSelectElement>('#template').addEventListener('change', (e) => {
  const r = cur();
  r.template = (e.target as HTMLSelectElement).value as TemplateId;
  // 报考信息 is the heart of the 考研复试 template: add it on top if the resume has none.
  if (r.template === 'fushi' && !r.sections.some((s) => s.kind === 'exam' || s.title.trim() === '报考信息')) r.sections.unshift(section('exam', '报考信息', examSection()));
  changed(true);
});

$('#reset').addEventListener('click', () => {
  if (!confirm(t(ui).resetConfirm)) return;
  docs[lang] = sample(lang, cur().template);
  save(cur());
  renderAll();
});

function fileName(ext: string) {
  const base = (cur().name.trim() || 'resume').replace(/[\\/:*?"<>|\s]+/g, '_');
  return `${base}_${lang === 'en' ? 'Resume' : '简历'}.${ext}`;
}

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(cur(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName('json');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$<HTMLInputElement>('#import-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const r = normalize(JSON.parse(await file.text()), lang);
    lang = r.lang;
    docs[lang] = r;
    save(r);
    savePrefs();
    renderAll();
  } catch {
    alert(t(ui).importError);
  }
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
