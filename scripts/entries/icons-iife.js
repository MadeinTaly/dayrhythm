// IIFE entry: registers every icon on DayRhythm.icons (load after dayrhythm.min.js).
import { icons } from '../../icons/index.js';

const g = typeof globalThis !== 'undefined' ? globalThis : window;
if (g.DayRhythm && g.DayRhythm.icons) g.DayRhythm.icons.register(icons);
