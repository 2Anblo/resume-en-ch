import type { Contact, Entry, Resume } from './types';
import { splitLabel } from './util';

export const MASK = '███';

const EDU_SECTION = /education|教育|学历|学业/i;
const SCHOOL_SUFFIX = /(大学|学院|学校|中学|University|College|Institute(?: of Technology)?|School)$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.([^\s@.]+)$/;
const URLISH = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(\/.*)?$/i;

/** Keep the separators of a phone number so readers still see a phone number. */
const maskDigits = (s: string) => s.replace(/\d+/g, MASK);

function maskValue(text: string): string {
  let m: RegExpMatchArray | null;
  if ((m = text.match(EMAIL))) return `${MASK}@${MASK}.${m[1]}`;
  if ((text.match(/\d/g) ?? []).length >= 7 && /^[+\d\s().-]+$/.test(text)) return maskDigits(text);
  if ((m = text.match(URLISH)) && m[2]) return `${m[1]}/${MASK}`;
  // Address, city, WeChat ID, birthday and anything else we cannot classify.
  return MASK;
}

/** "电话：138-0000-0000" → "电话：███-███-███": the label stays so readers know what was there. */
function maskContact(c: Contact): { contact: Contact; value: string; masked: string } {
  const [label, value] = splitLabel(c.text.trim());
  const masked = maskValue(value.trim());
  return { contact: { text: label ? `${label}：${masked}` : masked, link: '' }, value, masked };
}

/** "Southwestern University" → "███ University", "复旦大学" → "███大学". */
function maskSchool(s: string): string {
  const m = s.trim().match(SCHOOL_SUFFIX);
  if (!m) return MASK;
  return /^[a-z]/i.test(m[1]) ? `${MASK} ${m[1]}` : `${MASK}${m[1]}`;
}

/** [text](url) → text, so links cannot leak a profile or a personal site. */
const stripLinks = (s: string) => s.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1');

/**
 * Returns a copy of the resume that is safe to post publicly for feedback:
 * name, photo, contacts, and the school / degree / location of education entries are masked,
 * and the masked strings are also replaced wherever else they appear (e.g. a campus job).
 */
export function redact(src: Resume): Resume {
  const r: Resume = structuredClone(src);
  const replacements = new Map<string, string>();
  const remember = (from: string, to: string) => {
    const f = from.trim();
    if (f.length >= 2 && f !== to) replacements.set(f, to);
  };

  const name = r.lang === 'zh' ? '候选人' : 'Candidate';
  remember(r.name, name);
  r.name = name;
  r.photo = '';

  r.contacts = r.contacts.map((c) => {
    const { contact, value, masked } = maskContact(c);
    // Only the specific values (email, phone, profile URL) are replaced elsewhere;
    // a bare city like "上海" would also wipe out unrelated work locations.
    if (masked !== MASK) remember(value, masked);
    return contact;
  });

  for (const s of r.sections) {
    if (s.kind === 'exam') {
      // 报考信息: hide the target school, keep the major and scores that reviewers comment on.
      s.entries = s.entries.map((e) => {
        const title = e.title.trim() ? maskSchool(e.title) : '';
        remember(e.title, title);
        return { ...e, title };
      });
      continue;
    }
    if (s.kind !== 'entries' || !EDU_SECTION.test(s.title)) continue;
    s.entries = s.entries.map((e): Entry => {
      const title = e.title.trim() ? maskSchool(e.title) : '';
      remember(e.title, title);
      return { ...e, title, subtitle: e.subtitle.trim() ? MASK : '', location: e.location.trim() ? MASK : '' };
    });
  }

  // Longest first so "Southwestern University" wins over a shorter overlapping value.
  const pairs = [...replacements].sort((a, b) => b[0].length - a[0].length);
  const scrub = (s: string) => pairs.reduce((acc, [from, to]) => acc.split(from).join(to), stripLinks(s));

  r.headline = scrub(r.headline);
  for (const s of r.sections) {
    s.title = scrub(s.title);
    s.text = scrub(s.text);
    s.skills = s.skills.map((k) => ({ label: scrub(k.label), value: scrub(k.value) }));
    s.entries = s.entries.map((e) => ({
      title: scrub(e.title),
      subtitle: scrub(e.subtitle),
      location: scrub(e.location),
      date: e.date,
      bullets: scrub(e.bullets),
    }));
  }
  return r;
}
