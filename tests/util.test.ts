import { describe, expect, it } from 'vitest';
import { contactHref, esc, inline, lines, safeUrl } from '../src/util';
import { normalize } from '../src/store';
import { sampleEn, sampleZh } from '../src/samples';
import { renderJake } from '../src/templates/jake';
import { renderZh } from '../src/templates/zh';
import { renderNg } from '../src/templates/ng';

describe('util', () => {
  it('escapes HTML', () => {
    expect(esc('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });
  it('supports **bold** and safe links only', () => {
    expect(inline('**Zelda** & co')).toBe('<strong>Zelda</strong> &amp; co');
    expect(inline('[site](example.com)')).toBe('<a href="https://example.com">site</a>');
    expect(inline('[x](javascript:alert(1))')).not.toContain('href');
  });
  it('normalizes URLs', () => {
    expect(safeUrl('a@b.co')).toBe('mailto:a@b.co');
    expect(safeUrl('github.com/x')).toBe('https://github.com/x');
    expect(safeUrl('javascript:alert(1)')).toBe('');
  });
  it('auto-links contacts that look like emails or URLs', () => {
    expect(contactHref({ text: 'me@x.com', link: '' })).toBe('mailto:me@x.com');
    expect(contactHref({ text: 'github.com/me', link: '' })).toBe('https://github.com/me');
    expect(contactHref({ text: '138-0000-0000', link: '' })).toBe('');
    expect(contactHref({ text: '上海', link: '' })).toBe('');
    expect(contactHref({ text: 'Portfolio', link: 'me.dev' })).toBe('https://me.dev');
  });
  it('splits bullet lines and strips list markers', () => {
    expect(lines('- one\n\n• two\n  three  ')).toEqual(['one', 'two', 'three']);
  });
});

describe('store.normalize', () => {
  it('round-trips the samples', () => {
    for (const s of [sampleEn(), sampleZh()]) expect(normalize(JSON.parse(JSON.stringify(s)), 'en')).toEqual(s);
  });
  it('repairs malformed input', () => {
    const r = normalize({ lang: 'zh', sections: [{ kind: 'bogus', entries: [{ title: 1, bullets: ['a', 'b'] }] }], photo: 'http://x' }, 'en');
    expect(r.lang).toBe('zh');
    expect(r.template).toBe('zh-simple');
    expect(normalize({ lang: 'en', template: 'zh-simple' }, 'en').template).toBe('jake');
    expect(normalize({ lang: 'zh', template: 'ng' }, 'en').template).toBe('ng');
    expect(r.pageSize).toBe('a4');
    expect(r.photo).toBe('');
    expect(r.sections[0].kind).toBe('entries');
    expect(r.sections[0].entries[0]).toMatchObject({ title: '1', bullets: 'a\nb' });
  });
});

describe('templates', () => {
  it('render the samples', () => {
    expect(renderJake(sampleEn())).toContain('Jake Ryan');
    expect(renderZh(sampleZh())).toContain('教育背景');
    expect(renderNg(sampleZh())).toContain('教育背景');
    expect(renderNg(sampleEn())).toContain('Jake Ryan');
  });
  it('escape user content', () => {
    const r = sampleEn();
    r.name = '<script>x</script>';
    expect(renderJake(r)).not.toContain('<script>');
  });
});
