'use client';
// React wrapper for <day-rhythm>. No top-level DOM access: safe to import on the server.
import { createElement as h, forwardRef, Fragment, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { mergeConfig, defaults } from '../src/ui/config.js';
import { deepEqual } from '../src/ui/dom.js';
import { activeSlotAt, isWeek, weekdayOf } from '../src/core/index.js';

// event -> handler prop. change/input call (value, detail); the others (detail, event).
const EVENTS = {
  change: 'onChange', input: 'onInput', dayview: 'onDayView', dayselect: 'onDaySelect', daysave: 'onDaySave', daydelete: 'onDayDelete',
  slotopen: 'onSlotOpen', slotclose: 'onSlotClose', slotinvalid: 'onSlotInvalid', error: 'onError',
};
const VALUE_EVENTS = new Set(['change', 'input']);
const OPTION_KEYS = [...Object.keys(defaults), 'renderers', 'modelFilter', 'clock'].filter((k) => k !== 'value' && k !== 'day');
const PROP_ALIAS = { readOnly: 'readonly' };
const PLAIN = (r) => r == null || typeof r === 'string' || (typeof Node !== 'undefined' && r instanceof Node) || (typeof r === 'object' && !r.$$typeof && typeof r.html === 'string');

let registering = null;
function register() {
  if (!registering) registering = import('../src/index.js').then(() => customElements.whenDefined('day-rhythm'));
  return registering;
}

export const DayRhythm = forwardRef(function DayRhythm(props, ref) {
  const { config, value, defaultValue, className, style, id, children, fallback, theme, locale, week, readOnly, name } = props;
  const el = useRef(null);
  const [ready, setReady] = useState(false);
  const [portals, setPortals] = useState(() => new Map());
  const latest = useRef(props);
  latest.current = props;
  const last = useRef(undefined); // last value emitted by the element or pushed to it
  const boxes = useRef(new Map()); // portal registry: key -> { node, container }
  const flush = useRef(false);

  useEffect(() => {
    let alive = true;
    register().then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  useImperativeHandle(ref, () => el.current, [ready]);

  // renderers returning ReactNode are mounted through portals
  const wrapRenderers = (r) => {
    if (!r) return r;
    const out = {};
    for (const key of Object.keys(r)) {
      out[key] = (ctx) => {
        const res = r[key](ctx);
        if (PLAIN(res)) return res;
        const pk = [key, ctx.slot && ctx.slot.id, ctx.day, ctx.field && ctx.field.key, ctx.model && ctx.model.id, ctx.preset && ctx.preset.id].join('|');
        let box = boxes.current.get(pk);
        if (!box) { const c = document.createElement('div'); c.style.display = 'contents'; box = { container: c }; boxes.current.set(pk, box); }
        box.node = res;
        if (!flush.current) {
          flush.current = true;
          queueMicrotask(() => {
            flush.current = false;
            for (const [k, b] of boxes.current) if (!b.container.isConnected && b.stale) boxes.current.delete(k); else b.stale = !b.container.isConnected;
            setPortals(new Map(boxes.current));
          });
        }
        return box.container;
      };
    }
    return out;
  };

  // config + direct props (direct props win, as in the element's own layering)
  const direct = {};
  for (const k of OPTION_KEYS) if (props[k] !== undefined) direct[k] = props[k];
  if (readOnly !== undefined) direct.readonly = readOnly;
  const merged = mergeConfig(config || {}, direct);
  if (merged.renderers && props.renderers) merged.renderers = props.renderers;
  const cfgRef = useRef(null);
  useEffect(() => {
    if (!ready || !el.current) return;
    if (cfgRef.current && deepEqual(cfgRef.current, merged)) return;
    cfgRef.current = merged;
    const next = { ...merged };
    if (next.renderers) next.renderers = wrapRenderers(next.renderers);
    el.current.config = next;
  });

  // listeners (latest handlers through a ref, attached once)
  useEffect(() => {
    if (!ready || !el.current) return undefined;
    const node = el.current;
    const offs = [];
    for (const [type, prop] of Object.entries(EVENTS)) {
      const fn = (e) => {
        if (!(e instanceof CustomEvent) || e.target !== node) return;
        if (type === 'change' || type === 'input') last.current = e.detail.value;
        const cb = latest.current[prop];
        if (cb) VALUE_EVENTS.has(type) ? cb(e.detail.value, e.detail) : cb(e.detail, e);
      };
      node.addEventListener(type, fn);
      offs.push(() => node.removeEventListener(type, fn));
    }
    if (latest.current.onReady) latest.current.onReady({});
    return () => offs.forEach((f) => f());
  }, [ready]);

  // controlled / uncontrolled value without echo loops (el.value is silent)
  useEffect(() => {
    if (!ready || !el.current) return;
    if (value !== undefined) {
      if (!deepEqual(value, last.current)) { last.current = value; el.current.value = value; }
    } else if (defaultValue !== undefined && last.current === undefined) {
      last.current = defaultValue;
      el.current.value = defaultValue;
    }
  }, [ready, value]);

  const attrs = { ref: el, id, class: className, style, theme, locale, week, name, readonly: readOnly ? '' : undefined };
  const kids = [];
  if (!ready && fallback != null) kids.push(h('div', { key: '__fallback', 'data-dr-fallback': '' }, fallback));
  if (children != null) kids.push(children);
  return h(Fragment, null, h('day-rhythm', attrs, ...kids), ...[...portals].map(([k, b]) => createPortal(b.node, b.container, k)));
});

export function useActiveSlot(value, opts = {}) {
  const [, tick] = useState(0);
  const ms = opts.tickMs == null ? 30000 : opts.tickMs;
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  if (!value) return null;
  let at = opts.clock ? opts.clock() : new Date();
  const zone = opts.timeZone ? { timeZone: opts.timeZone } : undefined;
  if (isWeek(value) && typeof at === 'number') at = { day: weekdayOf(new Date(), zone), time: at };
  const info = activeSlotAt(value, at, { ...zone, days: opts.days });
  return info ? info.slot : null;
}
