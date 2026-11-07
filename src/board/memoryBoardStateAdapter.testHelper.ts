/**
 * In-memory BoardStateAdapter for tests only. Mirrors the Supabase adapter's conditional saves
 * and realtime notifications (delivered after a macrotask, like a network push).
 */
import type { BoardSaveResult, BoardStateAdapter, BoardStateRecord } from './boardStateAdapter';

export class MemoryBoardStateAdapter implements BoardStateAdapter {
  rows = new Map<string, BoardStateRecord>();
  saves = 0;
  private listeners = new Map<string, Set<(record: BoardStateRecord) => void>>();
  private clock = 0;
  /** Runs before each save is checked; lets a test sneak in another screen's write. */
  beforeSave: ((code: string) => void) | null = null;

  private nextTimestamp(): string {
    this.clock += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, 0, this.clock)).toISOString();
  }

  async load(code: string): Promise<BoardStateRecord | null> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const row = this.rows.get(code);
    return row ? structuredClone(row) : null;
  }

  async save(code: string, state: unknown, expectedUpdatedAt: string | null): Promise<BoardSaveResult> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const hook = this.beforeSave;
    this.beforeSave = null;
    hook?.(code);
    const current = this.rows.get(code);
    if ((current?.updatedAt ?? null) !== expectedUpdatedAt) return { ok: false, conflict: true };
    return { ok: true, updatedAt: this.write(code, state) };
  }

  /** Write a row directly, as another screen would, and notify subscribers. */
  write(code: string, state: unknown): string {
    this.saves += 1;
    const record = { state: structuredClone(state), updatedAt: this.nextTimestamp() };
    this.rows.set(code, record);
    setTimeout(() => this.listeners.get(code)?.forEach((cb) => cb(structuredClone(record))), 0);
    return record.updatedAt;
  }

  subscribe(code: string, onChange: (record: BoardStateRecord) => void): () => void {
    const set = this.listeners.get(code) ?? new Set();
    set.add(onChange);
    this.listeners.set(code, set);
    return () => set.delete(onChange);
  }
}
