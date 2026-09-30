// IIFE entry: registers every pack on DayRhythm.packs (load after dayrhythm.min.js).
import { packs } from '../../packs/index.js';

const g = typeof globalThis !== 'undefined' ? globalThis : window;
if (g.DayRhythm && g.DayRhythm.packs) for (const p of Object.values(packs)) g.DayRhythm.packs.register(p);
