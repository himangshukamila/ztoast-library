import { useCallback, useEffect, useRef, useState } from "react";
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
  border: string;
  shadow: string;
  track: string;
}

const THEMES: Record<"dark" | "light", Palette> = {
  dark: {
    bg: "#17171a",
    text: "#fafafa",
    muted: "#a1a1aa",
    border: "1px solid rgba(255, 255, 255, 0.09)",
    shadow:
      "0 18px 40px -12px rgba(0, 0, 0, 0.55), 0 4px 14px -6px rgba(0, 0, 0, 0.45)",
    track: "rgba(255, 255, 255, 0.1)",
  },
  light: {
    bg: "#ffffff",
    text: "#18181b",
    muted: "#71717a",
    border: "1px solid rgba(9, 9, 11, 0.08)",
    shadow:
      "0 18px 40px -12px rgba(9, 9, 11, 0.18), 0 4px 14px -6px rgba(9, 9, 11, 0.1)",
    track: "rgba(9, 9, 11, 0.08)",
  },
};

const ACCENTS: Record<ToastVariant, string> = {
  default: "#a1a1aa",
  success: "#34d399",
  error: "#fb7185",
  info: "#60a5fa",
  warning: "#fbbf24",
  loading: "#a1a1aa",
};

interface ResolvedMotion {
  enter: number;
  exit: number;
  easing: string;
  exitEasing: string;
  slide: number;
  scale: number;
  blur: number;
}

const MOTION_DEFAULTS: ResolvedMotion = {
  enter: 520,
  exit: 340,
  // a long, decelerating ease: the toast never appears to "pop" into place
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  exitEasing: "cubic-bezier(0.4, 0, 0.2, 1)",
  slide: 22,
  scale: 0.94,
  blur: 2,
};

// the height collapse trails the fade out slightly, so the toast dissolves
// first and the gap it leaves behind closes after it
const COLLAPSE_DELAY_RATIO = 0.35;

// how long the stack takes to open up a slot on enter, independent of the
// card's own motion. the card does not wait for it - it is already in place -
// so this only governs how quickly the toasts around it make room.
const ROW_MS = 260;

let reducedMotion: boolean | null = null;

function prefersReducedMotion(): boolean {
  if (reducedMotion !== null) return reducedMotion;
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    reducedMotion = false;
    return reducedMotion;
  }
  try {
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
  } catch {
    reducedMotion = false;
  }
  return reducedMotion;
}

function ms(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function resolveMotion(motion: ToastMotion | undefined): ResolvedMotion {
  const resolved: ResolvedMotion = {
    enter: ms(motion?.enter, MOTION_DEFAULTS.enter),
    exit: ms(motion?.exit, MOTION_DEFAULTS.exit),
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
  if (prefersReducedMotion()) {
    return { ...resolved, enter: 1, exit: 1, slide: 0, scale: 1, blur: 0 };
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

  const motion = resolveMotion(settings.motion);
  const duration = normalizeDuration(settings.duration);
  const timed = Number.isFinite(duration) && duration > 0;
  const showProgress = settings.progress !== false && timed;
  const pauseEnabled = settings.pauseOnHover !== false && timed;

  const [entered, setEntered] = useState(false);
  const [settled, setSettled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(duration);
  const [progress, setProgress] = useState(0);
  const [closeHovered, setCloseHovered] = useState(false);

  const startedAt = useRef(Date.now());
  // mirrors the state for the event handlers, which must not read stale values
  // and must never subtract the same elapsed slice twice
  const pausedRef = useRef(false);
  const enteredRef = useRef(false);

  const visible = entered && !leaving;
  const running = entered && !paused && !leaving;

  const phaseMs = visible ? motion.enter : motion.exit;
  const phaseEase = visible ? motion.easing : motion.exitEasing;
  const collapseDelay = leaving
    ? Math.round(motion.exit * COLLAPSE_DELAY_RATIO)
    : 0;

  // the stack opens its slot faster than the card eases in. the exit is
  // unchanged: there the row and the card move together.
  const rowMs = visible ? Math.min(motion.enter, ROW_MS) : phaseMs;

  // flip to the visible style one painted frame after mount, so the browser has
  // an initial state to transition away from. two frames, because a single one
  // is occasionally coalesced with the mounting paint.
  useEffect(() => {
    if (typeof requestAnimationFrame !== "function") {
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
  }, []);

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
    holdExit(id, motion.exit + collapseDelay);
  }, [leaving, id, motion.exit, collapseDelay]);

  // a toast can be replaced in place (same id - toast.promise going from
  // loading to success). react keeps this component instance, so the countdown
  // has to be reset explicitly, or the replacement inherits the old remaining
  // time and, if that was Infinity, never dismisses.
  useEffect(() => {
    startedAt.current = Date.now();
    pausedRef.current = false;
    setPaused(false);
    setRemaining(duration);
    setProgress(0);
  }, [duration, createdAt]);

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

  const palette = THEMES[settings.theme === "light" ? "light" : "dark"];
  const accent = ACCENTS[variant] ?? ACCENTS.default;
  const gap =
    typeof settings.gap === "number" && settings.gap >= 0
      ? settings.gap
      : DEFAULT_GAP;

  const width = len(settings.width);

  // only the exit needs masking. on the way in the card already sits at its
  // final spot and simply overflows the row that is still growing behind it,
  // into the empty space the stack is about to occupy - so nothing has to clip,
  // and the card carries its shadow from the very first frame.
  //
  // this matters because a clip box sized to the card slices the shadow off
  // square on three sides: the default shadow reaches 8px past the left and
  // right edges and 26px past the bottom one.
  const clipped = leaving;

  const cardTransition = [
    `transform ${phaseMs}ms ${phaseEase}`,
    `opacity ${Math.round(phaseMs * 0.75)}ms ${phaseEase}`,
    `filter ${phaseMs}ms ${phaseEase}`,
    // the shadow only starts fading once the clip lifts, so its length follows
    // the row rather than the card
    `box-shadow ${Math.round(rowMs * 0.45)}ms ${phaseEase}`,
  ].join(", ");

  const cardStyle: CSSProperties = {
    position: "relative",
    boxSizing: "border-box",
    display: "flex",
    alignItems: settings.description != null ? "flex-start" : "center",
    gap: 12,
    // an explicit width replaces the default range outright: css max-width
    // wins over width regardless of order, so leaving the clamp in place would
    // silently cap anything wider than 440px
    minWidth: width ?? 240,
    maxWidth: width ?? "min(92vw, 440px)",
    width,
    height: len(settings.height),
    padding: len(settings.padding) ?? "13px 15px",
    background: css(pick(settings.bgColor, settings.background)) ?? palette.bg,
    color: css(pick(settings.textColor, settings.color)) ?? palette.text,
    fontFamily: css(settings.font) ?? SYSTEM_FONT,
    fontSize: len(settings.fontSize) ?? 14,
    lineHeight: 1.45,
    textAlign: "left",
    borderRadius: len(settings.radius) ?? 14,
    border: css(settings.border) ?? palette.border,
    boxShadow: clipped ? "none" : (css(settings.shadow) ?? palette.shadow),
    // keeps the progress bar inside the rounded corners
    overflow: "hidden",
    pointerEvents: "auto",
    opacity: visible ? 1 : 0,
    transform: visible
      ? "none"
      : hiddenTransform(placement.from, motion.slide, motion.scale),
    filter: visible
      ? settled
        ? undefined
        : "blur(0px)"
      : motion.blur > 0
        ? `blur(${motion.blur}px)`
        : undefined,
    transition: cardTransition,
    willChange: settled && !leaving ? undefined : "transform, opacity, filter",
    ...settings.style,
  };

  return (
    <div
      data-ztoast-item=""
      style={{
        display: "grid",
        // 0fr -> 1fr animates the row height without ever measuring the dom,
        // which is what makes the stack settle smoothly when one toast leaves
        gridTemplateRows: visible ? "1fr" : "0fr",
        transition: `grid-template-rows ${rowMs}ms ${phaseEase} ${collapseDelay}ms`,
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
          overflow: clipped ? "hidden" : "visible",
        }}
      >
        {/* the gap between toasts lives inside the collapsing box, so it
            disappears together with the toast instead of leaving a hole */}
        <div style={{ paddingTop: gap / 2, paddingBottom: gap / 2 }}>
          <div
            data-ztoast=""
            data-variant={variant}
            role={variant === "error" ? "alert" : "status"}
            aria-live={variant === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            style={cardStyle}
            onMouseEnter={pause}
            onMouseLeave={resume}
            // keyboard users never fire mouse events: focusing the dismiss
            // button has to pause too, or the toast vanishes mid tab
            onFocus={pause}
            onBlur={resume}
          >
            {renderIcon(settings.icon, variant, css(settings.iconColor) ?? accent)}

            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <div
                style={{
                  fontWeight: settings.fontWeight ?? 600,
                  wordBreak: "break-word",
                }}
              >
                {record.message}
              </div>
              {settings.description != null && (
                <div
                  style={{
                    fontSize: "0.92em",
                    fontWeight: 400,
                    color: palette.muted,
                    wordBreak: "break-word",
                  }}
                >
                  {settings.description}
                </div>
              )}
            </div>

            {settings.closable !== false && (
              <button
                type="button"
                onClick={() => dismiss(id)}
                onMouseEnter={() => setCloseHovered(true)}
                onMouseLeave={() => setCloseHovered(false)}
                aria-label="Dismiss notification"
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: "none",
                  margin: 0,
                  padding: 2,
                  borderRadius: 6,
                  color: "inherit",
                  opacity: closeHovered ? 1 : 0.55,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                  lineHeight: 0,
                  transition: "opacity 180ms ease",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}

            {showProgress && (
              <div
                data-ztoast-progress=""
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 3,
                  background: palette.track,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: "100%",
                    background: css(settings.progressColor) ?? accent,
                    transformOrigin: "left center",
                    transform: `scaleX(${progress})`,
                    transition: running
                      ? `transform ${Math.max(remaining, 0)}ms linear`
                      : "none",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
