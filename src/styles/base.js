// Shared skin, driven entirely by the --x-* variables set in themes.js. Skipped when theme="none".
export const baseCSS = `
.dr-root:not([data-theme=none]){
font-family:var(--x-font);font-size:var(--dr-font-size,1rem);line-height:1.4;color:var(--x-ink);background:var(--x-surface);
border:1px solid var(--x-border);border-radius:var(--x-radius-panel);padding:var(--x-pad);box-shadow:var(--x-shadow);
--x-line:color-mix(in srgb,var(--x-ink) 50%,var(--x-surface));
&[data-disabled]{opacity:.55}

:is(button,input,select){font:inherit;color:inherit;-webkit-tap-highlight-color:transparent}
:focus-visible{outline:3px solid var(--x-focus);outline-offset:2px}
.dr-button,.dr-preset,.dr-preset-delete{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:2.6rem;padding:.45rem 1rem;border:1px solid var(--x-line);border-radius:var(--x-radius-button);background:var(--x-surface);font-size:.85em;transition:background-color var(--x-dur),border-color var(--x-dur)}
.dr-button:hover:not(:disabled),.dr-preset:hover:not(:disabled),.dr-model-option:hover{background:var(--x-surface-soft);border-color:var(--x-accent)}
.dr-button:disabled{opacity:.5}
.dr-button-primary{background:var(--x-accent);border-color:var(--x-accent);color:var(--x-accent-ink);font-weight:600}
.dr-button-primary:hover:not(:disabled){background:var(--x-accent);filter:brightness(.92)}
.dr-button-danger{color:var(--x-danger);border-color:var(--x-danger)}
.dr-preset{border-radius:var(--x-radius-chip)}
.dr-preset[aria-busy=true]{opacity:.6}
.dr-preset-delete{min-height:2rem;min-width:2rem;padding:0;border-radius:var(--x-radius-chip)}
.dr-preset-row{gap:.3rem}
.dr-presets-label{font-size:.75em;color:var(--x-muted);margin:.3rem 0 .2rem}
.dr-input{min-height:2.6rem;padding:.5rem .8rem;border:1px solid var(--x-line);border-radius:var(--x-radius-input);background:var(--x-surface);accent-color:var(--x-field-accent,var(--x-accent))}
.dr-input[aria-invalid=true]{border-color:var(--x-danger)}
.dr-error{color:var(--x-danger);font-size:.8em}
.dr-week-bar .dr-button{padding-inline:.7rem;min-width:var(--x-tap)}
.dr-week-tab{border:1px solid var(--x-border);border-radius:var(--x-radius-tab);background:var(--x-surface);font-size:.8em;padding:.3rem .5rem}
.dr-week-tab:hover{background:var(--x-surface-soft)}
.dr-week-tab[aria-selected=true]{background:var(--x-accent-soft);border-color:var(--x-accent);font-weight:650}
.dr-week-tab[data-today]::after{content:'';position:absolute;top:.3rem;right:.4rem;width:.4rem;height:.4rem;border-radius:50%;background:var(--x-now)}
.dr-week-tab[data-empty]{color:var(--x-muted)}
.dr-week-tab[data-linked]{border-style:dashed}
.dr-week-tab-preview{border-radius:99px;opacity:.9}
.dr-week-axis{font-size:.68em;color:var(--x-muted);font-variant-numeric:tabular-nums}
.dr-week-row-day{border:1px solid var(--x-border);border-radius:var(--x-radius-input);background:var(--x-surface);font-size:.8em;font-weight:600;text-transform:capitalize}
.dr-week-row[data-selected] .dr-week-row-day{background:var(--x-accent-soft);border-color:var(--x-accent)}
.dr-week-row[data-today] .dr-week-row-day::after{content:'';position:absolute;top:.25rem;right:.25rem;width:.35rem;height:.35rem;border-radius:50%;background:var(--x-now)}
.dr-track[data-row-day] .dr-slot{padding:0;border-radius:.55rem}
.dr-track[data-row-day] .dr-slot-carry{border-style:dashed}
.dr-week-row[data-selected] .dr-track[data-row-day] .dr-slot:not(.dr-slot-carry){border-color:color-mix(in srgb,var(--x-accent) 55%,var(--x-border))}
.dr-track[data-row-day] .dr-handle-grip{width:3px;height:60%;opacity:.8;background:var(--x-ink)}
.dr-toolbar-day{font-size:.85em;font-weight:650;text-transform:capitalize;margin-inline-end:.3rem}
.dr-spectrum{border-radius:var(--x-radius-spectrum);background:var(--x-ink)}
.dr-spectrum-segment{opacity:.9}
.dr-slot{border:1px solid var(--x-border);border-radius:var(--x-radius-card);background:var(--x-surface-soft);padding:.5rem}
.dr-track[data-orient=horizontal] .dr-slot{border-radius:var(--x-radius-card-h)}
.dr-slot-tint{opacity:var(--x-tint-opacity)}
.dr-slot[data-active]{border-color:var(--x-accent);box-shadow:inset 0 0 0 1px var(--x-accent)}
.dr-slot[data-invalid]{border-color:var(--x-danger);border-style:dashed}
.dr-slot-tail,.dr-slot-carry{opacity:var(--dr-carry-opacity,.55)}
.dr-slot-tail{cursor:default}
.dr-slot-carry{cursor:pointer;background:var(--x-surface-soft);border-style:dashed;color:inherit;font:inherit;text-align:center}
.dr-slot-content{gap:.3rem;padding:.2rem}
.dr-slot-time{font-variant-numeric:tabular-nums;font-size:.75em;font-weight:500;color:var(--x-muted);white-space:nowrap}
.dr-slot-label{font-size:.85em;font-weight:600}
.dr-track[data-orient=horizontal] :is(.dr-slot-label,.dr-slot-model-name){max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dr-track[data-orient=vertical] .dr-slot-time{min-width:3.6rem}
.dr-track[data-orient=vertical]{container-type:inline-size}
.dr-track[data-orient=vertical] .dr-slot-label{flex:1 1 auto;min-width:6ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dr-track[data-orient=vertical] .dr-slot-model{flex:0 1 auto;min-width:0}
.dr-track[data-orient=vertical] :is(.dr-slot-model-name,.dr-slot-summary){overflow-wrap:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
@container (max-width:24rem){.dr-track[data-orient=vertical] .dr-slot-summary{display:none}}
.dr-slot-model{padding:.35rem .25rem;min-height:var(--x-tap);border-radius:var(--x-radius-input)}
.dr-slot-model-name{font-size:.75em;line-height:1.3}
.dr-slot-summary{font-size:.7em;color:var(--x-muted)}
.dr-slot[data-off] .dr-slot-tint{background-image:repeating-linear-gradient(45deg,var(--x-line) 0 2px,transparent 2px 9px)!important;background-color:transparent!important;opacity:.35}
.dr-handle{border-radius:var(--x-radius-input)}
.dr-handle-grip{display:block;border-radius:99px;background:var(--x-accent);opacity:.45;transition:opacity var(--x-dur)}
.dr-track[data-orient=horizontal] .dr-handle-grip{width:4px;height:2.2rem}
.dr-track[data-orient=vertical] .dr-handle-grip{height:4px;width:2.2rem}
.dr-handle:hover .dr-handle-grip,.dr-handle[data-dragging] .dr-handle-grip,.dr-handle:focus-visible .dr-handle-grip{opacity:1}
.dr-handle-seam .dr-handle-grip{background:var(--x-ink)}
.dr-handle-time{background:var(--x-ink);color:var(--x-surface);font-size:.75em;font-variant-numeric:tabular-nums;padding:.1rem .5rem;border-radius:99px}
.dr-root[data-dragging]{cursor:grabbing}
.dr-dialog{background:var(--x-surface);color:var(--x-ink);border:1px solid var(--x-border);border-radius:var(--x-radius-dialog);box-shadow:0 24px 60px #0004}
.dr-dialog::backdrop{background:var(--x-overlay);backdrop-filter:blur(6px)}
.dr-dialog[open]{animation:dr-in var(--x-dur) ease-out}
@keyframes dr-in{from{opacity:0;transform:scale(.97)}}
.dr-dialog-header{padding:1.1rem 1.3rem .4rem;justify-content:space-between}
.dr-dialog-title{margin:0;font-size:1.1em;font-weight:650}
.dr-dialog-body{display:grid;gap:.9rem;padding:.6rem 1.3rem 1rem}
.dr-dialog-actions{padding:.8rem 1.3rem 1.2rem}
.dr-label{display:grid;gap:.25rem;font-size:.85em;font-weight:550;color:var(--x-muted)}
.dr-model-option{padding:.6rem .4rem;border:1px solid var(--x-border);border-radius:var(--x-radius-card);background:var(--x-surface);font-size:.75em}
.dr-model-option[aria-checked=true]{border-color:var(--x-accent);background:var(--x-accent-soft);box-shadow:inset 0 0 0 1px var(--x-accent)}
.dr-model-icon{font-size:var(--x-icon);line-height:1}
.dr-model-swatch{display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:var(--x-radius-input);border:1px solid var(--x-border);font-size:1.2rem;line-height:1}
.dr-model-swatch[data-off]{background-image:repeating-linear-gradient(45deg,var(--x-line) 0 2px,transparent 2px 8px)!important;background-color:transparent!important}
.dr-field-label{font-size:.85em;font-weight:550}
.dr-field-value{font-size:.85em;font-variant-numeric:tabular-nums;color:var(--x-muted)}
.dr-toggle-row{display:flex;align-items:center;gap:.6rem}
.dr-state{color:var(--x-muted);font-size:.9em}
.dr-credits{font-size:.72em;color:var(--x-muted)}
.dr-credits a{color:var(--x-muted);text-underline-offset:2px}
.dr-credits a:hover{color:var(--x-accent)}
}
@media (forced-colors:active){
.dr-root:not([data-theme=none]){--x-accent:Highlight;--x-border:CanvasText;--x-line:CanvasText;--x-focus:Highlight}
.dr-root .dr-handle-grip{forced-color-adjust:none}
.dr-root .dr-handle-grip{background:CanvasText;opacity:1}
}
`;
