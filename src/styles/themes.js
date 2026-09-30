// Built-in themes: CSS-variable sets + skin. Public --dr-* variables win over every default.
const V = (o) => Object.entries(o).map(([k, v]) => `--x-${k}:var(--dr-${k},${v})`).join(';');
// aliases: the public name differs from the internal key for a few
const P = {
  organic: {
    light: { bg: '#edf6f2', surface: '#fbfefb', 'surface-soft': '#e2f0e9', ink: '#163e38', muted: '#57716b', accent: '#146b59', 'accent-soft': '#d3ebe0', 'accent-ink': '#ffffff', focus: '#146b59', danger: '#a3372a', border: '#cbded4', shadow: '0 12px 40px rgb(30 74 55 / 5%)', overlay: '#0a292566' },
    dark: { bg: '#102824', surface: '#193730', 'surface-soft': '#23453c', ink: '#edf7ef', muted: '#b0c8bb', accent: '#a6dfc5', 'accent-soft': '#2c5548', 'accent-ink': '#0e2a24', focus: '#a6dfc5', danger: '#ff9d8f', border: '#38574b', shadow: '0 12px 40px rgb(0 16 12 / 14%)', overlay: '#02100dbb' },
    shape: { 'radius-panel': '28px 28px 12px 28px', 'radius-dialog': '36px 36px 36px 12px', 'radius-card': '20px', 'radius-card-h': '26px 26px 14px 14px', 'radius-chip': '999px', 'radius-input': '1rem', 'radius-button': '999px', 'radius-spectrum': '100% 40% 70% 30% / 30% 60% 40% 60%', 'radius-tab': '999px', font: '"Segoe UI Variable","Segoe UI",Roboto,system-ui,sans-serif', 'tint-opacity': '.25' },
  },
  neutral: {
    light: { bg: '#f8fafc', surface: '#ffffff', 'surface-soft': '#f1f5f9', ink: '#0f172a', muted: '#475569', accent: '#2563eb', 'accent-soft': '#dbeafe', 'accent-ink': '#ffffff', focus: '#2563eb', danger: '#b91c1c', border: '#d5dbe4', shadow: 'none', overlay: '#0f172a66' },
    dark: { bg: '#0b1220', surface: '#111a2c', 'surface-soft': '#1e293b', ink: '#f1f5f9', muted: '#cbd5e1', accent: '#60a5fa', 'accent-soft': '#1e3a5f', 'accent-ink': '#0b1220', focus: '#60a5fa', danger: '#fca5a5', border: '#334155', shadow: 'none', overlay: '#020617b3' },
    shape: { 'radius-panel': '8px', 'radius-dialog': '10px', 'radius-card': '8px', 'radius-card-h': '8px', 'radius-chip': '8px', 'radius-input': '6px', 'radius-button': '6px', 'radius-spectrum': '6px', 'radius-tab': '6px', font: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', 'tint-opacity': '.22' },
  },
  flat: {
    light: { bg: '#ffffff', surface: '#ffffff', 'surface-soft': '#ececec', ink: '#000000', muted: '#333333', accent: '#0b57d0', 'accent-soft': '#d6e4ff', 'accent-ink': '#ffffff', focus: '#000000', danger: '#a80000', border: '#000000', shadow: 'none', overlay: '#000000aa' },
    dark: { bg: '#000000', surface: '#121212', 'surface-soft': '#2a2a2a', ink: '#ffffff', muted: '#dddddd', accent: '#8ab4f8', 'accent-soft': '#1b3358', 'accent-ink': '#000000', focus: '#ffffff', danger: '#ff8a80', border: '#ffffff', shadow: 'none', overlay: '#000000dd' },
    shape: { 'radius-panel': '0', 'radius-dialog': '0', 'radius-card': '0', 'radius-card-h': '0', 'radius-chip': '0', 'radius-input': '0', 'radius-button': '0', 'radius-spectrum': '0', 'radius-tab': '0', font: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', 'tint-opacity': '.85' },
  },
};

function vars(t, scheme) {
  return V({ ...P[t][scheme], ...P[t].shape });
}

export const themeCSS = ['organic', 'neutral', 'flat'].map((t) => `
.dr-root[data-theme=${t}]{${vars(t, 'light')};color-scheme:light}
.dr-root[data-theme=${t}][data-scheme=dark]{${V(P[t].dark)};color-scheme:dark}
@media (prefers-color-scheme:dark){.dr-root[data-theme=${t}][data-scheme=auto]{${V(P[t].dark)};color-scheme:dark}}
.dr-root[data-theme=${t}][data-scheme=auto]{color-scheme:light dark}`).join('') + `
.dr-root[data-theme=flat] :is(.dr-slot,.dr-button,.dr-preset,.dr-model-option,.dr-week-tab,.dr-input){border-width:2px}
.dr-root[data-theme=flat]{--x-shadow:none}
.dr-root[data-theme=flat] :focus-visible{outline:3px solid var(--x-focus);outline-offset:2px}
`;
