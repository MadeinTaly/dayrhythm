// dayrhythm: registers <day-rhythm> and exposes the public helpers.
import { DayRhythmElement } from './element.js';
import * as core from './core/index.js';
import { defaults, mergeConfig } from './ui/config.js';
import { locales } from './i18n/index.js';
import { localStorageAdapter, httpStorageAdapter } from './storage.js';
import { VERSION } from './version.js';
import { themes } from './styles/themes.js';

/** Registry of packs; the `dayrhythm/packs` entry (or dist/dayrhythm-packs.js) fills it. */
export const packs = {
  register(pack) { if (pack && pack.id) this[pack.id] = pack; return pack; },
};

DayRhythmElement.define('day-rhythm');

export { DayRhythmElement, themes, core, defaults, mergeConfig, locales, localStorageAdapter, httpStorageAdapter, VERSION as version };
export default DayRhythmElement;
