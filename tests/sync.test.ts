import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSync, type FileSource, type Resolution, type SyncHooks } from '../src/sync';

/** An in-memory file whose content and mtime the test controls, writable like a FileSystemFileHandle. */
function fakeFile(text: string) {
  const f = { text, lastModified: 1, gone: false, writes: 0 };
  const source: FileSource = {
    name: 'resume.json',
    getFile: async () => {
      if (f.gone) throw new DOMException('gone', 'NotFoundError');
      const t = f.text;
      return { lastModified: f.lastModified, size: t.length, text: async () => t };
    },
    createWritable: async () => {
      let buf = '';
      return {
        write: async (d: string) => void (buf += d),
        close: async () => {
          f.writes++;
          f.text = buf;
          f.lastModified++;
        },
      };
    },
  };
  /** Someone else (the MCP server) writes the file. */
  const external = (t: string) => {
    f.text = t;
    f.lastModified++;
  };
  return { f, source, external };
}

/** A page whose content is a string; `loaded` records what the sync showed it. */
function fakePage(initial = '', choice: Resolution = 'file') {
  const page = { text: initial, loaded: [] as string[], conflicts: 0, failed: [] as unknown[] };
  const hooks: SyncHooks = {
    load: (t) => {
      if (t.startsWith('{bad')) throw new SyntaxError('bad json');
      page.text = t;
      page.loaded.push(t);
    },
    dump: () => page.text,
    conflict: async () => {
      page.conflicts++;
      return choice;
    },
    fail: (e) => page.failed.push(e),
  };
  return { page, hooks };
}

const opts = { poll: 1000, debounce: 500 };

describe('FileSync', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('loads the file at once, then whenever it changes', async () => {
    const { source, external } = fakeFile('a');
    const { page, hooks } = fakePage();
    const sync = new FileSync(source, hooks, true, opts);
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(page.loaded).toEqual(['a']);

    await vi.advanceTimersByTimeAsync(3000);
    expect(page.loaded).toEqual(['a']);

    external('b');
    await vi.advanceTimersByTimeAsync(1000);
    expect(page.loaded).toEqual(['a', 'b']);
    sync.stop();
  });

  it('writes page edits back once, after typing pauses, and does not reload its own write', async () => {
    const { f, source } = fakeFile('a');
    const { page, hooks } = fakePage();
    const sync = new FileSync(source, hooks, true, opts);
    sync.start();
    await vi.advanceTimersByTimeAsync(0);

    for (const t of ['ab', 'abc', 'abcd']) {
      page.text = t;
      sync.edited();
      await vi.advanceTimersByTimeAsync(200);
    }
    expect(f.writes).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(f.writes).toBe(1);
    expect(f.text).toBe('abcd');
    expect(sync.pending).toBe(false);

    await vi.advanceTimersByTimeAsync(3000);
    expect(page.loaded).toEqual(['a']);
    expect(page.conflicts).toBe(0);
    sync.stop();
  });

  it('never writes when read-only', async () => {
    const { f, source } = fakeFile('a');
    const { page, hooks } = fakePage();
    const sync = new FileSync(source, hooks, false, opts);
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    page.text = 'mine';
    sync.edited();
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.writes).toBe(0);
    expect(f.text).toBe('a');
    sync.stop();
  });

  it('asks when the file changes while page edits are unsaved; "file" discards the page edits', async () => {
    const { f, source, external } = fakeFile('a');
    const { page, hooks } = fakePage('', 'file');
    const sync = new FileSync(source, hooks, true, { poll: 100, debounce: 5000 });
    sync.start();
    await vi.advanceTimersByTimeAsync(0);

    page.text = 'mine';
    sync.edited();
    external('theirs');
    await vi.advanceTimersByTimeAsync(100);
    expect(page.conflicts).toBe(1);
    expect(page.text).toBe('theirs');

    await vi.advanceTimersByTimeAsync(10000);
    expect(f.writes).toBe(0);
    expect(f.text).toBe('theirs');
    sync.stop();
  });

  it('asks when the file changed just before saving; "page" overwrites it', async () => {
    const { f, source, external } = fakeFile('a');
    const { page, hooks } = fakePage('', 'page');
    const sync = new FileSync(source, hooks, true, { poll: 60000, debounce: 500 });
    sync.start();
    await vi.advanceTimersByTimeAsync(0);

    page.text = 'mine';
    sync.edited();
    external('theirs');
    await vi.advanceTimersByTimeAsync(500);
    expect(page.conflicts).toBe(1);
    expect(f.text).toBe('mine');
    expect(page.loaded).toEqual(['a']);
    sync.stop();
  });

  it('does not ask when the file changed but nothing is pending on the page', async () => {
    const { source, external } = fakeFile('a');
    const { page, hooks } = fakePage();
    const sync = new FileSync(source, hooks, true, opts);
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    page.text = 'mine';
    sync.edited();
    await vi.advanceTimersByTimeAsync(500);
    external('theirs');
    await vi.advanceTimersByTimeAsync(1000);
    expect(page.conflicts).toBe(0);
    expect(page.text).toBe('theirs');
    sync.stop();
  });

  it('keeps an edit made while a write is in flight', async () => {
    const { f, source } = fakeFile('a');
    const { page, hooks } = fakePage();
    const write = source.createWritable!;
    source.createWritable = async () => {
      // The user types again while the first save is being written.
      page.text = 'second';
      sync.edited();
      return write();
    };
    const sync = new FileSync(source, hooks, true, opts);
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    page.text = 'first';
    sync.edited();
    await vi.advanceTimersByTimeAsync(500);
    expect(f.text).toBe('first');
    expect(sync.pending).toBe(true);
    source.createWritable = write;
    await vi.advanceTimersByTimeAsync(500);
    expect(f.text).toBe('second');
    expect(sync.pending).toBe(false);
    sync.stop();
  });

  it('ignores a broken file and picks up the next good one', async () => {
    const { source, external } = fakeFile('a');
    const { page, hooks } = fakePage();
    const sync = new FileSync(source, hooks, true, opts);
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    external('{bad');
    await vi.advanceTimersByTimeAsync(1000);
    expect(page.text).toBe('a');
    external('c');
    await vi.advanceTimersByTimeAsync(1000);
    expect(page.text).toBe('c');
    expect(page.failed).toEqual([]);
    sync.stop();
  });

  it('flush writes pending edits right away', async () => {
    const { f, source } = fakeFile('a');
    const { page, hooks } = fakePage();
    const sync = new FileSync(source, hooks, true, { poll: 1000, debounce: 60000 });
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    page.text = 'mine';
    sync.edited();
    await sync.flush();
    expect(f.text).toBe('mine');
    sync.stop();
  });

  it('reports and stops when the file can no longer be read', async () => {
    const { f, source } = fakeFile('a');
    const { page, hooks } = fakePage();
    const getFile = vi.spyOn(source, 'getFile');
    new FileSync(source, hooks, true, opts).start();
    await vi.advanceTimersByTimeAsync(0);
    f.gone = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(page.failed).toHaveLength(1);
    const calls = getFile.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(getFile.mock.calls.length).toBe(calls);
  });
});
