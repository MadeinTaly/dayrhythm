import type { Day, Slot } from './core.js';

export interface DayStorage {
  list(): Promise<Day[]> | Day[];
  save(day: { name: string; slots: Slot[] }): Promise<Day> | Day;
  remove(id: string): Promise<void> | void;
}
export function localStorageAdapter(key: string): DayStorage;
export function httpStorageAdapter(url: string, init?: { headers?: Record<string, string>; credentials?: RequestCredentials }): DayStorage;
/** Config `storage` (JSON form or adapter) -> adapter, or null. */
export function adapterFrom(storage: unknown): DayStorage | null;
