/** Lucide icon name or a short alias from earlier versions. */
export type IconName = string;

export interface IconCatalogEntry {
  /** Lucide name, kebab-case: the value to use as a model `icon`. */
  name: string;
  category: 'home' | 'lighting' | 'climate' | 'energy' | 'water' | 'garden' | 'weather' | 'time-of-day' | 'sleep' | 'pets' | 'health' | 'kitchen' | 'media' | 'security' | 'office' | 'transport' | 'power';
  /** English search words. */
  keywords: string[];
  /** Italian search words. */
  it: string[];
  /** Older short names that resolve to this icon. */
  aliases?: string[];
}

/** Inline SVG strings by name (viewBox 24, stroke="currentColor"): colour them with CSS `color`. Register them with `DayRhythm.icons.register(icons)` and use the name as a model `icon`. */
export const icons: Record<IconName, string>;
export default icons;
