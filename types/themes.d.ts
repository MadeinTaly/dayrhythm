/** A theme: CSS values per colour scheme, shape, and optional per-part declarations. Plain JSON. */
export interface Theme {
  id: string;
  title?: string;
  description?: string;
  /** 'dark' when the only palette is dark. */
  scheme?: 'light' | 'dark';
  /** bg, surface, surface-soft, ink, muted, accent, accent-soft, accent-ink, focus, danger, border, shadow, overlay, now. */
  light: Record<string, string>;
  dark?: Record<string, string>;
  /** radius-panel, radius-dialog, radius-card, radius-card-h, radius-chip, radius-input, radius-button, radius-spectrum, radius-tab, font, tint-opacity. */
  shape?: Record<string, string>;
  /** Selector inside the root (comma lists allowed) -> declarations. */
  skin?: Record<string, string>;
}
export type ThemeId = 'dose' | 'blueprint' | 'console' | 'terminal' | 'ultraviolet' | 'brutal' | 'garden' | 'sticker';
export const themes: Record<ThemeId, Theme>;
declare const all: Record<ThemeId, Theme>;
export default all;
