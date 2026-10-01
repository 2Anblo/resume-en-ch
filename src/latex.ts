import type { Entry, Lang, Resume, Section } from './types';
import { cleanUrl, contactUrl, examScores, lines, splitLabel } from './util';

/**
 * Exports a resume as a LaTeX source file.
 * English resumes become Jake's Resume (https://github.com/jakegut/resume, MIT) for pdfLaTeX;
 * Chinese resumes become a ctex article for XeLaTeX.
 */
export function toLatex(r: Resume): string {
  return r.lang === 'en' ? jakeTex(r) : zhTex(r);
}

/* ---------- escaping ---------- */

const TEX: Record<string, string> = {
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', $: '\\$', '&': '\\&', '#': '\\#', '%': '\\%', _: '\\_',
  '^': '\\textasciicircum{}', '~': '\\textasciitilde{}', '<': '\\textless{}', '>': '\\textgreater{}', '|': '\\textbar{}',
};

export function tex(s: string): string {
  return String(s ?? '').replace(/[\\{}$&#%_^~<>|]/g, (c) => TEX[c]);
}

/** URL for \href: characters LaTeX cannot take inside an argument are percent-encoded, # and % escaped. */
export function texUrl(url: string): string {
  return url
    .replace(/[\\{}^\s]/g, (c) => encodeURIComponent(c))
    .replace(/[#%]/g, (c) => '\\' + c);
}

/** Escape, then turn **bold** into \textbf and [text](url) into \href, like util.inline does for HTML. */
export function texInline(s: string): string {
  const str = String(s ?? '');
  let out = '';
  let last = 0;
  for (const m of str.matchAll(/\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    out += tex(str.slice(last, m.index));
    if (m[1] !== undefined) out += `\\textbf{${texInline(m[1])}}`;
    else {
      const url = cleanUrl(m[3]);
      out += url ? `\\href{${texUrl(url)}}{${texInline(m[2])}}` : texInline(m[2]);
    }
    last = m.index! + m[0].length;
  }
  return out + tex(str.slice(last));
}

function link(text: string, url: string, underline = false): string {
  const t = underline ? `\\underline{${tex(text)}}` : tex(text);
  return url ? `\\href{${texUrl(url)}}{${t}}` : t;
}

const contactsOf = (r: Resume) => r.contacts.filter((c) => c.text.trim());

/* ---------- tables (table and exam sections) ---------- */

/** Lines with "|" become a full-width table (first row bold); other lines are paragraphs. */
function tableTex(text: string): string {
  const out: string[] = [];
  let rows: string[][] = [];
  const flush = () => {
    if (!rows.length) return;
    const n = Math.max(...rows.map((r) => r.length));
    const row = (r: string[], head: boolean) =>
      r
        .map((c, i) => {
          const cell = head ? `\\textbf{${texInline(c)}}` : texInline(c);
          const span = i === r.length - 1 && r.length < n ? n - r.length + 1 : 1;
          return span > 1 ? `\\multicolumn{${span}}{X|}{${cell}}` : cell;
        })
        .join(' & ') + ' \\\\ \\hline';
    out.push(
      `\\noindent\\begin{tabularx}{\\linewidth}{|${'X|'.repeat(n)}}\n\\hline\n${rows.map((r, i) => row(r, i === 0)).join('\n')}\n\\end{tabularx}\\par`,
    );
    rows = [];
  };
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.includes('|')) rows.push(line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    else {
      flush();
      out.push(`\\noindent ${texInline(line)}\\par`);
    }
  }
  flush();
  return out.join('\n');
}

/** 报考信息: 院校 / 专业 / 方向 and a 初试成绩 table with the total. */
const EXAM = {
  zh: { school: '报考院校', major: '报考专业', direction: '研究方向', scores: '初试成绩', total: '总分', colon: '：' },
  en: { school: 'Target school', major: 'Major', direction: 'Direction', scores: 'Scores', total: 'Total', colon: ': ' },
};

function examTex(s: Section, lang: Lang): string {
  const L = EXAM[lang];
  const e = s.entries[0] ?? { title: '', subtitle: '', location: '' };
  const facts = [[L.school, e.title], [L.major, e.subtitle], [L.direction, e.location]]
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `\\textbf{${k}${L.colon}}${texInline(v)}`)
    .join('\\qquad ');
  const rows = examScores(s.skills);
  const table = rows.length
    ? `\\noindent\\begin{tabularx}{\\linewidth}{|c|${'X|'.repeat(rows.length)}}
\\hline
\\multirow{2}{*}{\\textbf{${L.scores}}} & ${rows.map((r) => (r.total ? L.total : texInline(r.label))).join(' & ')} \\\\ \\cline{2-${rows.length + 1}}
 & ${rows.map((r) => (r.total ? `\\textbf{${texInline(r.value)}}` : texInline(r.value))).join(' & ')} \\\\ \\hline
\\end{tabularx}\\par`
    : '';
  return [facts ? `\\noindent ${facts}\\par` : '', table].filter(Boolean).join('\n\\vspace{4pt}\n');
}

/* ---------- English: Jake's Resume ---------- */

const JAKE_PREAMBLE = String.raw`%-------------------------
% Resume in LaTeX, exported from resume-en-ch (https://github.com/2Anblo/resume-en-ch)
% Based on Jake's Resume by Jake Gutierrez (https://github.com/jakegut/resume), MIT License
% Compile with ENGINE.
%------------------------

\documentclass[PAPER,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\usepackage{multirow}
CJKPKG\input{glyphtounicode}

\pagestyle{fancy}
\fancyhf{} % clear all header and footer fields
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Adjust margins
\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting
\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\pdfgentounicode=1

%-------------------------
% Custom commands
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}

\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

% Tables (table and exam sections) keep normal cell padding
\newenvironment{resumeTable}{\setlength{\tabcolsep}{4pt}\small}{}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%
`;

/** Chinese, Japanese or Korean text needs XeLaTeX with xeCJK; pdfLaTeX cannot typeset it. */
const CJK = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/;

function jakePreamble(r: Resume): string {
  const cjk = CJK.test(JSON.stringify({ ...r, photo: '' }));
  return JAKE_PREAMBLE.replace('PAPER', r.pageSize === 'a4' ? 'a4paper' : 'letterpaper')
    .replace('ENGINE', cjk ? 'XeLaTeX (the resume contains CJK text)' : 'pdfLaTeX (Overleaf default)')
    .replace('CJKPKG', cjk ? '\\usepackage{xeCJK}\n' : '')
    .replace('\\pdfgentounicode=1', cjk ? '' : '\\pdfgentounicode=1')
    .replace('\\input{glyphtounicode}\n', cjk ? '' : '\\input{glyphtounicode}\n');
}

function jakeTex(r: Resume): string {
  const contacts = contactsOf(r)
    .map((c) => {
      const url = contactUrl(c);
      return link(c.text, url, !!url);
    })
    .join(' $|$ ');
  const heading = `\\begin{center}
    \\textbf{\\Huge \\scshape ${tex(r.name)}} \\\\ \\vspace{1pt}
    \\small ${contacts}
\\end{center}`;
  return `${jakePreamble(r)}
\\begin{document}

${heading}

${r.sections.map(jakeSection).join('\n\n')}

%-------------------------------------------
\\end{document}
`;
}

function jakeItems(e: Entry): string {
  const items = lines(e.bullets);
  return items.length
    ? `\n      \\resumeItemListStart\n${items.map((b) => `        \\resumeItem{${texInline(b)}}`).join('\n')}\n      \\resumeItemListEnd`
    : '';
}

/** A free-form body inside the indented list Jake uses for Technical Skills. */
function jakeBlock(body: string): string {
  return ` \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
${body}
    }}
 \\end{itemize}`;
}

function jakeSection(s: Section): string {
  const head = `%-----------${s.title.toUpperCase()}-----------\n\\section{${tex(s.title)}}\n`;
  if (s.kind === 'entries')
    return `${head}  \\resumeSubHeadingListStart
${s.entries
  .map(
    (e) => `    \\resumeSubheading
      {${texInline(e.title)}}{${texInline(e.location)}}
      {${texInline(e.subtitle)}}{${texInline(e.date)}}${jakeItems(e)}`,
  )
  .join('\n')}
  \\resumeSubHeadingListEnd`;
  if (s.kind === 'projects')
    return `${head}    \\resumeSubHeadingListStart
${s.entries
  .map((e) => {
    const sub = e.subtitle.trim() ? ` $|$ \\emph{${texInline(e.subtitle)}}` : '';
    return `      \\resumeProjectHeading
          {\\textbf{${texInline(e.title)}}${sub}}{${texInline(e.date)}}${jakeItems(e)}`;
  })
  .join('\n')}
    \\resumeSubHeadingListEnd`;
  if (s.kind === 'skills') {
    const rows = s.skills
      .filter((k) => k.label.trim() || k.value.trim())
      .map((k) => `     \\textbf{${texInline(k.label)}}{${k.label.trim() ? ': ' : ''}${texInline(k.value)}}`);
    return head + jakeBlock(rows.join(' \\\\\n'));
  }
  if (s.kind === 'table') return head + jakeBlock(`\\begin{resumeTable}\n${tableTex(s.text)}\n\\end{resumeTable}`);
  if (s.kind === 'exam') return head + jakeBlock(`\\begin{resumeTable}\n${examTex(s, 'en')}\n\\end{resumeTable}`);
  return head + jakeBlock(lines(s.text).map((l) => `     ${texInline(l)}`).join(' \\\\\n'));
}

/* ---------- Chinese: ctex ---------- */

function zhTex(r: Resume): string {
  const contacts = contactsOf(r)
    .map((c) => {
      const [label, value] = splitLabel(c.text);
      const url = contactUrl(c);
      return `\\mbox{${label ? `${tex(label)}：${link(value, url)}` : link(c.text, url)}}`;
    })
    .join('\\quad\n  ');
  const hasPhoto = r.photo.startsWith('data:image/');
  const who = `{\\zihao{1}\\bfseries ${tex(r.name)}}\\par\\vspace{6pt}
  ${r.headline.trim() ? `{\\large\\color{accent}${texInline(r.headline)}}\\par\\vspace{4pt}\n  ` : ''}${contacts ? `{\\raggedright\\color{darkgray}${contacts}\\par}` : ''}`;
  const heading = hasPhoto
    ? `% 照片：把照片保存为 photo.jpg 并与本文件放在同一目录，然后去掉下面 \\includegraphics 一行开头的 %
\\noindent
\\begin{minipage}[t]{0.78\\textwidth}
  \\vspace{0pt}
  ${who}
\\end{minipage}\\hfill
\\begin{minipage}[t]{0.2\\textwidth}
  \\vspace{0pt}\\raggedleft
  % \\includegraphics[width=2.5cm]{photo.jpg}
\\end{minipage}`
    : `\\noindent
\\begin{minipage}[t]{\\textwidth}
  ${who}
\\end{minipage}`;

  return `% !TEX program = xelatex
%-------------------------
% 中文简历，由 resume-en-ch 导出（https://github.com/2Anblo/resume-en-ch）
% 请使用 XeLaTeX 编译（Overleaf：Menu → Compiler 选 XeLaTeX）
%-------------------------

\\documentclass[11pt,${r.pageSize === 'a4' ? 'a4paper' : 'letterpaper'}]{ctexart}

\\usepackage[top=15mm,bottom=14mm,left=16mm,right=16mm]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{xcolor}
\\usepackage{graphicx}
\\usepackage{tabularx}
\\usepackage{multirow}
\\usepackage[hidelinks]{hyperref}

% 英文连接号 – 按西文排版，保留两侧空格
\\xeCJKDeclareCharClass{Default}{"2013}

\\definecolor{accent}{HTML}{1F4E79}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\linespread{1.15}

\\titleformat{\\section}{\\large\\bfseries\\color{accent}}{}{0em}{}[{\\color{accent}\\titlerule[0.8pt]}]
\\titlespacing*{\\section}{0pt}{10pt}{5pt}

\\setlist[itemize]{leftmargin=1.2em, itemsep=1pt, topsep=2pt, parsep=0pt, label={\\color{accent}\\textbullet}}

% 条目：\\entry{标题}{副标题}{时间}
\\newcommand{\\entry}[3]{\\par\\vspace{3pt}\\noindent\\textbf{#1}\\quad #2\\hfill #3\\par}

\\begin{document}

${heading}

${r.sections.map(zhSection).join('\n\n')}

\\end{document}
`;
}

/** Items are LaTeX already. */
function zhItems(items: string[]): string {
  return items.length ? `\\begin{itemize}\n${items.map((b) => `  \\item ${b}`).join('\n')}\n\\end{itemize}` : '';
}

function zhSection(s: Section): string {
  const head = `\\section{${tex(s.title)}}\n`;
  if (s.kind === 'entries' || s.kind === 'projects')
    return (
      head +
      s.entries
        .map((e) => {
          const mid = [e.subtitle, s.kind === 'projects' ? '' : e.location].filter((x) => x.trim()).map(texInline).join(' · ');
          const items = zhItems(lines(e.bullets).map(texInline));
          return `\\entry{${texInline(e.title)}}{${mid}}{${texInline(e.date)}}${items ? '\n' + items : ''}`;
        })
        .join('\n')
    );
  if (s.kind === 'skills')
    return (
      head +
      zhItems(
        s.skills
          .filter((k) => k.label.trim() || k.value.trim())
          .map((k) => (k.label.trim() ? `\\textbf{${texInline(k.label)}：}` : '') + texInline(k.value)),
      )
    );
  if (s.kind === 'table') return head + tableTex(s.text);
  if (s.kind === 'exam') return head + examTex(s, 'zh');
  return head + lines(s.text).map((l) => `${texInline(l)}\\par`).join('\n');
}
