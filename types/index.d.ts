// dayrhythm - hand-written types (authoritative). See docs/API.md.
import type { Slot, Day, Weekday, DayRef, WeekValue, ResolvedWeek, Value, Issue, InvalidReason, ClockOpts } from './core.js';
import type { DayStorage } from './storage.js';
import * as core from './core.js';

export type { Slot, Day, Weekday, DayRef, WeekValue, ResolvedWeek, Value, Issue, InvalidReason, ClockOpts, DayStorage };
export type { ActiveInfo, WeekActiveInfo } from './core.js';

export interface Preset {
  id: string;
  label: string;
  icon?: string;
  group?: string;
  /** JS forms: an array, or a (possibly async) function. */
  slots?: Slot[] | (() => Slot[] | Promise<Slot[]>);
  /** JSON form: GET returns Slot[]. */
  slotsUrl?: string;
}

export type Field =
  | { key: string; type: 'range' | 'number'; label?: string; default?: number; min?: number; max?: number; step?: number; unit?: string; format?: string | ((v: number) => string); accent?: string }
  | { key: string; type: 'select'; label?: string; default?: string | number; options: Array<{ value: string | number; label: string }>; accent?: string }
  | { key: string; type: 'toggle'; label?: string; default?: boolean; accent?: string }
  | { key: string; type: 'color'; label?: string; default?: string; accent?: string }
  | { key: string; type: 'text'; label?: string; default?: string; accent?: string };

export interface Model {
  id: string;
  label?: string;
  icon?: string | { src: string };
  /** CSS <background> with {key} interpolation, or a function (JS only). */
  preview?: string | ((values: any, model: Model, slot: Slot) => string);
  previewScale?: { field: string; min: number; max: number; from: string; to: string };
  off?: boolean;
  defaults?: Record<string, unknown>;
  fields?: Field[];
  summary?: string | ((values: any, model: Model, slot: Slot) => string);
  group?: string;
  hint?: string;
  when?: { from: string; to: string };
  days?: Weekday[];
  classes?: string | string[];
  meta?: unknown;
}

export interface Http { url: string; method?: string; headers?: Record<string, string>; credentials?: RequestCredentials }

export type PartKey =
  | 'root' | 'header' | 'toolbar' | 'footer' | 'weekBar' | 'weekPrev' | 'weekNext' | 'weekCopy' | 'weekTab' | 'weekTabSelected' | 'weekTabToday' | 'weekRows' | 'weekRow' | 'weekRowDay' | 'weekRowSelected' | 'weekRowToday' | 'weekAxis'
  | 'weekTabLinked' | 'weekTabEmpty' | 'weekTabPreview' | 'presets' | 'presetsGroup' | 'presetsLabel' | 'preset' | 'presetBusy' | 'presetDelete'
  | 'presetSave' | 'spectrum' | 'spectrumSegment' | 'track' | 'slot' | 'slotActive' | 'slotSelected' | 'slotInvalid' | 'slotLocked' | 'slotTail'
  | 'slotCarry' | 'slotTint' | 'slotContent' | 'slotTime' | 'slotLabel' | 'slotIcon' | 'slotModel' | 'slotSummary' | 'handle' | 'handleSeam'
  | 'handleGrip' | 'handleTime' | 'nowLine' | 'nowBadge' | 'add' | 'dialog' | 'dialogHeader' | 'dialogTitle' | 'dialogBody' | 'dialogActions'
  | 'field' | 'fieldLabel' | 'fieldValue' | 'fieldInput' | 'modelGrid' | 'modelOption' | 'modelOptionSelected' | 'modelIcon' | 'modelLabel'
  | 'input' | 'button' | 'buttonPrimary' | 'buttonDanger' | 'credits' | 'creditsLink' | 'creditsDonate' | 'state' | 'error';

export type Rendered = string | Node | { html: string } | null | undefined;

export interface SlotCtx {
  slot: Slot; model: Model; values: Record<string, unknown> | undefined; index: number; count: number;
  start: string; end: string; duration: number; day?: Weekday;
  active: boolean; invalid: boolean; readonly: boolean;
  t(key: string, vars?: Record<string, unknown>): string; preview: string;
}
export interface Renderers {
  slotContent?(ctx: SlotCtx): Rendered;
  slotLabel?(ctx: SlotCtx): Rendered;
  modelIcon?(ctx: SlotCtx): Rendered;
  modelOption?(ctx: { model: Model; selected: boolean; slot: Slot; t: SlotCtx['t']; preview: string }): Rendered;
  field?(ctx: { field: Field; value: unknown; slot: Slot | null; set(value: unknown, commit?: boolean): unknown; t: SlotCtx['t'] }): Rendered;
  preset?(ctx: { preset: Preset; busy: boolean }): Rendered;
  weekTab?(ctx: { day: Weekday; label: string; slots: Slot[]; selected: boolean; today: boolean; linked?: Day }): Rendered;
}

export interface Config {
  $schema?: string;
  /** Initial value only; a later `el.value` wins. */
  value?: Value;
  name?: string;
  models?: Model[];
  presets?: Preset[];
  days?: Day[];
  load?: Http | null;
  storage?: { type: 'local'; key: string } | ({ type: 'http' } & Omit<Http, 'method'>) | DayStorage | null;
  minGap?: number; snap?: number; minSlots?: number | null; maxSlots?: number | null;
  layout?: 'strip' | 'dial'; origin?: 'first' | 'midnight'; seamDrag?: boolean; push?: boolean; orientation?: 'auto' | 'horizontal' | 'vertical'; breakpoint?: number;
  add?: boolean; remove?: boolean; rename?: boolean; timeEdit?: boolean; showPresets?: boolean; showDays?: boolean;
  spectrum?: boolean; nowLine?: boolean; clockOffset?: number; timezone?: string | null; timeFormat?: '24h' | '12h';
  editor?: 'auto' | 'quick' | 'full'; randomize?: boolean; readonly?: boolean; disabled?: boolean; labelMax?: number;
  week?: 'auto' | 'top' | 'bottom' | 'off'; day?: Weekday | null; firstDay?: 'auto' | Weekday;
  weekPreview?: boolean; weekCopy?: boolean; linkDays?: boolean; weekLayout?: 'tabs' | 'rows';
  theme?: 'organic' | 'neutral' | 'flat' | 'none'; colorScheme?: 'auto' | 'light' | 'dark'; locale?: string | null;
  /** Flat `{ key: string }` and/or per-locale `{ it: { key: string } }`. */
  messages?: Record<string, string | Record<string, string>>;
  classes?: Partial<Record<PartKey, string | string[]>>;
  render?: 'shadow' | 'light'; inheritStyles?: boolean; styles?: string | null;
  /** true / "minimal": small credit link. "support": also a donation link. false: nothing. */
  credits?: boolean | 'minimal' | 'support';
  // pack metadata (ignored by the element)
  id?: string; title?: string; description?: string;
  // JS-only overrides (ignored by exportConfig)
  renderers?: Renderers;
  modelFilter?: (slot: Slot, models: Model[]) => Model[];
  clock?: () => number | Date;
}

export interface ChangeDetail {
  /** As authored (weekly: refs stay refs). */
  value: Value;
  /** Daily: same as value. Weekly: every weekday expanded. */
  resolved: Slot[] | ResolvedWeek;
  previous: Value;
  source: 'drag' | 'keyboard' | 'model' | 'values' | 'label' | 'time' | 'add' | 'remove' | 'preset' | 'day' | 'copy' | 'randomize' | 'api';
  id?: string;
  day?: Weekday;
  detached?: boolean;
}

export interface DayRhythmEventMap {
  input: CustomEvent<ChangeDetail>;
  change: CustomEvent<ChangeDetail>;
  dayview: CustomEvent<{ day: Weekday; previous: Weekday }>;
  dayselect: CustomEvent<{ kind: 'preset' | 'day'; id: string; slots: Slot[]; day?: Weekday }>;
  daysave: CustomEvent<{ name: string; slots: Slot[]; waitUntil(p: Promise<unknown>): void }>;
  daydelete: CustomEvent<{ day: Day; waitUntil(p: Promise<unknown>): void }>;
  slotopen: CustomEvent<{ id: string }>;
  slotclose: CustomEvent<{ id: string }>;
  slotinvalid: CustomEvent<{ reason: InvalidReason; id?: string; limit?: number }>;
  error: CustomEvent<{ source: 'preset' | 'storage' | 'load' | 'config' | 'render'; error: unknown }>;
  ready: CustomEvent<{}>;
}

export class DayRhythmElement extends HTMLElement {
  static readonly version: string;
  static define(tag?: string): void;

  /** Setting replaces the value silently (no events). */
  value: Value;
  config: Config;
  models: Model[];
  presets: Preset[];
  days: Day[];
  storage: Config['storage'];
  renderers: Renderers;
  messages: NonNullable<Config['messages']>;
  classes: NonNullable<Config['classes']>;
  modelFilter: Config['modelFilter'];
  clock: Config['clock'];
  theme: NonNullable<Config['theme']>;
  colorScheme: NonNullable<Config['colorScheme']>;
  locale: string;
  week: NonNullable<Config['week']>;
  day: Weekday;
  readonly: boolean;
  disabled: boolean;
  orientation: NonNullable<Config['orientation']>;
  timeFormat: NonNullable<Config['timeFormat']>;
  minGap: number; snap: number; minSlots: number | null; maxSlots: number | null;
  origin: NonNullable<Config['origin']>; editor: NonNullable<Config['editor']>;
  layout: NonNullable<Config['layout']>;
  credits: NonNullable<Config['credits']>;
  render: NonNullable<Config['render']>;
  styles: string | null;
  readonly now: number;
  readonly nowDay: Weekday;
  readonly resolvedOrientation: 'horizontal' | 'vertical';
  readonly editing: string | null;
  readonly weekMode: boolean;

  addSlot(partial?: Partial<Slot>, opts?: { day?: Weekday; edit?: boolean }): Slot | null;
  removeSlot(id: string): boolean;
  updateSlot(id: string, patch: Partial<Slot>): Slot | null;
  moveSlot(id: string, time: string): boolean;
  setValue(v: Value): void;
  setDay(slots: Slot[]): void;
  getValue(opts?: { compact?: boolean; resolve?: boolean }): Value;
  getDay(day?: Weekday): Slot[];
  getWeek(opts?: { resolve?: boolean }): WeekValue | ResolvedWeek | null;
  getSlot(id: string): Slot | null;
  activeSlot(at?: string | number | Date | { day: Weekday; time: string | number }): Slot | null;
  selectDay(d: Weekday): void;
  prevDay(): void;
  nextDay(): void;
  copyDay(from: Weekday, to: Weekday[] | 'weekdays' | 'weekend' | 'all', opts?: { newIds?: boolean }): boolean;
  assignDay(day: Weekday, slotsOrRef: Slot[] | DayRef): boolean;
  openEditor(id: string): void;
  closeEditor(): void;
  focusSlot(id: string): void;
  syncClock(t: string | Date | number | { day: Weekday; time: string }): void;
  validate(): Issue[];
  randomize(filter?: (m: Model | null, s: Slot) => boolean): void;
  reloadData(): Promise<void>;
  configure(partial: Config): void;
  reloadConfig(): void;
  exportConfig(opts?: { includeValue?: boolean }): Config;

  addEventListener<K extends keyof DayRhythmEventMap>(type: K, listener: (this: DayRhythmElement, ev: DayRhythmEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

declare global {
  interface HTMLElementTagNameMap { 'day-rhythm': DayRhythmElement }
}

export { core };
export const defaults: Required<Pick<Config, 'minGap' | 'snap' | 'theme' | 'week' | 'origin'>> & Config;
export function mergeConfig<T extends Config>(...layers: Array<Config | undefined>): T;
export const locales: {
  en: Record<string, string>; it: Record<string, string>;
  register(code: string, messages: Record<string, string>): void;
  get(code: string): Record<string, string> | undefined;
  [code: string]: any;
};
export const packs: { register(pack: Config & { id: string }): Config; [id: string]: any };
export { localStorageAdapter, httpStorageAdapter } from './storage.js';
export const version: string;
declare const _default: typeof DayRhythmElement;
export default _default;
