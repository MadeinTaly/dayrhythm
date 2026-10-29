import type * as React from 'react';
import type {
  ChangeDetail, Config, DayRhythmElement, Day, Slot, Value, Weekday, Model, Preset, Renderers as BaseRenderers, SlotCtx, InvalidReason, DayStorage,
} from './index.js';

export type { Slot, Day, Weekday, Model, Preset, Config, ChangeDetail, Value };
export type { WeekValue, ResolvedWeek, Field, Issue, ActiveInfo, WeekActiveInfo } from './index.js';

/** The element itself with all its methods; available after `onReady`. */
export type DayRhythmHandle = DayRhythmElement;

type ReactRendered = React.ReactNode | Node | { html: string } | null | undefined;
export type ReactRenderers = { [K in keyof BaseRenderers]?: (ctx: Parameters<NonNullable<BaseRenderers[K]>>[0]) => ReactRendered };

export interface DayRhythmProps {
  /** One JSON object. Memoise or hoist it; it is compared by deep equality. */
  config?: Config;
  /** Controlled value. */
  value?: Value;
  /** Uncontrolled initial value. */
  defaultValue?: Value;
  /** Committed edits. Return nothing; keep the state in your component. */
  onChange?(value: Value, detail: ChangeDetail): void;
  /** Continuous edits (dragging, sliders, typing). */
  onInput?(value: Value, detail: ChangeDetail): void;
  onDayView?(detail: { day: Weekday; previous: Weekday }): void;
  onDaySelect?(detail: { kind: 'preset' | 'day'; id: string; slots: Slot[]; day?: Weekday }, event: CustomEvent): void;
  onDaySave?(detail: { name: string; slots: Slot[]; waitUntil(p: Promise<unknown>): void }): void;
  onDayDelete?(detail: { day: Day; waitUntil(p: Promise<unknown>): void }): void;
  onSlotOpen?(detail: { id: string }): void;
  onSlotClose?(detail: { id: string }): void;
  onSlotInvalid?(detail: { reason: InvalidReason; id?: string; limit?: number }): void;
  onError?(detail: { source: 'preset' | 'storage' | 'load' | 'config' | 'render'; error: unknown }): void;
  /** Called once the element is registered and configured on the client. */
  onReady?(detail: {}): void;

  // common options as direct props (override `config`)
  theme?: 'organic' | 'neutral' | 'flat' | 'none' | (string & {}) | import('./themes.js').Theme;
  colorScheme?: 'auto' | 'light' | 'dark';
  locale?: string;
  week?: 'auto' | 'top' | 'bottom' | 'off';
  readOnly?: boolean;
  disabled?: boolean;
  orientation?: 'auto' | 'horizontal' | 'vertical';
  timeFormat?: '24h' | '12h';
  render?: 'shadow' | 'light';
  classes?: Config['classes'];
  messages?: Config['messages'];
  models?: Model[];
  presets?: Preset[];
  days?: Day[];
  storage?: Config['storage'];
  renderers?: ReactRenderers;
  modelFilter?: Config['modelFilter'];
  clock?: Config['clock'];
  minGap?: number; snap?: number; minSlots?: number | null; maxSlots?: number | null;
  origin?: 'first' | 'midnight';
  credits?: Config['credits'];
  name?: string;
  load?: Config['load'];

  className?: string;
  style?: React.CSSProperties;
  id?: string;
  /** Slotted content, e.g. `<div slot="header">`. Shadow render mode only. */
  children?: React.ReactNode;
  /** Shown on the server and until the element is registered (skeleton). */
  fallback?: React.ReactNode;
}

export const DayRhythm: React.ForwardRefExoticComponent<DayRhythmProps & React.RefAttributes<DayRhythmHandle>>;
export default DayRhythm;

export function useActiveSlot(
  value: Value | null | undefined,
  opts?: { tickMs?: number; clock?: () => number | Date; timeZone?: string; days?: Day[] },
): Slot | null;
