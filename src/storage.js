// Saved-days adapters (used by the JSON `storage` forms and importable directly).
import { genId } from './core/slots.js';

export function localStorageAdapter(key) {
  const read = () => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  };
  return {
    list: read,
    save({ name, slots }) {
      const day = { id: genId(), name, slots };
      localStorage.setItem(key, JSON.stringify([...read(), day]));
      return day;
    },
    remove(id) { localStorage.setItem(key, JSON.stringify(read().filter((d) => d.id !== id))); },
  };
}

export function httpStorageAdapter(url, init = {}) {
  const base = { headers: init.headers, credentials: init.credentials };
  const call = async (u, o) => {
    const r = await fetch(u, { ...base, ...o, headers: { 'content-type': 'application/json', ...(base.headers || {}) } });
    if (!r.ok) throw new Error(r.statusText || `HTTP ${r.status}`);
    return r.status === 204 ? undefined : r.json();
  };
  return {
    list: () => call(url),
    save: (day) => call(url, { method: 'POST', body: JSON.stringify(day) }),
    remove: (id) => call(`${url.replace(/\/$/, '')}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}

/** Config `storage` (JSON form or adapter object) -> adapter | null. */
export function adapterFrom(s) {
  if (!s) return null;
  if (typeof s.list === 'function') return s;
  if (s.type === 'local' && s.key) return localStorageAdapter(s.key);
  if (s.type === 'http' && s.url) return httpStorageAdapter(s.url, s);
  return null;
}
