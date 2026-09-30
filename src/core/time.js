// Time helpers. Pure, DOM-free.

export const WEEKDAYS = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 'HH:MM' -> 0..1439. Throws RangeError. */
export function parseTime(s) {
  const m = TIME_RE.exec(typeof s === 'string' ? s : '');
  if (!m) throw new RangeError(`Invalid time "${s}" (expected HH:MM)`);
  return +m[1] * 60 + +m[2];
}

export function tryParseTime(s) {
  const m = TIME_RE.exec(typeof s === 'string' ? s : '');
  return m ? +m[1] * 60 + +m[2] : null;
}

const mod = (a, n) => ((a % n) + n) % n;
export { mod };

/** minutes -> 'HH:MM' (24h) or 'h:MM AM' (12h). Wraps modulo 1440. */
export function formatTime(min, opts) {
  const m = mod(Math.round(min), 1440);
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
  if (opts && opts.format === '12h') {
    const h12 = h % 12 || 12;
    return `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
  }
  return `${String(h).padStart(2, '0')}:${mm}`;
}

const fmtCache = new Map();
function zoned(date, timeZone) {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(timeZone, f);
  }
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return { h: +o.hour % 24, m: +o.minute, s: +o.second, wd: o.weekday.slice(0, 3).toLowerCase() };
}

/** Broken-down clock of an instant: { h, m, s, wd } in the requested zone. */
function clockParts(date, opts) {
  if (opts && opts.timeZone) return zoned(date, opts.timeZone);
  if (opts && typeof opts.utcOffsetMinutes === 'number') {
    const d = new Date(date.getTime() + opts.utcOffsetMinutes * 60000);
    return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), wd: WEEKDAYS[mod(d.getUTCDay() - 1, 7)] };
  }
  return { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds(), wd: WEEKDAYS[mod(date.getDay() - 1, 7)] };
}

/** at: 'HH:MM[:SS]' | minutes | Date -> float minutes in [0,1440). */
export function minutesOf(at, opts) {
  if (typeof at === 'number') return mod(at, 1440);
  if (at instanceof Date) {
    const c = clockParts(at, opts);
    return c.h * 60 + c.m + c.s / 60;
  }
  if (typeof at === 'string') {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(at);
    if (!m || +m[1] > 23 || +m[2] > 59 || (m[3] && +m[3] > 59)) throw new RangeError(`Invalid time "${at}"`);
    return +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 60 : 0);
  }
  throw new TypeError('minutesOf: expected string, number or Date');
}

export function weekdayOf(at, opts) {
  return clockParts(at, opts).wd;
}
