// IIFE entry: registers every theme on DayRhythm.themes (load after dayrhythm.min.js).
import { themes } from '../../themes/index.js';

const g = typeof globalThis !== 'undefined' ? globalThis : window;
if (g.DayRhythm && g.DayRhythm.themes) for (const t of Object.values(themes)) g.DayRhythm.themes.register(t);
