import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchFile, type FileSource } from '../src/sync';

/** An in-memory file whose content and mtime the test controls. */
function fakeFile(text: string) {
  const f = { text, lastModified: 1, gone: false };
  const source: FileSource = {
    name: 'resume.json',
    getFile: async () => {
      if (f.gone) throw new DOMException('gone', 'NotFoundError');
      const t = f.text;
      return { lastModified: f.lastModified, size: t.length, text: async () => t };
    },
  };
  const write = (t: string) => {
    f.text = t;
    f.lastModified++;
  };
  return { f, source, write };
}

describe('watchFile', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reads the file at once, then only when it changes', async () => {
    const { source, write } = fakeFile('a');
    const seen: string[] = [];
    const stop = watchFile(source, (t) => seen.push(t), () => {}, 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual(['a']);

    await vi.advanceTimersByTimeAsync(3000);
    expect(seen).toEqual(['a']);

    write('b');
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual(['a', 'b']);
    stop();
  });

  it('stops polling once stopped', async () => {
    const { source, write } = fakeFile('a');
    const seen: string[] = [];
    const stop = watchFile(source, (t) => seen.push(t), () => {}, 1000);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    write('b');
    await vi.advanceTimersByTimeAsync(5000);
    expect(seen).toEqual(['a']);
  });

  it('reports and stops when the file can no longer be read', async () => {
    const { f, source } = fakeFile('a');
    const onError = vi.fn();
    const getFile = vi.spyOn(source, 'getFile');
    watchFile(source, () => {}, onError, 1000);
    await vi.advanceTimersByTimeAsync(0);
    f.gone = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(onError).toHaveBeenCalledOnce();
    const calls = getFile.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(getFile.mock.calls.length).toBe(calls);
  });
});
