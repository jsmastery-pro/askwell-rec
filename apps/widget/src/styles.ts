/** Black or white, whichever reads better on `#rrggbb`. */
export function textColorFor(hex: string): "#000" | "#fff" {
  const n = Number.parseInt(hex.slice(1), 16);
  const brightness = ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return brightness > 150 ? "#000" : "#fff";
}

/**
 * Scoped to our shadow root. `color` must already match `HEX_COLOR_PATTERN`: it is the only
 * config value that reaches the CSS. Position and animation are class names from fixed lists.
 * Pixel units, because the host page's root font size isn't ours.
 */
export function widgetCss(color: string): string {
  return `:host{all:initial}
.w{position:fixed;z-index:2147483647;display:flex;flex-direction:column;align-items:flex-end;gap:12px;pointer-events:none;font:500 14px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--ox:100%;--oy:100%;--from:none}
.top{top:20px;flex-direction:column-reverse;--oy:0}.bottom{bottom:20px}
.right{right:20px}.left{left:20px;align-items:flex-start;--ox:0}
.slide.bottom{--from:translateY(16px)}.slide.top{--from:translateY(-16px)}.scale{--from:scale(.9)}
.b{position:relative;display:inline-flex;align-items:center;min-height:48px;padding:0 20px;border:0;border-radius:999px;background:${color};color:${textColorFor(color)};font:inherit;cursor:pointer;pointer-events:auto;box-shadow:0 8px 32px rgb(0 0 0/.16);transform-origin:var(--ox) var(--oy);animation:in .25s ease-out}
.b:focus-visible{outline:2px solid ${color};outline-offset:3px}
.u{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 6px;box-sizing:border-box;border:2px solid #fff;border-radius:999px;background:#000;color:#fff;font-size:11px;line-height:16px;text-align:center}
.u[hidden]{display:none}
.p{display:block;width:min(380px,calc(100vw - 40px));height:560px;max-height:calc(100vh - 100px);border:0;border-radius:16px;background:#fff;box-shadow:0 8px 32px rgb(0 0 0/.16);opacity:0;visibility:hidden;transform:var(--from);transform-origin:var(--ox) var(--oy);transition:opacity .2s,transform .2s,visibility 0s .2s}
.open .p{opacity:1;visibility:visible;transform:none;pointer-events:auto;transition:opacity .2s,transform .2s}
@keyframes in{from{opacity:0;transform:var(--from)}}
@media (prefers-reduced-motion:reduce){.b,.p{animation:none;transition:none}}`;
}
