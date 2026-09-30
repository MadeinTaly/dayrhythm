// dayrhythm/core - DOM-free helpers.

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type InvalidReason = 'min-gap' | 'max-slots' | 'min-slots' | 'duplicate-time' | 'locked';

export interface Slot {
  id?: string;
  /** "HH:MM", 24 h, zero padded. */
  time: string;
  /** Model id. Unknown ids are kept and shown as "unknown". */
  model: string;
  label?: string;
  values?: Record<string, unknown>;
  locked?: boolean | Array<'time' | 'remove' | 'label' | 'model'>;
  [extra: string]: unknown;
}
export interface Day { id: string; name: string; slots: Slot[] }
export type DayRef = { ref: string };
export type WeekValue = { week: Partial<Record<Weekday, Slot[] | DayRef>> };
export type ResolvedWeek = Record<Weekday, Slot[]>;
export type Value = Slot[] | WeekValue;

export interface Issue {
  id?: string;
  day?: Weekday;
  code: InvalidReason | 'unknown-model' | 'time-format' | 'missing-ref';
  message: string;
}
export interface ClockOpts {
  /** Offset of the device zone from UTC in minutes (e.g. 120). */
  utcOffsetMinutes?: number;
  /** IANA zone (e.g. "Europe/Rome"). Wins over utcOffsetMinutes. */
  timeZone?: string;
}
export interface ActiveInfo { slot: Slot; index: number; start: number; end: number; elapsed: number; remaining: number }
export interface WeekActiveInfo extends ActiveInfo { day: Weekday; dayOffset: number }
export interface SlotRange { slot: Slot; index: number; start: number; end: number; duration: number }
export interface WeekRange { slot: Slot; day: Weekday; index: number; start: number; end: number; duration: number }

export const WEEKDAYS: readonly Weekday[];

// time
export function parseTime(s: string): number;
export function tryParseTime(s: unknown): number | null;
export function formatTime(min: number, opts?: { format?: '24h' | '12h' }): string;
export function minutesOf(at: string | number | Date, opts?: ClockOpts): number;
export function weekdayOf(at: Date, opts?: ClockOpts): Weekday;

// daily
export function genId(): string;
export function sortSlots<T extends { time: string }>(slots: T[]): T[];
export function normalizeDay(slots: Slot[], opts?: { ids?: boolean }): Slot[];
export function slotRanges(slots: Slot[], opts?: { cyclic?: boolean }): SlotRange[];
export function resolveValues(slot: Slot, models?: Array<{ id: string; defaults?: Record<string, unknown>; fields?: Array<{ key: string; default?: unknown }> }>): Record<string, unknown> | undefined;
export function isLocked(slot: Slot, what: 'time' | 'remove' | 'label' | 'model'): boolean;
export function addSlotAt(slots: Slot[], opts?: { time?: string | number; minGap?: number; snap?: number; maxSlots?: number | null; cyclic?: boolean; template?: Partial<Slot> | null; model?: string; label?: string; id?: string }): { slots: Slot[]; added: Slot } | { error: InvalidReason };
export function removeSlotById(slots: Slot[], id: string, opts?: { minSlots?: number }): Slot[] | { error: InvalidReason };
export function boundaryBounds(slots: Slot[], id: string, opts?: { minGap?: number; cyclic?: boolean }): { lo: number; hi: number; index: number } | null;
export function moveBoundary(slots: Slot[], id: string, toMinutes: number, opts?: { snap?: number; minGap?: number; cyclic?: boolean }): { slots: Slot[]; time: string | null; minutes: number | null; clamped: boolean };
export function retimeSlot(slots: Slot[], id: string, time: string, opts?: { minGap?: number; cyclic?: boolean }): { slots: Slot[]; time: string } | { error: 'time-format' | 'duplicate-time' | 'min-gap' };
export function validateDay(slots: Slot[], opts?: { minGap?: number; models?: Array<{ id: string }>; cyclic?: boolean }): Issue[];

// weekly
export function isWeek(v: unknown): v is WeekValue;
export function isRef(v: unknown): v is DayRef;
export function resolveWeek(week: WeekValue | Partial<Record<Weekday, Slot[] | DayRef>>, days?: Day[]): ResolvedWeek;
export function withDay(week: WeekValue, day: Weekday, slotsOrRef: Slot[] | DayRef): WeekValue;
export function copyDay(week: WeekValue, from: Weekday, to: Weekday[] | 'weekdays' | 'weekend' | 'all', opts?: { newIds?: boolean; days?: Day[] }): WeekValue;
export function expandTargets(to: Weekday[] | 'weekdays' | 'weekend' | 'all', from: Weekday): Weekday[];
export function weekRanges(week: WeekValue | ResolvedWeek, days?: Day[]): WeekRange[];
export function carrySlotFor(week: WeekValue, day: Weekday, days?: Day[]): { slot: Slot; day: Weekday } | null;
export function validateWeek(week: WeekValue, opts?: { days?: Day[]; minGap?: number; models?: Array<{ id: string }> }): Issue[];
export function orderedWeekdays(firstDay: Weekday): Weekday[];
export function firstDayOfWeek(locale: string): Weekday;

// overloaded on the first argument (array = daily, { week } = weekly)
export function activeSlotAt(slots: Slot[], at: string | number | Date, opts?: ClockOpts): ActiveInfo | null;
export function activeSlotAt(week: WeekValue, at: Date | { day: Weekday; time: string | number }, opts?: ClockOpts & { days?: Day[] }): WeekActiveInfo | null;
export function nextChange(slots: Slot[], at: string | number | Date, opts?: ClockOpts): { slot: Slot; index: number; inMinutes: number } | null;
export function nextChange(week: WeekValue, at: Date | { day: Weekday; time: string | number }, opts?: ClockOpts & { days?: Day[] }): { slot: Slot; day: Weekday; inMinutes: number } | null;
