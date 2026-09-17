import type { CSSProperties } from "react";
import { css, len } from "./css";
import { devWarn } from "./store";
import type {
  FreePosition,
  NamedPosition,
  ToastConfig,
  ToastPosition,
} from "./types";

// turns a position into the fixed container a toast stack is rendered into,
// plus the direction new toasts stack in and the edge the enter animation
// slides in from. a position can be written three ways:
//
//   "top-right"                  one of the nine named spots
//   "top-10vh left-10vw"         an offset from one or both edges
//   { x: "62%", y: "80%" }       a free coordinate, anchored however you like

/** inset used for an edge that was named without a distance */
const EDGE = 16;
const DEFAULT_Z_INDEX = 2147483000;
export const DEFAULT_GAP = 14;

export type StackDirection = "down" | "up";
export type SlideFrom = "top" | "bottom" | "left" | "right" | "none";

export interface Placement {
  /** groups toasts that share one container; anything in the style is in here */
  key: string;
  style: CSSProperties;
  direction: StackDirection;
  from: SlideFrom;
}

type Vertical = "top" | "center" | "bottom";
type Horizontal = "left" | "center" | "right";

const NAMED_POSITIONS = new Set<string>([
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

const EDGE_KEYWORDS = new Set(["top", "bottom", "left", "right", "center"]);

// every css length unit, plus calc(). the shape has to be checked here - not
// just guarded like other css values - because it is what tells "top-10vh"
// (an offset) apart from "top-left" (a named spot).
const LENGTH_PATTERN =
  /^-?[0-9]*\.?[0-9]+(px|%|em|rem|ex|ch|vh|vw|vmin|vmax|dvh|dvw|svh|svw|lvh|lvw|cm|mm|in|pt|pc|q)$/i;
const BARE_NUMBER_PATTERN = /^-?[0-9]*\.?[0-9]+$/;

/** the geometry a position resolves to, before it becomes a style object */
interface Geometry {
  vertical: Vertical;
  horizontal: Horizontal;
  top?: number | string;
  bottom?: number | string;
  left?: number | string;
  right?: number | string;
  shiftX: string;
  shiftY: string;
  /** the raw y coordinate, only used to guess a slide direction */
  y?: number | string;
}

interface EdgeOffsets {
  vertical?: { edge: "top" | "bottom"; value: number | string };
  horizontal?: { edge: "left" | "right"; value: number | string };
}

function isFree(position: ToastPosition): position is FreePosition {
  return typeof position === "object" && position !== null;
}

function axes(position: NamedPosition): [Vertical, Horizontal] {
  if (position === "center") return ["center", "center"];
  const [vertical, horizontal] = position.split("-");
  return [vertical as Vertical, horizontal as Horizontal];
}

function percent(value: number | string | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(-?[0-9.]+)%$/.exec(value.trim());
  if (!match) return undefined;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// splits on whitespace, but not inside parentheses, so a calc() expression
// survives as a single token
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of input) {
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(depth - 1, 0);
    if (/\s/.test(char) && depth === 0) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

/** a distance in any css unit; a bare number is read as pixels */
function distance(raw: string): number | string | undefined {
  const value = css(raw);
  if (value === undefined) return undefined;
  if (BARE_NUMBER_PATTERN.test(value)) return Number.parseFloat(value);
  if (LENGTH_PATTERN.test(value)) return value;
  if (/^calc\(.+\)$/i.test(value)) return value;
  return undefined;
}

/**
 * parses "top-10vh", "left-10vw", "bottom-24px right-5%", "top", "bottom left".
 * returns undefined when the string is not an edge offset at all, so the caller
 * can fall back. an axis that is not mentioned ends up centred.
 */
function parseEdgeOffsets(input: string): EdgeOffsets | undefined {
  const tokens = tokenize(input.trim().toLowerCase());
  if (tokens.length === 0 || tokens.length > 2) return undefined;

  const offsets: EdgeOffsets = {};
  for (const token of tokens) {
    const split = token.indexOf("-");
    const edge = split === -1 ? token : token.slice(0, split);
    const rest = split === -1 ? undefined : token.slice(split + 1);

    if (!EDGE_KEYWORDS.has(edge)) return undefined;
    // "top-left" and friends are named spots, not offsets
    if (rest !== undefined && EDGE_KEYWORDS.has(rest)) return undefined;

    // a bare "center" leaves its axis alone, which is already the default
    if (edge === "center") {
      if (rest !== undefined) return undefined;
      continue;
    }

    const value = rest === undefined ? EDGE : distance(rest);
    if (value === undefined) return undefined;

    if (edge === "top" || edge === "bottom") {
      if (offsets.vertical) return undefined;
      offsets.vertical = { edge, value };
    } else if (edge === "left" || edge === "right") {
      if (offsets.horizontal) return undefined;
      offsets.horizontal = { edge, value };
    } else {
      return undefined;
    }
  }

  return offsets;
}

function fromNamed(position: NamedPosition): Geometry {
  const [vertical, horizontal] = axes(position);
  const geometry: Geometry = {
    vertical,
    horizontal,
    shiftX: "0",
    shiftY: "0",
  };

  if (vertical === "top") geometry.top = EDGE;
  else if (vertical === "bottom") geometry.bottom = EDGE;
  else {
    geometry.top = "50%";
    geometry.shiftY = "-50%";
  }

  if (horizontal === "left") geometry.left = EDGE;
  else if (horizontal === "right") geometry.right = EDGE;
  else {
    geometry.left = "50%";
    geometry.shiftX = "-50%";
  }

  return geometry;
}

function fromEdgeOffsets(offsets: EdgeOffsets): Geometry {
  const geometry: Geometry = {
    vertical: offsets.vertical?.edge ?? "center",
    horizontal: offsets.horizontal?.edge ?? "center",
    shiftX: "0",
    shiftY: "0",
  };

  // the toast's own edge sits that far from the screen edge, so no shift
  if (offsets.vertical?.edge === "top") geometry.top = offsets.vertical.value;
  else if (offsets.vertical?.edge === "bottom") {
    geometry.bottom = offsets.vertical.value;
  } else {
    geometry.top = "50%";
    geometry.shiftY = "-50%";
  }

  if (offsets.horizontal?.edge === "left") {
    geometry.left = offsets.horizontal.value;
  } else if (offsets.horizontal?.edge === "right") {
    geometry.right = offsets.horizontal.value;
  } else {
    geometry.left = "50%";
    geometry.shiftX = "-50%";
  }

  return geometry;
}

function fromFree(position: FreePosition): Geometry {
  const anchor =
    typeof position.anchor === "string" && NAMED_POSITIONS.has(position.anchor)
      ? position.anchor
      : "center";
  const [vertical, horizontal] = axes(anchor);
  const y = len(position.y) ?? "50%";

  return {
    vertical,
    horizontal,
    left: len(position.x) ?? "50%",
    top: y,
    y,
    // the shift is what moves the container from the coordinate onto its anchor
    shiftX:
      horizontal === "center" ? "-50%" : horizontal === "right" ? "-100%" : "0",
    shiftY:
      vertical === "center" ? "-50%" : vertical === "bottom" ? "-100%" : "0",
  };
}

function resolveGeometry(position: ToastPosition): Geometry {
  if (isFree(position)) return fromFree(position);

  if (typeof position === "string") {
    if (NAMED_POSITIONS.has(position)) {
      return fromNamed(position as NamedPosition);
    }
    const offsets = parseEdgeOffsets(position);
    if (offsets) return fromEdgeOffsets(offsets);
    devWarn(
      `position "${position}" was not understood, falling back to top-right. ` +
        `use a named spot ("top-center"), an edge offset ("top-10vh left-10vw") ` +
        `or a coordinate ({ x: "62%", y: "80%" }).`
    );
  }

  return fromNamed("top-right");
}

// which edge the card slides in from. "auto" follows the position, so a toast
// always travels inwards from the nearest screen edge.
function resolveFrom(
  requested: SlideFrom | "auto" | undefined,
  geometry: Geometry
): SlideFrom {
  if (requested && requested !== "auto") return requested;
  if (geometry.vertical === "top") return "top";
  if (geometry.vertical === "bottom") return "bottom";
  if (geometry.horizontal === "left") return "left";
  if (geometry.horizontal === "right") return "right";

  // centred on both axes with no edge to lean on: a percentage y still says
  // which half of the screen the toast sits in
  const ratio = percent(geometry.y);
  if (ratio !== undefined) return ratio >= 50 ? "bottom" : "top";
  return "none";
}

export function resolvePlacement(settings: ToastConfig): Placement {
  const geometry = resolveGeometry(settings.position ?? "top-right");

  const style: CSSProperties = {
    position: "fixed",
    display: "flex",
    // the container never eats clicks; only the cards inside it do
    pointerEvents: "none",
    zIndex: settings.zIndex ?? DEFAULT_Z_INDEX,
    top: geometry.top,
    bottom: geometry.bottom,
    left: geometry.left,
    right: geometry.right,
    alignItems:
      geometry.horizontal === "left"
        ? "flex-start"
        : geometry.horizontal === "right"
          ? "flex-end"
          : "center",
  };

  if (geometry.shiftX !== "0" || geometry.shiftY !== "0") {
    style.transform = `translate(${geometry.shiftX}, ${geometry.shiftY})`;
  }

  const direction: StackDirection =
    settings.stack ?? (geometry.vertical === "bottom" ? "up" : "down");
  // stacking away from the anchor means nothing already on screen has to move
  style.flexDirection = direction === "up" ? "column-reverse" : "column";

  // the key covers every value that shapes the container, and nothing that is
  // per card - two toasts at the same spot must share one stack
  const key = [
    style.top,
    style.bottom,
    style.left,
    style.right,
    style.transform,
    style.alignItems,
    style.flexDirection,
    style.zIndex,
  ].join("|");

  return { key, style, direction, from: resolveFrom(settings.motion?.from, geometry) };
}
