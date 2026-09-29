import type { Lang, Resume, Section, SectionKind } from './types';
import { sampleEn, sampleZh } from './samples';
import { uid } from './util';

const KEY = (lang: Lang) => `resume-en-ch:${lang}`;
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const KINDS: SectionKind[] = ['entries', 'projects', 'skills', 'text'];

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
  return {
    version: 1,
    lang,
    name: str(o.name),
    headline: str(o.headline),
    photo: photo.startsWith('data:image/') ? photo : '',
    contacts: arr(o.contacts).map((c0) => {
      const c = (c0 ?? {}) as Record<string, unknown>;
      return { text: str(c.text), link: str(c.link) };
    }),
    sections,
    pageSize: o.pageSize === 'a4' || o.pageSize === 'letter' ? o.pageSize : lang === 'en' ? 'letter' : 'a4',
  };
}

export function sample(lang: Lang): Resume {
  return lang === 'en' ? sampleEn() : sampleZh();
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
