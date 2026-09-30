import type { Lang, Resume, Section, SectionKind, TemplateId } from './types';
import { templatesFor } from './templates';
import { entry, examSection, sampleEn, sampleFushi, sampleZh, section } from './samples';
import { uid } from './util';

const KEY = (lang: Lang) => `resume-en-ch:${lang}`;
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const KINDS: SectionKind[] = ['entries', 'projects', 'skills', 'text', 'table', 'exam'];

/** Coerces untrusted JSON (import / localStorage) into a well-formed Resume. */
export function normalize(raw: unknown, fallbackLang: Lang): Resume {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const lang: Lang = o.lang === 'en' || o.lang === 'zh' ? o.lang : fallbackLang;
  const sections: Section[] = arr(o.sections).map((s0) => {
    const s = (s0 ?? {}) as Record<string, unknown>;
    const kind = KINDS.includes(s.kind as SectionKind) ? (s.kind as SectionKind) : 'entries';
    return {
      id: str(s.id) || uid(),
      kind,
      title: str(s.title),
      entries: arr(s.entries).map((e0) => {
        const e = (e0 ?? {}) as Record<string, unknown>;
        const bullets = Array.isArray(e.bullets) ? e.bullets.map(str).join('\n') : str(e.bullets);
        return { title: str(e.title), subtitle: str(e.subtitle), location: str(e.location), date: str(e.date), bullets };
      }),
      skills: arr(s.skills).map((k0) => {
        const k = (k0 ?? {}) as Record<string, unknown>;
        return { label: str(k.label), value: str(k.value) };
      }),
      text: str(s.text),
    };
  });
  const photo = str(o.photo);
  return ensureExam({
    version: 1,
    lang,
    template: templatesFor(lang).some((t) => t.id === o.template) ? (o.template as TemplateId) : templatesFor(lang)[0].id,
    name: str(o.name),
    headline: str(o.headline),
    photo: photo.startsWith('data:image/') ? photo : '',
    contacts: arr(o.contacts).map((c0) => {
      const c = (c0 ?? {}) as Record<string, unknown>;
      return { text: str(c.text), link: str(c.link) };
    }),
    sections,
    pageSize: o.pageSize === 'a4' || o.pageSize === 'letter' ? o.pageSize : lang === 'en' ? 'letter' : 'a4',
  });
}

export function sample(lang: Lang, template?: TemplateId): Resume {
  if (lang === 'zh' && template === 'fushi') return sampleFushi();
  const r = lang === 'en' ? sampleEn() : sampleZh();
  if (template && templatesFor(lang).some((t) => t.id === template)) r.template = template;
  return r;
}

export function load(lang: Lang): Resume {
  try {
    const raw = localStorage.getItem(KEY(lang));
    if (raw) return normalize(JSON.parse(raw), lang);
  } catch {
    /* storage unavailable or corrupt: fall back to the sample */
  }
  return sample(lang);
}

export function save(r: Resume): void {
  try {
    localStorage.setItem(KEY(r.lang), JSON.stringify(r));
  } catch {
    /* quota exceeded or storage blocked: editing still works for this session */
  }
}

/**
 * The 考研复试 template always shows 报考信息 first. Adds the section when missing and upgrades
 * the earlier "|"-table version (院校/专业 line + 初试成绩 rows) into the structured section.
 */
export function ensureExam(r: Resume): Resume {
  if (r.template !== 'fushi' || r.sections.some((s) => s.kind === 'exam')) return r;
  const i = r.sections.findIndex((s) => s.kind === 'table' && s.title.trim() === '报考信息');
  if (i < 0) {
    r.sections.unshift(section('exam', '报考信息', examSection()));
    return r;
  }
  const old = r.sections[i];
  const plain = (x: string) => x.replace(/\*\*/g, '').trim();
  const text = plain(old.text);
  const pick = (label: string) => new RegExp(`${label}[：:]\\s*([^\\s　|]+)`).exec(text)?.[1] ?? '';
  const rows = old.text.split('\n').filter((l) => l.includes('|')).map((l) => l.split('|').map(plain));
  const [head = [], vals = []] = rows;
  const skills = head.slice(1).map((label, c) => ({ label, value: vals[c + 1] ?? '' })).filter((k) => k.label && !/^(总分|合计)$/.test(k.label));
  r.sections[i] = { ...old, kind: 'exam', text: '', entries: [entry({ title: pick('报考院校'), subtitle: pick('报考专业'), location: pick('研究方向') })], skills };
  return r;
}
