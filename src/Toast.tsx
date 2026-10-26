import { Children, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { css, len, pick } from "./css";
import { renderIcon } from "./icons";
import { dismiss, holdExit } from "./store";
import { DEFAULT_GAP } from "./placement";
import type { Placement, SlideFrom } from "./placement";
import type {
  ToastConfig,
  ToastMotion,
  ToastRecord,
  ToastVariant,
} from "./types";

// one toast card. it owns three things:
//
//  - the enter / exit animation. the card fades, slides, unblurs and scales in,
//    while the wrapper around it grows from 0fr to 1fr so the rest of the stack
//    glides into place instead of jumping.
//  - the auto dismiss countdown, because this is the only place that knows
//    whether the pointer or the keyboard is currently resting on the toast.
//  - the progress bar, which is the same countdown drawn as a bar and therefore
//    pauses on exactly the same frame.

const DEFAULT_DURATION = 4000;
const SYSTEM_FONT =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

interface Palette {
  bg: string;
  text: string;
  muted: string;
  track: string;
}

const THEMES: Record<"dark" | "light", Palette> = {
  dark: {
    bg: "#141b21",
    text: "#f1f5f9",
    muted: "#a8b5c3",
    track: "rgba(255, 255, 255, 0.1)",
  },
  light: {
    bg: "#ffffff",
    text: "#18181b",
    muted: "#526171",
    track: "rgba(9, 9, 11, 0.08)",
  },
};

const DARK_ACCENTS: Record<ToastVariant, string> = {
  default: "#a1a1aa",
  success: "#34d399",
  error: "#fb7185",
  info: "#60a5fa",
  warning: "#fbbf24",
  loading: "#a1a1aa",
};

const LIGHT_ACCENTS: Record<ToastVariant, string> = {
  default: "#526171",
  success: "#047857",
  error: "#be123c",
  info: "#1d4ed8",
  warning: "#a16207",
  loading: "#526171",
};

interface ResolvedMotion {
  enter: number;
  exit: number;
  exitHold: number;
  easing: string;
  exitEasing: string;
  slide: number;
  scale: number;
  blur: number;
}

const MOTION_DEFAULTS: ResolvedMotion = {
  enter: 500,
  exit: 450,
  exitHold: 2000,
  // Ease into and out of each stage, matching the silhouette's smoothstep.
  easing: "cubic-bezier(0.33, 0, 0.67, 1)",
  exitEasing: "cubic-bezier(0.33, 0, 0.67, 1)",
  slide: 22,
  scale: 0.94,
  blur: 2,
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

// One continuous outline means gradients and images also flow through the
// notch without seams. Dimensions come from layout, never transformed bounds.
function outlinePath(width: number, height: number, headingWidth: number, headingHeight: number, radius: number, described: boolean, expansion: number, bottom: boolean, align: Placement["notchAlign"]): string {
  const r = Math.max(0, Math.min(radius, width / (described ? 6 : 2), (height - (described ? headingHeight : 0)) / 2));
  if (!described) {
    return `M${r} 0 H${width-r} Q${width} 0 ${width} ${r} V${height-r} Q${width} ${height} ${width-r} ${height} H${r} Q0 ${height} 0 ${height-r} V${r} Q0 0 ${r} 0 Z`;
  }
  // Build side notches against the left edge, then reflect only the geometry
  // for right placements. Text and background gradients remain upright.
  const left = align === "center" ? (width - headingWidth) / 2 : 0;
  const right = left + headingWidth;
  const shoulder = Math.max(0, Math.min(14, width - right - r));
  const cap = Math.max(0, Math.min(radius, headingHeight / 2, headingWidth / 2));
  const point = (x: number, y: number, fullX = x, fullY = y) => {
    const px = x + (fullX - x) * expansion;
    const py = y + (fullY - y) * expansion;
    return `${(align === "right" ? width - px : px).toFixed(3)} ${(bottom ? height - py : py).toFixed(3)}`;
  };
  // The flush side stays straight as its lower corner travels with the panel.
  // Centered notches retain a shoulder on both sides.
  const leftEdge = align === "center"
    ? `Q${point(left+cap, headingHeight, 0, height)} ${point(left+cap, headingHeight, 0, height-r)}
       L${point(left+cap, headingHeight, 0, headingHeight+r)}
       Q${point(left+cap, headingHeight, 0, headingHeight)} ${point(left+cap, headingHeight, r, headingHeight)}
       L${point(left+cap, headingHeight, left-shoulder, headingHeight)}
       Q${point(left, headingHeight)} ${point(left, headingHeight-cap, left, headingHeight-shoulder)}`
    : `Q${point(left, headingHeight, 0, height)} ${point(left, headingHeight-cap, 0, height-r)}`;
  // Both endpoints have the same segments: a heading-sized capsule unfolds
  // into the wider panel. Only coordinates move; stroke thickness stays 1px.
  return `M${point(left+cap, 0)} L${point(right-cap, 0)}
    Q${point(right, 0)} ${point(right, cap)}
    L${point(right, headingHeight-cap, right, headingHeight-shoulder)}
    Q${point(right, headingHeight)} ${point(right-cap, headingHeight, right+shoulder, headingHeight)}
    L${point(right-cap, headingHeight, width-r, headingHeight)}
    Q${point(right-cap, headingHeight, width, headingHeight)} ${point(right-cap, headingHeight, width, headingHeight+r)}
    L${point(right-cap, headingHeight, width, height-r)}
    Q${point(right-cap, headingHeight, width, height)} ${point(right-cap, headingHeight, width-r, height)}
    L${point(left+cap, headingHeight, r, height)}
    ${leftEdge}
    L${point(left, cap)} Q${point(left, 0)} ${point(left+cap, 0)} Z`.replace(/\s+/g, " ");
}

function ms(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function resolveMotion(motion: ToastMotion | undefined, reducedMotion: boolean): ResolvedMotion {
  const resolved: ResolvedMotion = {
    enter: ms(motion?.enter, MOTION_DEFAULTS.enter),
    exit: ms(motion?.exit, MOTION_DEFAULTS.exit),
    exitHold: ms(motion?.exitHold, MOTION_DEFAULTS.exitHold),
    easing: css(motion?.easing) ?? MOTION_DEFAULTS.easing,
    exitEasing: css(motion?.exitEasing) ?? MOTION_DEFAULTS.exitEasing,
    slide: ms(motion?.slide, MOTION_DEFAULTS.slide),
    scale:
      typeof motion?.scale === "number" && Number.isFinite(motion.scale)
        ? motion.scale
        : MOTION_DEFAULTS.scale,
    blur: ms(motion?.blur, MOTION_DEFAULTS.blur),
  };

  // honour the os level motion preference: keep the lifecycle, drop the travel
  if (reducedMotion) {
    return { ...resolved, enter: 1, exit: 1, exitHold: 0, slide: 0, scale: 1, blur: 0 };
  }
  return resolved;
}

// a non numeric or negative duration would make setTimeout fire immediately,
// so anything unusable becomes "persist until dismissed"
function normalizeDuration(value: number | undefined): number {
  if (value === undefined) return DEFAULT_DURATION;
  if (typeof value !== "number" || Number.isNaN(value)) return Infinity;
  if (!Number.isFinite(value)) return Infinity;
  return Math.max(value, 0);
}

function hiddenTransform(
  from: SlideFrom,
  slide: number,
  scale: number
): string {
  const parts: string[] = [];
  if (slide > 0) {
    if (from === "top") parts.push(`translateY(${-slide}px)`);
    else if (from === "bottom") parts.push(`translateY(${slide}px)`);
    else if (from === "left") parts.push(`translateX(${-slide}px)`);
    else if (from === "right") parts.push(`translateX(${slide}px)`);
  }
  if (scale !== 1) parts.push(`scale(${scale})`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

export interface ToastProps {
  record: ToastRecord;
  /** the toast's own config already merged over the <Toaster /> defaults */
  settings: ToastConfig;
  placement: Placement;
}

export function Toast({ record, settings, placement }: ToastProps) {
  const { id, variant, createdAt, leaving } = record;

  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const motion = resolveMotion(settings.motion, reducedMotion);
  const hasDescription = Children.toArray(settings.description).some(
    (child) => typeof child !== "string" || child.trim().length > 0
  );
  const bottom = placement.notch === "bottom";
  const notchAlign = placement.notchAlign;
  const immediate = reducedMotion || motion.enter === 0;
  const revealDelay = immediate ? 0 : motion.enter * 0.4;
  const expandMs = immediate ? 0 : motion.enter - revealDelay;
  const [expanded, setExpanded] = useState(!hasDescription || immediate);
  const [exitReady, setExitReady] = useState(false);
  const [exitCollapsed, setExitCollapsed] = useState(false);
  const [exitDelay, setExitDelay] = useState(0);
  const expansionRef = useRef(!hasDescription || immediate ? 1 : 0);
  const collapseDurationRef = useRef(0);
  const exitHoldRef = useRef(0);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<SVGPathElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const [shape, setShape] = useState({ width: 360, height: 120, headingWidth: 240, headingHeight: 50, radius: hasDescription ? 20 : 9999 });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    const heading = headingRef.current;
    if (!card || !heading) return;
    const measure = () => {
      if (!card.offsetWidth || !card.offsetHeight) return;
      const next = {
        width: card.offsetWidth,
        height: card.offsetHeight,
        headingWidth: heading.offsetWidth,
        headingHeight: heading.offsetHeight,
        radius: Number.parseFloat(window.getComputedStyle(card).borderTopLeftRadius) || 0,
      };
      setShape((previous) => Object.keys(next).every((key) => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(card);
    observer?.observe(heading);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [record.message, settings.description, settings.width, settings.height, settings.padding, settings.font, settings.fontSize, settings.radius, settings.style]);
  const duration = normalizeDuration(settings.duration);
  const timed = Number.isFinite(duration) && duration > 0;
  const showProgress = settings.progress !== false && timed;
  const pauseEnabled = settings.pauseOnHover !== false && timed;

  const [entered, setEntered] = useState(immediate);
  const [settled, setSettled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(duration);
  const [progress, setProgress] = useState(0);
  const [closeHovered, setCloseHovered] = useState(false);
  const [closeFocused, setCloseFocused] = useState(false);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);

  const startedAt = useRef(Date.now());
  // mirrors the state for the event handlers, which must not read stale values
  // and must never subtract the same elapsed slice twice
  const pausedRef = useRef(false);
  const enteredRef = useRef(immediate);

  const visible = entered && (!leaving || !exitReady);
  const bodyExpanded = (expanded || immediate) && !leaving;
  const running = entered && !paused && !leaving;

  const notchEnterMs = hasDescription ? motion.enter * 0.4 : motion.enter;
  const bodyExitMs = exitDelay || (leaving && !reducedMotion
    ? Math.round(motion.exit * 0.5 * expansionRef.current)
    : 0);
  const notchExitMs = Math.max(0, motion.exit - exitDelay);
  const phaseMs = visible ? notchEnterMs : notchExitMs;
  const phaseEase = visible ? motion.easing : motion.exitEasing;
  // Make room while the notch arrives; scale this with the requested speed.
  const rowMs = visible ? motion.enter * 0.5 : notchExitMs;
  const bodyFadeMs = leaving ? bodyExitMs * 0.8 : expandMs * 0.6;

  // flip to the visible style one painted frame after mount, so the browser has
  // an initial state to transition away from. two frames, because a single one
  // is occasionally coalesced with the mounting paint.
  useEffect(() => {
    if (entered) return;
    if (immediate || typeof requestAnimationFrame !== "function") {
      enteredRef.current = true;
      setEntered(true);
      return;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        enteredRef.current = true;
        setEntered(true);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner) cancelAnimationFrame(inner);
    };
  }, [entered, immediate]);

  // Finish the heading's arrival before opening the description panel.
  useEffect(() => {
    if (!entered || leaving || expanded) return;
    if (!hasDescription || immediate) {
      setExpanded(true);
      return;
    }
    const timer = setTimeout(() => setExpanded(true), revealDelay);
    return () => clearTimeout(timer);
  }, [entered, leaving, expanded, hasDescription, immediate, revealDelay]);

  // A dismissal reverses from the current shape, even halfway through entry.
  // Hold the collapsed pill before its final fade and row close.
  useEffect(() => {
    if (!leaving) {
      setExitReady(false);
      setExitCollapsed(false);
      setExitDelay(0);
      exitHoldRef.current = 0;
      return;
    }
    const delay = hasDescription && !reducedMotion
      ? Math.round(motion.exit * 0.5 * expansionRef.current)
      : 0;
    collapseDurationRef.current = delay;
    const hold = delay > 0 ? motion.exitHold : 0;
    exitHoldRef.current = hold;
    setExitDelay(delay);
    setExitCollapsed(delay === 0);
    if (delay === 0) {
      setExitReady(true);
      return;
    }
    const collapsedTimer = setTimeout(() => setExitCollapsed(true), delay);
    const departureTimer = setTimeout(() => setExitReady(true), delay + hold);
    return () => {
      clearTimeout(collapsedTimer);
      clearTimeout(departureTimer);
    };
  }, [leaving, hasDescription, reducedMotion, motion.exit, motion.exitHold]);

  // Animate only two paint properties. No layout reads or React state updates
  // occur per frame, and the background and outline always share one path.
  useEffect(() => {
    const surface = surfaceRef.current;
    const outline = outlineRef.current;
    if (!surface || !outline) return;
    const target = bodyExpanded ? 1 : 0;
    const from = expansionRef.current;
    const duration = leaving ? collapseDurationRef.current : expandMs;
    const paint = (value: number) => {
      expansionRef.current = value;
      const next = outlinePath(shape.width, shape.height, shape.headingWidth, shape.headingHeight, shape.radius, hasDescription, value, bottom, notchAlign);
      surface.style.clipPath = `path("${next}")`;
      outline.setAttribute("d", next);
    };
    if (!hasDescription || reducedMotion || duration === 0 || from === target || typeof requestAnimationFrame !== "function") {
      paint(target);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const fraction = Math.min(1, Math.max(0, (now - started) / duration));
      const eased = fraction * fraction * (3 - 2 * fraction);
      paint(from + (target - from) * eased);
      if (fraction < 1) frame = requestAnimationFrame(tick);
    };
    paint(from);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [bodyExpanded, leaving, expandMs, hasDescription, reducedMotion, shape, bottom, notchAlign]);

  // once the card's own motion is over it no longer needs a compositing layer
  // or a filter. this waits for the card, not the row: dropping them early
  // would tear the layer down mid-animation.
  useEffect(() => {
    if (!entered || leaving) return;
    const timer = setTimeout(() => setSettled(true), motion.enter);
    return () => clearTimeout(timer);
  }, [entered, leaving, motion.enter]);

  // the record leaves the store only after this card finished animating out.
  // the store holds the timer, so the removal still happens if this card
  // unmounts mid-exit, and re-adding the same id cancels it.
  useEffect(() => {
    if (!leaving) return;
    holdExit(id, motion.exit + exitHoldRef.current);
  }, [leaving, id, motion.exit, motion.exitHold, hasDescription, reducedMotion]);

  // a toast can be replaced in place (same id - toast.promise going from
  // loading to success). react keeps this component instance, so the countdown
  // has to be reset explicitly, or the replacement inherits the old remaining
  // time and, if that was Infinity, never dismisses.
  useEffect(() => {
    startedAt.current = Date.now();
    const interacting = pauseEnabled && (hoveredRef.current || focusedRef.current);
    pausedRef.current = interacting;
    setPaused(interacting);
    setRemaining(duration);
    setProgress(0);
  }, [duration, createdAt, pauseEnabled]);

  // auto dismiss, and resumption after a pause
  useEffect(() => {
    if (!running || !Number.isFinite(remaining)) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => dismiss(id), Math.max(remaining, 0));
    return () => clearTimeout(timer);
    // createdAt is a dependency so replacing a toast restarts the countdown
    // even when the new record happens to have the same duration
  }, [running, remaining, id, createdAt]);

  // the bar is the countdown, drawn. it animates to full over the remaining
  // time and freezes at the exact consumed fraction whenever that clock stops.
  useEffect(() => {
    if (!showProgress || !Number.isFinite(remaining) || duration <= 0) return;

    if (!running) {
      // `remaining` already had the elapsed slice subtracted when the pause
      // started, so the consumed fraction follows straight from it. measuring
      // the elapsed time again here would count that slice twice and make the
      // bar jump forward on hover.
      const consumed = (duration - remaining) / duration;
      setProgress(Math.min(Math.max(consumed, 0), 1));
      return;
    }

    if (typeof requestAnimationFrame !== "function") {
      setProgress(1);
      return;
    }
    const frame = requestAnimationFrame(() => setProgress(1));
    return () => cancelAnimationFrame(frame);
  }, [running, remaining, duration, showProgress]);

  const pause = useCallback(() => {
    if (!pauseEnabled || pausedRef.current) return;
    pausedRef.current = true;
    // before the enter frame the clock has not started, so nothing is consumed
    const elapsed = enteredRef.current ? Date.now() - startedAt.current : 0;
    setRemaining((previous) => Math.max(previous - elapsed, 0));
    setPaused(true);
  }, [pauseEnabled]);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const light = settings.theme === "light";
  const palette = THEMES[light ? "light" : "dark"];
  const accents = light ? LIGHT_ACCENTS : DARK_ACCENTS;
  const accent = accents[variant] ?? accents.default;
  const icon = renderIcon(settings.icon, variant, css(settings.iconColor) ?? accent, reducedMotion);
  const background = settings.style?.background ?? settings.style?.backgroundColor ??
    css(pick(settings.bgColor, settings.background)) ?? palette.bg;
  const border = settings.style?.border ?? css(settings.border) ??
    `1px solid ${accent}`;
  const radius = settings.style?.borderRadius ?? len(settings.radius) ?? (hasDescription ? 20 : 9999);
  const padding = settings.style?.padding ?? len(settings.padding);
  // Preserve CSS lengths in SVG rather than interpreting e.g. 1em as 1px.
  const parsedBorder = typeof document === "undefined" ? null : document.createElement("span").style;
  if (parsedBorder) parsedBorder.border = String(border);
  const borderColor = parsedBorder?.borderTopColor || "currentColor";
  const borderStyle = parsedBorder?.borderTopStyle || "none";
  const rawBorderWidth = parsedBorder?.borderTopWidth || "medium";
  const widthKeyword = /^(thin|medium|thick)$/.test(rawBorderWidth) ? rawBorderWidth : null;
  const [resolvedBorderWidth, setResolvedBorderWidth] = useState<{ keyword: string; width: number } | null>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || !widthKeyword || borderStyle === "none" || borderStyle === "hidden") return;
    // CSS owns keyword widths. Resolve them once using the same browser,
    // without adding a box to layout or doing any work on animation frames.
    const probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.setAttribute("data-ztoast-border-probe", "");
    Object.assign(probe.style, {
      position: "absolute", visibility: "hidden", pointerEvents: "none",
      width: "0", height: "0", borderStyle: "solid", borderWidth: widthKeyword,
    });
    card.appendChild(probe);
    try {
      const computedWidth = window.getComputedStyle(probe).borderTopWidth;
      if (/^[\d.]+px$/.test(computedWidth)) {
        const width = Number.parseFloat(computedWidth);
        if (Number.isFinite(width)) setResolvedBorderWidth({ keyword: widthKeyword, width });
      }
    } finally {
      probe.remove();
    }
  }, [widthKeyword, borderStyle]);

  const borderWidth = borderStyle === "none" || borderStyle === "hidden" ? 0
    : widthKeyword ? (resolvedBorderWidth?.keyword === widthKeyword ? resolvedBorderWidth.width : 0)
      : /^[\d.]+px$/.test(rawBorderWidth) ? Number.parseFloat(rawBorderWidth) : rawBorderWidth;
  const dashLength = typeof borderWidth === "number" ? borderWidth * 3 : `calc(${borderWidth} * 3)`;
  const dashGap = typeof borderWidth === "number" ? borderWidth * 2 : `calc(${borderWidth} * 2)`;
  const borderDashes = borderStyle === "dashed" ? `${dashLength} ${dashGap}`
    : borderStyle === "dotted" ? `0 ${dashGap}` : undefined;
  const path = outlinePath(shape.width, shape.height, shape.headingWidth, shape.headingHeight, shape.radius, hasDescription, expansionRef.current, bottom, notchAlign);
  const gap =
    typeof settings.gap === "number" && settings.gap >= 0
      ? settings.gap
      : DEFAULT_GAP;

  const width = len(settings.width);
  const departing = leaving && exitReady;
  const pillCenterX = !hasDescription || notchAlign === "center" ? shape.width / 2
    : notchAlign === "left" ? shape.headingWidth / 2 : shape.width - shape.headingWidth / 2;
  const pillCenterY = !hasDescription ? shape.height / 2
    : bottom ? shape.height - shape.headingHeight / 2 : shape.headingHeight / 2;
  const departureTransform = reducedMotion || motion.exit === 0 || motion.scale === 1
    ? "none" : "scaleX(0) scaleY(0.8)";

  // The pill and its shadow fade together. Keep the row unmasked so it cannot
  // crop the moving pill before its opacity transition finishes.
  const cardTransition = [
    `transform ${phaseMs}ms ${phaseEase}`,
    `opacity ${visible ? Math.round(phaseMs * 0.75) : phaseMs}ms ${phaseEase}`,
    `filter ${phaseMs}ms ${phaseEase}`,
  ].join(", ");

  const cardStyle: CSSProperties = {
    position: "relative",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: bottom ? "column-reverse" : "column",
    minWidth: width,
    maxWidth: width ?? "min(440px, calc(100vw - 32px))",
    width: width ?? "fit-content",
    height: len(settings.height),
    minHeight: "min-content",
    borderRadius: radius,
    color: css(pick(settings.textColor, settings.color)) ?? palette.text,
    fontFamily: css(settings.font) ?? SYSTEM_FONT,
    fontSize: len(settings.fontSize) ?? 14,
    lineHeight: 1.45,
    textAlign: "left",
    pointerEvents: leaving ? "none" : "auto",
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : departing ? departureTransform : hiddenTransform(placement.from, motion.slide, motion.scale),
    transformOrigin: departing ? `${pillCenterX}px ${pillCenterY}px` : `${notchAlign} ${bottom ? "bottom" : "top"}`,
    filter: [
      !settings.shadow && settings.style?.boxShadow === undefined ? (light
        ? "drop-shadow(0 8px 14px rgba(15, 23, 42, 0.10))"
        : "drop-shadow(0 12px 20px rgba(0, 0, 0, 0.32))") : "",
      visible ? (settled ? "" : "blur(0px)") : motion.blur > 0 ? `blur(${motion.blur}px)` : "",
    ].filter(Boolean).join(" ") || undefined,
    transition: cardTransition,
    willChange: settled && !leaving ? undefined : "transform, opacity, filter",
    ...settings.style,
    // A single clipped background paints the full silhouette below the content.
    background: "transparent",
    border: 0,
    padding: 0,
    boxShadow: settings.style?.boxShadow ?? css(settings.shadow),
  };

  const surfaceStyle: CSSProperties = {
    boxSizing: "border-box",
    background,
    clipPath: `path("${path.replace(/\s+/g, " ")}")`,
  };

  const closeButton = settings.closable === true && (
    <button
      type="button"
      onClick={() => dismiss(id)}
      onMouseEnter={() => setCloseHovered(true)}
      onMouseLeave={() => setCloseHovered(false)}
      onFocus={() => setCloseFocused(true)}
      onBlur={() => setCloseFocused(false)}
      aria-label="Dismiss notification"
      style={{
        appearance: "none",
        position: hasDescription ? "absolute" : "relative",
        top: hasDescription && !bottom ? 8 : undefined,
        bottom: hasDescription && bottom ? 8 : undefined,
        right: hasDescription ? 8 : undefined,
        background: closeHovered ? palette.track : "transparent",
        border: 0,
        margin: 0,
        padding: 8,
        width: 32,
        height: 32,
        borderRadius: 10,
        color: palette.muted,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        outline: closeFocused ? `2px solid ${accent}` : undefined,
        outlineOffset: 2,
        transition: "background 160ms ease",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );

  const progressBar = showProgress && (
    <div data-ztoast-progress="" aria-hidden="true" style={{
      position: "absolute", left: 24, right: 24, top: bottom && hasDescription ? 0 : undefined, bottom: bottom && hasDescription ? undefined : 0, height: 2,
      overflow: "hidden", borderRadius: 2, background: palette.track,
    }}>
      <div style={{
        height: "100%", width: "100%", background: css(settings.progressColor) ?? accent,
        transformOrigin: "left center", transform: `scaleX(${progress})`,
        transition: running ? `transform ${Math.max(remaining, 0)}ms linear` : "none",
      }} />
    </div>
  );

  return (
    <div
      data-ztoast-item=""
      style={{
        display: "grid",
        // 0fr -> 1fr animates the row height without ever measuring the dom,
        // which is what makes the stack settle smoothly when one toast leaves
        gridTemplateRows: visible ? "1fr" : "0fr",
        transition: `grid-template-rows ${rowMs}ms ${phaseEase} 0ms`,
      }}
    >
      <div
        style={{
          minHeight: 0,
          // while the row is still growing the card is taller than it. flex
          // alignment decides which way it overflows, and it has to be away
          // from the anchor - into the space the stack is opening up - so the
          // card never covers a toast that is already on screen.
          display: "flex",
          alignItems:
            placement.direction === "up" ? "flex-end" : "flex-start",
          overflow: "visible",
        }}
      >
        {/* the gap between toasts lives inside the collapsing box, so it
            disappears together with the toast instead of leaving a hole */}
        <div style={{ paddingTop: gap / 2, paddingBottom: gap / 2 }}>
          <div
            ref={cardRef}
            data-ztoast=""
            data-variant={variant}
            data-ztoast-notch={placement.notch}
            data-ztoast-notch-align={notchAlign}
            data-ztoast-expanded={bodyExpanded}
            role={variant === "error" ? "alert" : "status"}
            aria-live={variant === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            style={cardStyle}
            onMouseEnter={() => { hoveredRef.current = true; pause(); }}
            onMouseLeave={() => {
              hoveredRef.current = false;
              if (!focusedRef.current) resume();
            }}
            onFocus={() => { focusedRef.current = true; pause(); }}
            onBlur={(event) => {
              if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
              focusedRef.current = false;
              if (!hoveredRef.current) resume();
            }}
          >
            <div ref={surfaceRef} data-ztoast-surface="" aria-hidden="true" style={{
              ...surfaceStyle, position: "absolute", inset: 0, pointerEvents: "none",
            }} />
            <svg aria-hidden="true" width="100%" height="100%" viewBox={`0 0 ${shape.width} ${shape.height}`}
              preserveAspectRatio="none" style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
              <path ref={outlineRef} d={path} fill="none" stroke={borderColor} strokeWidth={borderWidth}
                strokeLinecap={borderStyle === "dotted" ? "round" : "butt"} style={{ strokeDasharray: borderDashes }} />
            </svg>
            {/* Reserve shoulder space intrinsically so short descriptions can
                shrink the panel without forcing the heading onto extra lines. */}
            <div data-ztoast-heading-wrap="" style={{
              display: "flex",
              boxSizing: "border-box",
              width: "100%",
              flexShrink: 0,
              paddingLeft: !hasDescription || notchAlign === "left" ? 0 : notchAlign === "right" ? 48 : 24,
              paddingRight: !hasDescription || notchAlign === "right" ? 0 : notchAlign === "left" ? 48 : 24,
            }}>
            <div ref={headingRef} data-ztoast-heading="" style={{
              position: "relative",
              alignSelf: notchAlign === "left" ? "flex-start" : notchAlign === "right" ? "flex-end" : "center",
              marginLeft: notchAlign !== "left" ? "auto" : undefined,
              marginRight: notchAlign !== "right" ? "auto" : undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: hasDescription ? "fit-content" : "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              padding: padding ?? (hasDescription ? (bottom ? "10px 18px 12px" : "12px 18px 10px") : "10px 14px"),
            }}>
              {icon != null && <span data-ztoast-icon="" style={{
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                width: 28, height: 28, borderRadius: 10,
                background: light ? "rgba(100, 116, 139, 0.08)" : "rgba(148, 163, 184, 0.08)",
              }}>{icon}</span>}
              <div style={{ minWidth: 0, fontWeight: settings.fontWeight ?? 600, overflowWrap: "anywhere" }}>
                {record.message}
              </div>
              {!hasDescription && closeButton}
              {!hasDescription && progressBar}
            </div>
            </div>
            {hasDescription && (
              <div data-ztoast-body="" style={{
                position: "relative",
                boxSizing: "border-box",
                flex: 1,
                minWidth: 0,
                width: "100%",
                padding: padding ?? `${bottom ? 14 : 8}px ${settings.closable === true ? 44 : 12}px ${bottom ? 8 : 14}px 12px`,
                opacity: bodyExpanded ? 1 : 0,
                visibility: (expanded || immediate) && (!leaving || !exitCollapsed) ? "visible" : "hidden",
                pointerEvents: bodyExpanded ? "auto" : "none",
                transform: bodyExpanded ? "none" : `translateY(${bottom ? 8 : -8}px)`,
                clipPath: bodyExpanded ? "inset(0 0 0 0)" : bottom ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)",
                transition: reducedMotion ? "none" : `opacity ${bodyFadeMs}ms ${leaving ? motion.exitEasing : motion.easing}, transform ${leaving ? bodyExitMs : expandMs}ms ${leaving ? motion.exitEasing : motion.easing}, clip-path ${leaving ? bodyExitMs : expandMs}ms ${leaving ? motion.exitEasing : motion.easing}`,
                fontSize: "0.93em",
                lineHeight: 1.5,
                fontWeight: 400,
                textAlign: "center",
                color: css(pick(settings.textColor, settings.color)) ?? palette.muted,
                overflowWrap: "anywhere",
              }}>
                {settings.description}
                {closeButton}
                {progressBar}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
