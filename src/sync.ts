/** What the sync needs from a FileSystemFileHandle (kept minimal so tests can fake it). */
export interface FileSource {
  readonly name: string;
  getFile(): Promise<{ lastModified: number; size: number; text(): Promise<string> }>;
  createWritable?(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  requestPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      types?: { description?: string; accept: Record<string, string[]> }[];
      multiple?: boolean;
    }) => Promise<FileSource[]>;
  }
}

/** Chrome / Edge only; Firefox and Safari have no File System Access API. */
export const canSync = () => typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';

/** Asks the user for a JSON file to follow. Resolves to null if they cancel the picker. */
export async function pickFile(): Promise<FileSource | null> {
  try {
    const [handle] = await window.showOpenFilePicker!({ types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
    return handle ?? null;
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return null;
    throw e;
  }
}

/** Asks to also write the file. Must run right after a click; false means sync stays read-only. */
export async function requestWrite(source: FileSource): Promise<boolean> {
  if (!source.createWritable || !source.requestPermission) return false;
  try {
    return (await source.requestPermission({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

/** Which side wins when the page and the file were both changed since the last sync. */
export type Resolution = 'file' | 'page';

export interface SyncHooks {
  /** The file changed and the page has no unsaved edits: show this text. May throw on bad JSON. */
  load(text: string): void;
  /** The page's current content, as it should be written to the file. */
  dump(): string;
  /** Both sides changed since the last sync: ask which one to keep. */
  conflict(): Promise<Resolution>;
  /** The file can no longer be read or written; syncing has stopped. */
  fail(e: unknown): void;
}

const stampOf = (f: { lastModified: number; size: number }) => `${f.lastModified}:${f.size}`;

/**
 * Keeps the page and a local file in step. Polls the file every `poll` ms and loads it when it
 * changed; when `writable`, page edits (reported with `edited()`) are written back `debounce` ms
 * after the last one. If both changed since the last sync, `hooks.conflict` decides which wins,
 * so neither side silently overwrites the other.
 */
export class FileSync {
  /** mtime:size of the file as of the last read or write. */
  private stamp = '';
  /** File text as of the last sync, to recognize our own writes and no-op changes. */
  private base: string | null = null;
  /** Page edits not yet written; `edits` counts them so an edit made during a write is not lost. */
  private dirty = false;
  private edits = 0;
  private stopped = false;
  /** Reads, writes and conflict prompts run one at a time, in order. */
  private queue: Promise<void> = Promise.resolve();
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly source: FileSource,
    private readonly hooks: SyncHooks,
    readonly writable: boolean,
    private readonly opts = { poll: 1000, debounce: 800 },
  ) {}

  /** Loads the file now, then keeps polling it. */
  start(): void {
    this.poll();
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.pollTimer);
    clearTimeout(this.saveTimer);
  }

  /** Whether page edits are waiting to be written. */
  get pending(): boolean {
    return this.dirty;
  }

  /** The page was edited: write it back once edits pause. No-op when read-only. */
  edited(): void {
    if (!this.writable || this.stopped) return;
    this.dirty = true;
    this.edits++;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.run(() => this.save()), this.opts.debounce);
  }

  /** Writes pending edits right away (e.g. before the page is closed). */
  flush(): Promise<void> {
    clearTimeout(this.saveTimer);
    return this.run(() => this.save());
  }

  private poll() {
    void this.run(() => this.check()).then(() => {
      if (!this.stopped) this.pollTimer = setTimeout(() => this.poll(), this.opts.poll);
    });
  }

  private run(task: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(async () => {
      if (this.stopped) return;
      try {
        await task();
      } catch (e) {
        if (this.stopped) return;
        this.stop();
        this.hooks.fail(e);
      }
    });
    return this.queue;
  }

  /** Re-reads the file if it changed and returns its text, or null if it did not change. */
  private async readIfChanged(): Promise<string | null> {
    const file = await this.source.getFile();
    const stamp = stampOf(file);
    if (stamp === this.stamp) return null;
    const text = await file.text();
    this.stamp = stamp;
    return text === this.base ? null : text;
  }

  private async check() {
    const text = await this.readIfChanged();
    if (text === null) return;
    if (this.dirty) await this.resolve(text);
    else this.accept(text);
  }

  private async save() {
    if (!this.dirty) return;
    const text = await this.readIfChanged();
    if (text !== null) await this.resolve(text);
    else await this.write();
  }

  private accept(text: string) {
    this.base = text;
    try {
      this.hooks.load(text);
    } catch {
      // A half-written or hand-broken file: keep showing the last good version until it changes again.
    }
  }

  private async resolve(remote: string) {
    clearTimeout(this.saveTimer);
    const choice = await this.hooks.conflict();
    if (this.stopped) return;
    if (choice === 'file') {
      this.dirty = false;
      this.accept(remote);
    } else {
      await this.write();
    }
  }

  private async write() {
    const n = this.edits;
    const text = this.hooks.dump();
    const w = await this.source.createWritable!();
    await w.write(text);
    await w.close();
    this.base = text;
    const after = await this.source.getFile();
    // If someone else wrote right after us, leave the stamp stale so the next check picks their change up.
    this.stamp = (await after.text()) === text ? stampOf(after) : '';
    if (this.edits === n) this.dirty = false;
  }
}
