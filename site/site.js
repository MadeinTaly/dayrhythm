// Shared bits for the demo site: colour scheme toggle for the page (independent of the component's own colorScheme option).
const root = document.documentElement;
const KEY = 'dayrhythm-site-scheme';
const stored = (() => { try { return localStorage.getItem(KEY); } catch (e) { return null; } })();
if (stored === 'dark' || stored === 'light') root.dataset.scheme = stored;

export function currentScheme() {
  return root.dataset.scheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

const btn = document.getElementById('scheme-toggle');
if (btn) {
  const label = () => { btn.textContent = currentScheme() === 'dark' ? 'Light mode' : 'Dark mode'; };
  label();
  btn.addEventListener('click', () => {
    const next = currentScheme() === 'dark' ? 'light' : 'dark';
    root.dataset.scheme = next;
    try { localStorage.setItem(KEY, next); } catch (e) { /* private mode */ }
    label();
    document.dispatchEvent(new CustomEvent('site-scheme', { detail: next }));
  });
}
