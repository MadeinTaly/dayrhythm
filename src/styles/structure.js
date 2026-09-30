// Layout-critical CSS. Never disabled by a theme or option (theme "none" keeps only this).
export const structureCSS = `
:host,[data-dr-host]{display:block;contain:layout style;position:relative}
[data-dr-fallback],.dr-root [hidden]{display:none!important}
.dr-root{--x-track-length:var(--dr-track-length,max(70vh,34rem));--x-track-thickness:var(--dr-track-thickness,18rem);--x-card-min:var(--dr-card-min,52px);--x-gap:var(--dr-gap,.4rem);--x-handle:var(--dr-handle-size,1.1rem);--x-tap:var(--dr-tap,44px);--x-spectrum-h:var(--dr-spectrum-height,3.5rem);--x-icon:var(--dr-icon-size,1.35rem);--x-pad:var(--dr-pad,1.25rem);--x-dur:var(--dr-duration,.12s);--x-now-w:var(--dr-now-width,2px);--x-now:var(--dr-now,#d97761);--x-week-h:var(--dr-week-height,auto);
display:flex;flex-direction:column;gap:calc(var(--x-gap)*2.5);position:relative;container:dr/inline-size;min-width:0}
.dr-root *,.dr-root *::before,.dr-root *::after{box-sizing:border-box}
@media (prefers-reduced-motion:reduce){.dr-root{--x-dur:0s}}
.dr-root[data-disabled]{pointer-events:none}
.dr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.dr-toolbar,.dr-presets,.dr-preset-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--x-gap)}
.dr-presets{flex-direction:column;align-items:stretch}
.dr-toolbar{justify-content:space-between}
.dr-toolbar-main{display:flex;flex-wrap:wrap;gap:var(--x-gap);align-items:center;flex:1}
.dr-week-bar{display:flex;align-items:stretch;gap:var(--x-gap);min-height:var(--x-week-h)}
.dr-week-tablist{display:flex;flex:1;min-width:0;overflow-x:auto;gap:var(--x-gap);scrollbar-width:thin}
.dr-week-tab{flex:1 0 auto;min-width:var(--x-tap);min-height:var(--x-tap);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.25rem;position:relative}
.dr-week-tab-preview{align-self:stretch;height:.3rem;min-width:1.4rem}
@container dr (max-width:420px){.dr-tab-long{display:none}}
@container dr (min-width:421px){.dr-tab-short{display:none}}
.dr-spectrum{display:flex;height:var(--x-spectrum-h);overflow:hidden}
.dr-spectrum-segment{flex:0 1 0;min-width:0}
.dr-track-wrap{position:relative;max-width:100%}
.dr-root[data-orient=horizontal] .dr-track-wrap{overflow-x:auto;overflow-y:hidden}
.dr-track{display:flex;position:relative;gap:0;user-select:none;-webkit-user-select:none}
.dr-track[data-orient=horizontal]{flex-direction:row;height:var(--x-track-thickness);min-width:calc(var(--n,1)*(var(--x-card-min) + var(--x-handle)))}
.dr-track[data-orient=vertical]{flex-direction:column;min-height:max(var(--x-track-length),calc(var(--n,1)*(var(--x-card-min) + var(--x-handle))))}
.dr-slot{position:relative;flex:1 1 0;min-width:0;min-height:0;display:flex}
.dr-track[data-orient=horizontal] .dr-slot{min-width:var(--x-card-min)}
.dr-track[data-orient=vertical] .dr-slot{min-height:var(--x-card-min)}
.dr-slot[data-zero]{min-width:0!important;min-height:0!important;visibility:hidden;overflow:hidden}
.dr-slot-tint{position:absolute;inset:0;border-radius:inherit;pointer-events:none;overflow:hidden}
.dr-slot-content{position:relative;display:flex;min-width:0;min-height:0;flex:1;overflow:hidden}
.dr-track[data-orient=horizontal] .dr-slot-content{flex-direction:column;align-items:center;justify-content:flex-start;text-align:center}
.dr-track[data-orient=vertical] .dr-slot-content{flex-direction:row;align-items:center;flex-wrap:nowrap}
.dr-slot-model{position:static;display:flex;align-items:center;gap:.4rem;min-width:0;text-align:inherit;cursor:pointer;font:inherit;color:inherit;background:none;border:0}
.dr-slot-model::after{content:'';position:absolute;inset:0}
.dr-track[data-orient=horizontal] .dr-slot-model{flex-direction:column;max-width:100%}
.dr-slot-icon{display:inline-flex;align-items:center;justify-content:center;min-width:var(--x-icon);font-size:var(--x-icon);line-height:1}
.dr-slot-icon img{width:var(--x-icon);height:var(--x-icon);object-fit:contain}
.dr-slot-label,.dr-slot-model-name,.dr-slot-summary{min-width:0;overflow-wrap:anywhere}
.dr-handle{position:relative;flex:0 0 var(--x-handle);z-index:3;touch-action:none;display:flex;align-items:center;justify-content:center;outline-offset:-2px}
.dr-handle::before{content:'';position:absolute}
.dr-track[data-orient=horizontal] .dr-handle{cursor:ew-resize;flex-direction:column}
.dr-track[data-orient=horizontal] .dr-handle::before{top:0;bottom:0;left:calc(50% - var(--x-tap)/2);width:var(--x-tap)}
.dr-track[data-orient=vertical] .dr-handle{cursor:ns-resize}
.dr-track[data-orient=vertical] .dr-handle::before{left:0;right:0;top:calc(50% - var(--x-tap)/2);height:var(--x-tap)}
.dr-handle[data-alias]{pointer-events:none}
.dr-handle[data-alias]:not([data-dragging]),.dr-handle[data-hide]{visibility:hidden}
.dr-handle-time{position:absolute;z-index:4;pointer-events:none;opacity:0;white-space:nowrap}
.dr-track[data-orient=horizontal] .dr-handle-time{top:.4rem;left:50%;transform:translateX(-50%)}
.dr-track[data-orient=vertical] .dr-handle-time{left:.6rem;top:50%;transform:translateY(-50%)}
.dr-handle:focus-visible .dr-handle-time,.dr-handle[data-dragging] .dr-handle-time{opacity:1}
.dr-now-line{position:absolute;pointer-events:none;z-index:2;background:var(--x-now)}
.dr-track[data-orient=horizontal] .dr-now-line{top:0;bottom:0;width:var(--x-now-w);margin-left:calc(var(--x-now-w)/-2)}
.dr-track[data-orient=vertical] .dr-now-line{left:0;right:0;height:var(--x-now-w);margin-top:calc(var(--x-now-w)/-2)}
.dr-now-badge{position:absolute;white-space:nowrap;font-size:.7em;padding:.05rem .4rem;background:var(--x-now);color:#fff;border-radius:99px;transform:translate(-50%,0)}
.dr-track[data-orient=horizontal] .dr-now-badge{top:.15rem;left:50%}
.dr-track[data-orient=vertical] .dr-now-badge{left:auto;right:.3rem;top:0;transform:translate(0,-50%)}
.dr-dialog{padding:0;border:0;width:100%;max-width:min(94vw,30rem);max-height:min(90dvh,46rem)}
.dr-dialog[open]{display:flex;flex-direction:column}
.dr-dialog-body{overflow:auto;min-height:0}
.dr-dialog-header,.dr-dialog-actions{display:flex;align-items:center;gap:var(--x-gap);flex-wrap:wrap}
.dr-dialog-actions{justify-content:flex-end}
.dr-model-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(5.5rem,1fr));gap:var(--x-gap)}
.dr-model-option{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3rem;min-height:5rem;min-width:0;text-align:center;cursor:pointer}
.dr-field{display:grid;gap:.25rem}
.dr-field-head{display:flex;justify-content:space-between;gap:1rem}
.dr-field-input[type=range]{width:100%}
.dr-copy-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(7rem,1fr));gap:var(--x-gap)}
.dr-region:empty{display:none}
.dr-credits{display:flex;flex-wrap:wrap;gap:.3rem 1rem;justify-content:flex-end}
.dr-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6rem;min-height:8rem;text-align:center}
.dr-button,.dr-week-tab,.dr-model-option,.dr-preset{font:inherit;cursor:pointer;color:inherit}
.dr-root button:disabled{cursor:not-allowed}
.dr-input{font:inherit;min-width:0;width:100%}
`;
