// "Now" of the device (browser clock + offset, optional zone or clock override).
import { minutesOf, weekdayOf, WEEKDAYS, mod } from '../core/time.js';

/** cfg -> { minutes: float in [0,1440), day: Weekday } */
export function nowOf(cfg) {
  const opts = cfg.timezone ? { timeZone: cfg.timezone } : undefined;
  if (typeof cfg.clock === 'function') {
    try {
      const r = cfg.clock();
      if (r instanceof Date) return { minutes: minutesOf(r, opts), day: weekdayOf(r, opts) };
      if (typeof r === 'number') return { minutes: mod(r, 1440), day: weekdayOf(new Date(), opts) };
    } catch (e) { /* fall back to the system clock */ }
  }
  const d = new Date(Date.now() + (cfg.clockOffset || 0) * 60000);
  return { minutes: minutesOf(d, opts), day: weekdayOf(d, opts) };
}

/** Offset in minutes so that device time = browser time + offset. Accepts 'HH:MM[:SS]', Date, minutes, {day,time}. */
export function offsetFor(deviceTime, cfg) {
  const opts = cfg.timezone ? { timeZone: cfg.timezone } : undefined;
  const now = new Date();
  const browserMin = minutesOf(now, opts);
  let target, dayDelta = 0;
  if (deviceTime && typeof deviceTime === 'object' && !(deviceTime instanceof Date)) {
    target = minutesOf(deviceTime.time);
    dayDelta = WEEKDAYS.indexOf(deviceTime.day) - WEEKDAYS.indexOf(weekdayOf(now, opts));
    let total = dayDelta * 1440 + target - browserMin;
    total = mod(total + 5040, 10080) - 5040;
    return total;
  }
  target = deviceTime instanceof Date ? minutesOf(deviceTime) : minutesOf(deviceTime);
  return mod(target - browserMin + 720, 1440) - 720;
}

/** ms until the next minute boundary (+ a small margin). */
export const msToNextMinute = () => 60000 - (Date.now() % 60000) + 40;
