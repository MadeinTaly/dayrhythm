// Dial skin and sizing. Geometry remains in ui/dial-geometry.js.
export const dialCSS = `
.dr-dial{width:min(100%,360px);aspect-ratio:1;margin-inline:auto;position:relative;display:grid;place-items:center;border-radius:var(--dr-radius-panel,1.5rem);color:var(--x-ink,var(--dr-ink,currentColor));}
.dr-dial-svg{display:block;width:100%;height:100%;overflow:visible;touch-action:none;}
.dr-dial-ring{fill:var(--x-surface-soft,var(--dr-surface-soft,transparent));stroke:var(--x-border,var(--dr-border,currentColor));stroke-width:1;}
.dr-dial-arc{fill:var(--dr-arc-fill);fill-rule:evenodd;cursor:pointer;stroke:var(--x-surface,var(--dr-surface,transparent));stroke-width:1.5;vector-effect:non-scaling-stroke;opacity:.94;transition:opacity var(--x-dur,.12s),transform var(--x-dur,.12s);transform-origin:100px 100px;}
.dr-dial-arc-active{filter:drop-shadow(0 0 2px var(--x-accent,var(--dr-accent,currentColor)));opacity:1;}
.dr-dial-tick{stroke:var(--x-muted,var(--dr-muted,currentColor));stroke-width:1;opacity:.65;vector-effect:non-scaling-stroke;}
.dr-dial-tick-minor,.dr-dial-guide{display:none;}
.dr-dial-guide{stroke:currentColor;stroke-width:1;opacity:.3;pointer-events:none;vector-effect:non-scaling-stroke;}
.dr-dial-tick-label{fill:var(--x-muted,var(--dr-muted,currentColor));font:600 5px var(--x-font,system-ui,sans-serif);text-anchor:middle;dominant-baseline:middle;}
.dr-dial-now{stroke:var(--x-now,var(--dr-now,#d97761));stroke-width:2;stroke-linecap:round;vector-effect:non-scaling-stroke;pointer-events:none;}
.dr-dial-hub{display:none;fill:var(--x-surface,var(--dr-surface,transparent));stroke:var(--x-now,var(--dr-now,#d97761));stroke-width:2;vector-effect:non-scaling-stroke;pointer-events:none;}
.dr-dial-handle{fill:var(--x-accent,var(--dr-accent,currentColor));stroke:var(--x-surface,var(--dr-surface,Canvas));stroke-width:2;vector-effect:non-scaling-stroke;cursor:grab;outline:none;transition:transform var(--x-dur,.12s),opacity var(--x-dur,.12s);}
.dr-dial-handle:focus-visible{stroke:var(--x-focus,var(--dr-focus,currentColor));stroke-width:3;}
.dr-dial-handle[data-dragging]{cursor:grabbing;}
.dr-dial-center{pointer-events:none;text-anchor:middle;}
.dr-dial-center-time{fill:var(--x-ink,var(--dr-ink,currentColor));font:700 13px var(--x-font,system-ui,sans-serif);font-variant-numeric:tabular-nums;}
.dr-dial-center-label{fill:var(--x-ink,var(--dr-ink,currentColor));font:650 6px var(--x-font,system-ui,sans-serif);}
.dr-dial-center-summary{fill:var(--x-muted,var(--dr-muted,currentColor));font:5px var(--x-font,system-ui,sans-serif);}
.dr-dial-center-remaining{fill:var(--x-muted,var(--dr-muted,currentColor));font:4px var(--x-font,system-ui,sans-serif);}
@media (prefers-reduced-motion:reduce){.dr-dial-arc,.dr-dial-handle{transition:none;}}
`;
