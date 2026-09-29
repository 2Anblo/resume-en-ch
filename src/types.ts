export type Lang = 'en' | 'zh';

export interface Contact {
  text: string;
  /** Optional URL; mailto:/tel: are fine too. */
  link: string;
}

export interface Entry {
  /** Bold left text: school, company, project name. */
  title: string;
  /** Second-row italic text (entries) or inline italic text after "|" (projects). */
  subtitle: string;
  location: string;
  date: string;
  /** One bullet per line. Supports **bold** inline. */
  bullets: string;
}

export interface SkillLine {
  label: string;
  value: string;
}

/**
 * entries: two rows (title / location, subtitle / date) + bullets — Education, Experience
 * projects: one row (title | subtitle, date) + bullets
 * skills: "Label: value" lines
 * text: free paragraph
 */
export type SectionKind = 'entries' | 'projects' | 'skills' | 'text';

export interface Section {
  id: string;
  kind: SectionKind;
  title: string;
  entries: Entry[];
  skills: SkillLine[];
  text: string;
}

export type PageSize = 'letter' | 'a4';

export interface Resume {
  version: 1;
  lang: Lang;
  name: string;
  /** Chinese template only: one-line headline such as 求职意向. */
  headline: string;
  /** Chinese template only: optional photo as a data URL. */
  photo: string;
  contacts: Contact[];
  sections: Section[];
  pageSize: PageSize;
}
