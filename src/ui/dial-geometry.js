// Pure geometry of the 24-hour dial: minute 0 on top, clockwise. DOM-free.
import { mod } from '../core/time.js';

const TAU = Math.PI * 2;
const xy = (p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;

/** Angle in radians, clockwise from 12 o'clock. */
export const angleOf = (min) => (mod(min, 1440) / 1440) * TAU;

export function pointAt(min, r, cx = 100, cy = 100) {
  const a = angleOf(min);
  return { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r };
}

/** Minute (0 <= m < 1440, unsnapped) under point (x, y). */
export const minutesAt = (x, y, cx = 100, cy = 100) => mod((Math.atan2(x - cx, cy - y) * 1440) / TAU, 1440);

/** Ring segment from `start` to `end` minutes (end may pass midnight); a span of 1440 is the full ring. */
export function arcPath(start, end, ri, ro, cx = 100, cy = 100) {
  const span = end - start;
  if (span >= 1440) {
    // two half rings: a single arc cannot start and end on the same point
    const [o0, o1, i0, i1] = [pointAt(start, ro, cx, cy), pointAt(start + 720, ro, cx, cy), pointAt(start, ri, cx, cy), pointAt(start + 720, ri, cx, cy)];
    return `M${xy(o0)}A${ro} ${ro} 0 0 1 ${xy(o1)}A${ro} ${ro} 0 0 1 ${xy(o0)}Z` +
      `M${xy(i0)}A${ri} ${ri} 0 0 0 ${xy(i1)}A${ri} ${ri} 0 0 0 ${xy(i0)}Z`;
  }
  const large = span > 720 ? 1 : 0;
  return `M${xy(pointAt(start, ro, cx, cy))}A${ro} ${ro} 0 ${large} 1 ${xy(pointAt(end, ro, cx, cy))}` +
    `L${xy(pointAt(end, ri, cx, cy))}A${ri} ${ri} 0 ${large} 0 ${xy(pointAt(start, ri, cx, cy))}Z`;
}

