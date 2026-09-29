import type { Lang, Resume, TemplateId } from '../types';
import { renderFushi } from './fushi';
import { renderJake } from './jake';
import { renderNg } from './ng';
import { renderZh } from './zh';

export interface Template {
  id: TemplateId;
  name: { zh: string; en: string };
  langs: Lang[];
  render: (r: Resume) => string;
  /** Top and bottom page padding in CSS px; must match the template's padding in resume.css. */
  pad: [number, number];
  /** Which optional fields the template shows. */
  photo: boolean;
  headline: boolean;
}

const MM = 96 / 25.4;

export const TEMPLATES: Template[] = [
  { id: 'jake', name: { zh: "Jake's Resume", en: "Jake's Resume" }, langs: ['en'], render: renderJake, pad: [0.5 * 96, 0.45 * 96], photo: false, headline: false },
  { id: 'zh-simple', name: { zh: '简洁', en: 'Simple' }, langs: ['zh'], render: renderZh, pad: [16 * MM, 14 * MM], photo: true, headline: true },
  { id: 'fushi', name: { zh: '考研复试', en: 'Postgraduate (考研)' }, langs: ['zh'], render: renderFushi, pad: [15 * MM, 15 * MM], photo: true, headline: false },
  { id: 'ng', name: { zh: 'Resume-NG', en: 'Resume-NG' }, langs: ['zh', 'en'], render: renderNg, pad: [10 * MM, 6 * MM], photo: true, headline: true },
];

export function templatesFor(lang: Lang): Template[] {
  return TEMPLATES.filter((t) => t.langs.includes(lang));
}

export function templateOf(r: Resume): Template {
  return templatesFor(r.lang).find((t) => t.id === r.template) ?? templatesFor(r.lang)[0];
}
