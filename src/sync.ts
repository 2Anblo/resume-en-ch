/** What the watcher needs from a FileSystemFileHandle (kept minimal so tests can fake it). */
export interface FileSource {
  readonly name: string;
  getFile(): Promise<{ lastModified: number; size: number; text(): Promise<string> }>;
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

/**
 * Re-reads `source` every `ms` and calls `onChange` with its text whenever it was modified
 * (and once right away). Stops and calls `onError` if the file can no longer be read
 * (deleted, moved, permission revoked). Returns a function that stops watching.
 */
export function watchFile(
  source: FileSource,
  onChange: (text: string) => void,
  onError: (e: unknown) => void,
  ms = 1000,
): () => void {
  let last = '';
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    try {
      const file = await source.getFile();
      const stamp = `${file.lastModified}:${file.size}`;
      if (stamp !== last) {
        const text = await file.text();
        if (stopped) return;
        last = stamp;
        onChange(text);
      }
    } catch (e) {
      if (stopped) return;
      stopped = true;
      onError(e);
      return;
    }
    if (!stopped) timer = setTimeout(tick, ms);
  };
  void tick();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
