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
 * table: `text` holds rows, cells separated by "|"; the first row is the header
 * exam: 报考信息 — entries[0] holds 院校 (title), 专业 (subtitle), 研究方向 (location); skills hold 科目/分数
 */
export type SectionKind = 'entries' | 'projects' | 'skills' | 'text' | 'table' | 'exam';

export interface Section {
  id: string;
  kind: SectionKind;
  title: string;
  entries: Entry[];
  skills: SkillLine[];
  text: string;
}

export type PageSize = 'letter' | 'a4';

export type TemplateId = 'jake' | 'zh-simple' | 'ng' | 'fushi';

export interface Resume {
  version: 1;
  lang: Lang;
  template: TemplateId;
  name: string;
  /** One-line headline such as 求职意向 (templates with `headline`). */
  headline: string;
  /** Optional photo as a data URL (templates with `photo`). */
  photo: string;
  contacts: Contact[];
  sections: Section[];
  pageSize: PageSize;
}
