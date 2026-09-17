import type { ComponentType, CSSProperties, ReactNode } from "react";

export type ToastVariant =
  | "default"
  | "success"
  | "error"
  | "info"
  | "warning"
  | "loading";

/** the nine shorthand spots on the screen. */
export type NamedPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * a distance from one or both screen edges, in any css unit:
 *
 *   "top-10vh"              10vh down from the top, centred horizontally
 *   "left-10vw"             10vw in from the left, centred vertically
 *   "bottom-24px right-5%"  both edges
 *   "top"                   the top edge at the default 16px inset
 *
 * an axis you do not mention ends up centred. `string & {}` keeps the named
 * positions in autocomplete while still accepting these.
 */
export type EdgeOffsetPosition = string & {};

/**
 * free placement: put the toast at any point on the screen.
 * x / y accept any css length ("62%", "120px", "30vh") or a plain number (px).
 * `anchor` decides which point of the toast lands on (x, y) and defaults to
 * "center", so { x: "50%", y: "50%" } is the dead centre of the screen.
 */
export interface FreePosition {
  x?: number | string;
  y?: number | string;
  anchor?: NamedPosition;
}

export type ToastPosition =
  | NamedPosition
  | EdgeOffsetPosition
  | FreePosition;

/**
 * an icon can be a rendered node (<FaCheck />, an <svg>, an emoji string) or a
 * component reference (FaCheck), which is called with { size, color }.
 */
export type ToastIcon = ReactNode | ComponentType<Record<string, unknown>>;

/** every timing knob of the enter/exit animation. all optional. */
export interface ToastMotion {
  /** enter duration in ms, default 520 */
  enter?: number;
  /** exit duration in ms, default 340 */
  exit?: number;
  /** enter easing, default cubic-bezier(0.16, 1, 0.3, 1) */
  easing?: string;
  /** exit easing, default cubic-bezier(0.4, 0, 0.2, 1) */
  exitEasing?: string;
  /** slide distance in px, default 22 */
  slide?: number;
  /** starting scale, default 0.94 */
  scale?: number;
  /** starting blur in px, default 2 */
  blur?: number;
  /** slide direction, default "auto" (derived from the position) */
  from?: "auto" | "top" | "bottom" | "left" | "right" | "none";
}

/** the third argument of every toast call. */
export interface ToastConfig {
  /** reuse an id to replace a toast in place instead of stacking a new one */
  id?: string | number;
  /** ms before auto dismiss; Infinity keeps it until dismissed. default 4000 */
  duration?: number;
  /** secondary line under the message */
  description?: ReactNode;
  /** overrides the built in variant icon; `false` removes it */
  icon?: ToastIcon;
  /** show the dismiss button, default true */
  closable?: boolean;
  /** show the countdown progress bar, default true */
  progress?: boolean;
  /** freeze the countdown while hovered or focused, default true */
  pauseOnHover?: boolean;
  /** fired once, when the toast starts leaving */
  onClose?: () => void;

  /**
   * anywhere on the screen: a named spot ("bottom-center"), an edge offset
   * ("top-10vh left-10vw") or a coordinate ({ x: "62%", y: "80%" })
   */
  position?: ToastPosition;
  /** px between stacked toasts, default 14 */
  gap?: number;
  /** stack direction, default derived from the position */
  stack?: "down" | "up";
  /** container z-index */
  zIndex?: number;

  /** text colour */
  textColor?: string;
  /** alias of textColor */
  color?: string;
  /** background: any colour, gradient or `url(...)` layer */
  bgColor?: string;
  /** alias of bgColor */
  background?: string;
  width?: number | string;
  height?: number | string;
  /** font family stack */
  font?: string;
  fontSize?: number | string;
  fontWeight?: number | string;
  /** corner radius, default 14 */
  radius?: number | string;
  /** inner spacing, default "13px 15px" */
  padding?: number | string;
  /** border shorthand */
  border?: string;
  /** box shadow */
  shadow?: string;
  /** progress bar colour, default the variant accent */
  progressColor?: string;
  /** built in icon colour, default the variant accent */
  iconColor?: string;
  /** base palette when no explicit colours are given, default "dark" */
  theme?: "dark" | "light";
  /** escape hatch: raw css merged over everything else */
  style?: CSSProperties;

  motion?: ToastMotion;
}

/** props of <Toaster />: defaults for every toast, plus a visible cap. */
export interface ToasterProps
  extends Omit<ToastConfig, "id" | "description" | "onClose"> {
  /** how many toasts to show per position at once; the rest queue up */
  max?: number;
}

export interface ToastRecord {
  id: string | number;
  message: ReactNode;
  variant: ToastVariant;
  config: ToastConfig;
  createdAt: number;
  leaving: boolean;
}

export interface PromiseMessages<T> {
  loading: ReactNode;
  success: ReactNode | ((value: T) => ReactNode);
  error: ReactNode | ((error: unknown) => ReactNode);
}
