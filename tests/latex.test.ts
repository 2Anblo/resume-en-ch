import { describe, expect, it } from 'vitest';
import { tex, texInline, texUrl, toLatex } from '../src/latex';
import { sampleEn, sampleFushi, sampleZh, section } from '../src/samples';

describe('latex', () => {
  it('escapes special characters', () => {
    expect(tex('100% & #1 $5 a_b {x} ~ ^ \\ <|>')).toBe(
      '100\\% \\& \\#1 \\$5 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{} \\textless{}\\textbar{}\\textgreater{}',
    );
  });
  it('converts **bold** and safe links', () => {
    expect(texInline('**A&B** see [site](example.com/a#b)')).toBe('\\textbf{A\\&B} see \\href{https://example.com/a\\#b}{site}');
    expect(texInline('[x](javascript:alert)')).toBe('x');
    expect(texUrl('https://x.y/{z} 50%')).toBe('https://x.y/\\%7Bz\\%7D\\%2050\\%');
  });
  it('exports English resumes as Jake\'s Resume for pdfLaTeX', () => {
    const r = sampleEn();
    const out = toLatex(r);
    expect(out).toContain('\\documentclass[letterpaper,11pt]{article}');
    expect(out).toContain('\\textbf{\\Huge \\scshape Jake Ryan}');
    expect(out).toContain('{Southwestern University}{Georgetown, TX}');
    expect(out).toContain('\\resumeItem{Explored methods to generate video game dungeons based off of \\textbf{The Legend of Zelda}}');
    expect(out).toContain('\\href{mailto:jake@su.edu}{\\underline{jake@su.edu}}');
    expect(out).not.toContain('xeCJK');
    r.name = '张三';
    expect(toLatex(r)).toContain('\\usepackage{xeCJK}');
  });
  it('exports Chinese resumes as ctex for XeLaTeX', () => {
    const out = toLatex(sampleZh());
    expect(out).toContain('{ctexart}');
    expect(out).toContain('\\section{教育背景}');
  });
  it('exports 报考信息 with a computed total', () => {
    const out = toLatex(sampleFushi());
    expect(out).toContain('\\textbf{初试成绩}');
    expect(out).toContain('\\textbf{报考院校：}');
    const en = sampleEn();
    en.sections.push(section('exam', 'Exam', { entries: [{ title: 'MIT', subtitle: '', location: '', date: '', bullets: '' }], skills: [{ label: 'Math', value: '140' }, { label: 'CS', value: '130' }] }));
    expect(toLatex(en)).toMatch(/Math & CS & Total.*140 & 130 & \\textbf\{270\}/s);
  });
});
