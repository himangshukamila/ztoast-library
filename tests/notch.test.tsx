import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Toaster, toast } from "../src/index";
import type { ToastPosition } from "../src/index";
import { drop, getToasts } from "../src/store";

afterEach(() => {
  act(() => {
    for (const record of [...getToasts()]) drop(record.id);
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function card(): HTMLElement {
  const result = document.querySelector<HTMLElement>("[data-ztoast]");
  if (!result) throw new Error("no toast rendered");
  return result;
}

function body(): HTMLElement {
  const result = card().querySelector<HTMLElement>("[data-ztoast-body]");
  if (!result) throw new Error("no description panel rendered");
  return result;
}

function advance(ms: number): void {
  act(() => { vi.advanceTimersByTime(ms); });
}

function outlineBounds(): { left: number; right: number; top: number; bottom: number } {
  const path = card().querySelector("svg > path[stroke]")?.getAttribute("d");
  if (!path) throw new Error("no toast outline rendered");
  const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const x = values.filter((_, index) => index % 2 === 0);
  const y = values.filter((_, index) => index % 2 === 1);
  return { left: Math.min(...x), right: Math.max(...x), top: Math.min(...y), bottom: Math.max(...y) };
}

const positions: { position: ToastPosition; notch: "top" | "bottom" }[] = [
  { position: "bottom-left", notch: "bottom" },
  { position: "bottom-center", notch: "bottom" },
  { position: "bottom-right", notch: "bottom" },
  { position: "bottom-24px right-5%", notch: "bottom" },
  { position: { x: "40%", y: "20%", anchor: "bottom-left" }, notch: "bottom" },
  { position: { x: "40%", y: "80%" }, notch: "bottom" },
  { position: { x: "40%", y: "80%", anchor: "center-left" }, notch: "bottom" },
  { position: "top-center", notch: "top" },
  { position: "top-24px left-5%", notch: "top" },
  { position: { x: "40%", y: "80%", anchor: "top-left" }, notch: "top" },
  { position: { x: "40%", y: "20%" }, notch: "top" },
];

describe("notch orientation", () => {
  it.each(positions)("uses $notch for $position independently of stack and slide direction", ({ position, notch }) => {
    render(<Toaster />);

    act(() => {
      toast.success("saved", {
        description: "your changes are available",
        position,
        stack: notch === "bottom" ? "down" : "up",
        motion: { from: notch === "bottom" ? "top" : "bottom", enter: 0 },
        duration: Infinity,
      });
    });

    expect(card().getAttribute("data-ztoast-notch")).toBe(notch);
    expect(card().style.flexDirection).toBe(notch === "bottom" ? "column-reverse" : "column");
    expect(screen.getByText("saved").closest("[data-ztoast-heading]")).not.toBeNull();
    expect(body().textContent).toContain("your changes are available");
  });
});

describe("horizontal notch alignment", () => {
  const placements: { position: ToastPosition; align: "left" | "center" | "right"; notch: "top" | "bottom" }[] = [
    { position: "top-left", align: "left", notch: "top" },
    { position: "top-center", align: "center", notch: "top" },
    { position: "top-right", align: "right", notch: "top" },
    { position: "center-left", align: "left", notch: "top" },
    { position: "center", align: "center", notch: "top" },
    { position: "center-right", align: "right", notch: "top" },
    { position: "bottom-left", align: "left", notch: "bottom" },
    { position: "bottom-center", align: "center", notch: "bottom" },
    { position: "bottom-right", align: "right", notch: "bottom" },
    { position: "top-24px left-5%", align: "left", notch: "top" },
    { position: "bottom-24px right-5%", align: "right", notch: "bottom" },
    { position: { x: "20%", y: "20%" }, align: "left", notch: "top" },
    { position: { x: "50%", y: "20%" }, align: "center", notch: "top" },
    { position: { x: "80%", y: "80%" }, align: "right", notch: "bottom" },
    { position: { x: "80%", y: "20%", anchor: "top-left" }, align: "left", notch: "top" },
    { position: { x: "20%", y: "80%", anchor: "bottom-right" }, align: "right", notch: "bottom" },
  ];

  it.each(placements)("anchors the heading $align at $position independently of motion", ({ position, align, notch }) => {
    render(<Toaster />);
    act(() => {
      toast.success("aligned heading", {
        position,
        description: "the description expands from this edge",
        duration: Infinity,
        stack: notch === "bottom" ? "down" : "up",
        motion: { enter: 0, from: align === "left" ? "right" : "left" },
      });
    });

    expect(card().getAttribute("data-ztoast-notch-align")).toBe(align);
    expect(card().getAttribute("data-ztoast-notch")).toBe(notch);
    const heading = card().querySelector<HTMLElement>("[data-ztoast-heading]");
    expect(heading?.style.alignSelf).toBe({ left: "flex-start", center: "center", right: "flex-end" }[align]);
    expect(card().style.transformOrigin).toBe(`${align} ${notch}`);
    expect(outlineBounds()).toEqual({ left: 0, right: 360, top: 0, bottom: 120 });
  });

  it.each([
    { position: "top-left", left: 0, right: 240, top: 0, bottom: 50 },
    { position: "top-right", left: 120, right: 360, top: 0, bottom: 50 },
    { position: "bottom-left", left: 0, right: 240, top: 70, bottom: 120 },
    { position: "bottom-right", left: 120, right: 360, top: 70, bottom: 120 },
  ])("keeps $position pinned while the panel expands and folds back", ({ position, ...collapsed }) => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.success("corner motion", {
        id: "corner",
        position,
        description: "one continuous gradient while the panel unfolds",
        duration: Infinity,
        bgColor: "linear-gradient(135deg, rgb(30, 27, 75), rgb(49, 46, 129))",
        motion: { enter: 600, exit: 400, exitHold: 0 },
      });
    });
    advance(50);
    const surface = card().querySelector<HTMLElement>("[data-ztoast-surface]");
    const outline = card().querySelector("svg > path[stroke]");
    const gradient = surface?.style.background;
    expect(gradient).toContain("linear-gradient");
    expect(outlineBounds()).toEqual(collapsed);

    advance(240);
    // Sample beyond the gentle acceleration, while the panel is still
    // unfolding and has widened past the heading's original outer edge.
    advance(200);
    const entering = outlineBounds();
    if (position.endsWith("left")) {
      expect(entering.left).toBe(0);
      expect(entering.right).toBeGreaterThan(collapsed.right);
      expect(entering.right).toBeLessThan(360);
    } else {
      expect(entering.right).toBe(360);
      expect(entering.left).toBeLessThan(collapsed.left);
      expect(entering.left).toBeGreaterThan(0);
    }
    expect(surface?.style.clipPath).toBe(`path("${outline?.getAttribute("d")}")`);
    advance(500);
    expect(outlineBounds()).toEqual({ left: 0, right: 360, top: 0, bottom: 120 });
    // The heading's flat edge remains over its original corner even after
    // the description reaches the opposite edge of the card.
    const headingEdge = outline?.getAttribute("d")?.match(/-?\d+(?:\.\d+)?/g)?.slice(0, 4).map(Number);
    expect(headingEdge).toHaveLength(4);
    expect(Math.min(headingEdge![0], headingEdge![2])).toBe(collapsed.left + 20);
    expect(Math.max(headingEdge![0], headingEdge![2])).toBe(collapsed.right - 20);

    act(() => toast.dismiss("corner"));
    advance(100);
    const leaving = outlineBounds();
    if (position.endsWith("left")) {
      expect(leaving.left).toBe(0);
      expect(leaving.right).toBeGreaterThan(collapsed.right);
      expect(leaving.right).toBeLessThan(360);
    } else {
      expect(leaving.right).toBe(360);
      expect(leaving.left).toBeLessThan(collapsed.left);
      expect(leaving.left).toBeGreaterThan(0);
    }
    expect(surface?.style.clipPath).toBe(`path("${outline?.getAttribute("d")}")`);
    advance(180);
    expect(outlineBounds()).toEqual(collapsed);
    expect(surface?.style.background).toBe(gradient);
    expect(outline?.getAttribute("stroke-width")).toBe("1");
    advance(150);
    expect(screen.queryByText("corner motion")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("configurable notch timing", () => {
  it("gives the default notch time to arrive before a gradual panel expansion", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => toast.success("unhurried entry", {
      description: "the panel unfolds after the heading arrives",
      position: "top-left",
      duration: Infinity,
    }));

    advance(50);
    expect(card().style.opacity).toBe("1");
    expect(card().style.transition).toContain("transform 200ms");
    advance(199);
    expect(card().getAttribute("data-ztoast-expanded")).toBe("false");
    expect(outlineBounds().bottom).toBe(50);
    advance(1);
    expect(card().getAttribute("data-ztoast-expanded")).toBe("true");
    expect(body().style.transition).toContain("opacity 180ms");

    // After the heading finishes, the panel passes through intermediate
    // shapes rather than jumping straight to its fully expanded form.
    advance(100);
    expect(outlineBounds().bottom).toBeGreaterThan(50);
    expect(outlineBounds().bottom).toBeLessThan(120);
    const surface = card().querySelector<HTMLElement>("[data-ztoast-surface]");
    const path = card().querySelector("svg > path[stroke]")?.getAttribute("d");
    expect(surface?.style.clipPath).toBe(`path("${path}")`);
    advance(250);
    expect(outlineBounds()).toEqual({ left: 0, right: 360, top: 0, bottom: 120 });
    expect(card().style.willChange).toBe("");
  });

  it("scales the heading, reveal delay, and description fade with custom enter timing", () => {
    vi.useFakeTimers();
    render(<Toaster motion={{ enter: 1600 }} />);
    act(() => toast.info("custom slow entry", {
      description: "every part of the entrance respects the configured speed",
      duration: Infinity,
    }));

    advance(50);
    expect(card().style.transition).toContain("transform 640ms");
    advance(639);
    expect(card().getAttribute("data-ztoast-expanded")).toBe("false");
    advance(1);
    expect(card().getAttribute("data-ztoast-expanded")).toBe("true");
    expect(body().style.transition).toContain("opacity 576ms");
    expect(body().style.transition).toContain("transform 960ms");
    advance(1000);
    expect(card().style.willChange).toBe("");
  });

  it("finishes the fold and departure in 450ms when the exit hold is disabled", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => toast.info("unhurried exit", {
      id: "slow-exit",
      description: "the notch remains visible while the description folds",
      position: "bottom-right",
      duration: Infinity,
      motion: { enter: 0, exitHold: 0 },
    }));
    act(() => toast.dismiss("slow-exit"));

    advance(150);
    expect(card().style.opacity).toBe("1");
    expect(outlineBounds().top).toBeGreaterThan(0);
    expect(outlineBounds().top).toBeLessThan(70);
    advance(100);
    expect(card().style.opacity).toBe("0");
    expect(outlineBounds()).toEqual({ left: 120, right: 360, top: 70, bottom: 120 });
    advance(199);
    expect(screen.queryByText("unhurried exit")).not.toBeNull();
    advance(1);
    expect(screen.queryByText("unhurried exit")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("collapsed notch exit hold", () => {
  it("holds the collapsed pill for two seconds before its final departure", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toaster />);
    act(() => toast.info("held notch", {
      id: "held",
      description: "this description is hidden throughout the hold",
      position: "bottom-right",
      duration: Infinity,
      motion: { enter: 0 },
      onClose,
    }));
    act(() => toast.dismiss("held"));

    advance(240);
    expect(outlineBounds()).toEqual({ left: 120, right: 360, top: 70, bottom: 120 });
    expect(body().style.visibility).toBe("hidden");
    expect(card().style.opacity).toBe("1");
    expect(card().style.transform).toBe("none");
    expect(onClose).toHaveBeenCalledTimes(1);
    advance(1984);
    expect(card().style.opacity).toBe("1");
    expect(body().style.visibility).toBe("hidden");
    expect(outlineBounds()).toEqual({ left: 120, right: 360, top: 70, bottom: 120 });
    advance(1);
    expect(card().style.opacity).toBe("0");
    advance(224);
    expect(screen.queryByText("held notch")).not.toBeNull();
    advance(1);
    expect(screen.queryByText("held notch")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses a custom hold independently of the fold and fade duration", () => {
    vi.useFakeTimers();
    render(<Toaster motion={{ exitHold: 300 }} />);
    act(() => toast.info("custom held notch", {
      id: "custom-held",
      description: "a short hold configured on the toaster",
      position: "top-left",
      duration: Infinity,
      motion: { enter: 0, exit: 400 },
    }));
    act(() => toast.dismiss("custom-held"));

    advance(220);
    expect(outlineBounds()).toEqual({ left: 0, right: 240, top: 0, bottom: 50 });
    expect(body().style.visibility).toBe("hidden");
    expect(card().style.opacity).toBe("1");
    advance(279);
    expect(card().style.opacity).toBe("1");
    advance(1);
    expect(card().style.opacity).toBe("0");
    advance(199);
    expect(screen.queryByText("custom held notch")).not.toBeNull();
    advance(1);
    expect(screen.queryByText("custom held notch")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not hold a pill that has no description to fold", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => toast.success("pill only", {
      id: "pill-only",
      duration: Infinity,
      motion: { enter: 0, exitHold: 5000 },
    }));
    act(() => toast.dismiss("pill-only"));

    expect(card().style.opacity).toBe("0");
    advance(449);
    expect(screen.queryByText("pill only")).not.toBeNull();
    advance(1);
    expect(screen.queryByText("pill only")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["reduced motion", "zero exit"])("skips a configured hold for %s", (mode) => {
    vi.useFakeTimers();
    if (mode === "reduced motion") {
      vi.stubGlobal("matchMedia", vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })));
    }
    render(<Toaster />);
    act(() => toast.info("immediate close", {
      id: "immediate-close",
      description: "the hold must not delay an immediate dismissal",
      duration: Infinity,
      motion: { enter: 0, exit: mode === "zero exit" ? 0 : 450, exitHold: 5000 },
    }));
    act(() => toast.dismiss("immediate-close"));
    expect(card().style.transform).toBe("none");
    advance(10);

    expect(screen.queryByText("immediate close")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a pending hold when the same toast id is replaced", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => toast.info("old update", {
      id: "replace-held",
      description: "the original description",
      duration: Infinity,
      motion: { enter: 0 },
    }));
    act(() => toast.dismiss("replace-held"));
    advance(310);
    expect(card().style.opacity).toBe("1");
    expect(body().style.visibility).toBe("hidden");

    act(() => toast.success("new update", {
      id: "replace-held",
      description: "the replacement stays visible",
      duration: Infinity,
      motion: { enter: 0 },
    }));
    advance(3000);
    expect(screen.queryByText("old update")).toBeNull();
    expect(card().style.opacity).toBe("1");
    expect(body().style.visibility).toBe("visible");
    expect(getToasts()[0]?.leaving).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("smooth pill departure", () => {
  it.each([
    { position: "top-left", origin: "120px 25px" },
    { position: "top-center", origin: "180px 25px" },
    { position: "top-right", origin: "240px 25px" },
    { position: "bottom-left", origin: "120px 95px" },
    { position: "bottom-center", origin: "180px 95px" },
    { position: "bottom-right", origin: "240px 95px" },
  ])("closes both ends into the pill's own center at $position", ({ position, origin }) => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => toast.success("smooth departure", {
      id: "smooth-departure",
      description: "fold, hold, then fade together",
      position,
      duration: Infinity,
      motion: { enter: 0 },
    }));
    act(() => toast.dismiss("smooth-departure"));

    advance(240);
    expect(body().style.visibility).toBe("hidden");
    expect(card().style.opacity).toBe("1");
    expect(card().style.transform).toBe("none");
    advance(1984);
    expect(card().style.opacity).toBe("1");
    advance(1);

    const element = card();
    const row = element.closest<HTMLElement>("[data-ztoast-item]");
    const clipBox = element.parentElement?.parentElement;
    expect(element.style.opacity).toBe("0");
    expect(element.style.transform).toBe("scaleX(0) scaleY(0.8)");
    expect(element.style.transformOrigin).toBe(origin);
    expect(element.style.transition).toContain("opacity 225ms");
    expect(element.style.transition).toContain("transform 225ms");
    expect(element.style.transition).toContain("filter 225ms");
    expect(element.style.filter).toContain("drop-shadow");
    expect(clipBox?.style.overflow).toBe("visible");
    expect(row?.style.transition).toContain("grid-template-rows 225ms");
    expect(element.style.pointerEvents).toBe("none");

    // The final fade gets the full second half of the movement budget and
    // stays mounted until both opacity and stack motion have completed.
    advance(112);
    expect(screen.queryByText("smooth departure")).not.toBeNull();
    expect(element.style.filter).toContain("drop-shadow");
    advance(112);
    expect(screen.queryByText("smooth departure")).not.toBeNull();
    advance(1);
    expect(screen.queryByText("smooth departure")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("centers the final squeeze on the measured pill while preserving its entrance motion", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-ztoast") || this.hasAttribute("data-ztoast-heading") ? 200 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-ztoast") || this.hasAttribute("data-ztoast-heading") ? 52 : 0;
    });
    render(<Toaster />);
    act(() => toast.success("compact squeeze", {
      id: "compact-squeeze",
      position: "bottom-left",
      duration: Infinity,
      motion: { enter: 500, exit: 450, slide: 40, scale: 0.9 },
    }));

    expect(card().style.transform).toBe("translateY(40px) scale(0.9)");
    advance(50);
    advance(500);
    expect(card().style.transform).toBe("none");
    act(() => toast.dismiss("compact-squeeze"));
    expect(card().style.transform).toBe("scaleX(0) scaleY(0.8)");
    expect(card().style.transformOrigin).toBe("100px 26px");
    expect(card().style.transition).toContain("transform 450ms");
    advance(449);
    expect(screen.queryByText("compact squeeze")).not.toBeNull();
    advance(1);
    expect(screen.queryByText("compact squeeze")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps an explicitly configured plain fade free of the closing squeeze", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => toast.info("plain fade", {
      id: "plain-fade",
      description: "scale one opts out of the horizontal squeeze",
      duration: Infinity,
      motion: { enter: 0, exit: 400, exitHold: 0, slide: 0, blur: 0, scale: 1 },
    }));
    act(() => toast.dismiss("plain-fade"));
    advance(200);
    expect(card().style.opacity).toBe("0");
    expect(card().style.transform).toBe("none");
    expect(card().style.transition).toContain("opacity 200ms");
    advance(200);
    expect(screen.queryByText("plain fade")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("staged notch entrance", () => {
  it.each(["top-center", "bottom-center"])("shows the heading before expanding the description at %s", (position) => {
    vi.useFakeTimers();
    render(<Toaster />);

    act(() => {
      toast.success("saved", {
        description: "your changes are available",
        position,
        duration: Infinity,
        motion: { enter: 600 },
      });
    });

    expect(card().getAttribute("data-ztoast-expanded")).toBe("false");
    expect(body().style.opacity).toBe("0");
    expect(body().style.visibility).toBe("hidden");

    // Allow the two mounting frames to finish. The notch has entered while
    // the description is still collapsed, so this is a distinct first stage.
    advance(50);
    expect(card().style.opacity).toBe("1");
    expect(card().getAttribute("data-ztoast-expanded")).toBe("false");
    expect(body().style.opacity).toBe("0");
    const painted = card().querySelector<HTMLElement>("[data-ztoast-surface]");
    const outline = card().querySelector("svg > path[stroke]");
    const collapsedPath = painted?.style.clipPath;

    advance(240);
    expect(card().getAttribute("data-ztoast-expanded")).toBe("true");
    expect(body().style.opacity).toBe("1");
    expect(body().style.visibility).not.toBe("hidden");
    expect(screen.getByRole("status").textContent).toContain("saved");
    expect(screen.getByRole("status").textContent).toContain("your changes are available");

    // The surface must pass through intermediate shapes, not jump straight
    // from a capsule to the panel. Its border follows the same path each frame.
    advance(100);
    const firstPath = painted?.style.clipPath;
    expect(firstPath).not.toBe(collapsedPath);
    expect(firstPath).toBe(`path("${outline?.getAttribute("d")}")`);
    advance(100);
    expect(painted?.style.clipPath).not.toBe(firstPath);
    expect(painted?.style.clipPath).toBe(`path("${outline?.getAttribute("d")}")`);
    advance(400);
    expect(card().style.willChange).toBe("");
  });

  it.each(["reduced motion", "zero duration"])("shows the full panel immediately with %s", (mode) => {
    vi.useFakeTimers();
    if (mode === "reduced motion") {
      vi.stubGlobal("matchMedia", vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })));
    }
    render(<Toaster />);

    act(() => {
      toast.info("ready", {
        description: "no animation delay",
        duration: Infinity,
        motion: { enter: mode === "zero duration" ? 0 : 600 },
      });
    });

    expect(card().getAttribute("data-ztoast-expanded")).toBe("true");
    expect(body().style.opacity).toBe("1");
    expect(body().style.visibility).not.toBe("hidden");
    expect(card().style.transform).toBe("none");
  });

  it("cancels a pending expansion when dismissed during the notch stage", () => {
    vi.useFakeTimers();
    render(<Toaster />);

    act(() => {
      toast.success("dismiss early", {
        id: "early",
        description: "must not expand after dismissal",
        duration: Infinity,
        motion: { enter: 600, exit: 300 },
      });
    });
    advance(50);
    expect(card().getAttribute("data-ztoast-expanded")).toBe("false");

    act(() => toast.dismiss("early"));
    advance(150);
    expect(card().getAttribute("data-ztoast-expanded")).toBe("false");
    expect(body().style.opacity).toBe("0");

    advance(250);
    expect(screen.queryByText("dismiss early")).toBeNull();
    expect(getToasts()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("contracts the description before the notch leaves", () => {
    vi.useFakeTimers();
    render(<Toaster />);

    act(() => {
      toast.info("dismiss expanded", {
        id: "expanded",
        description: "the body folds back into the notch",
        duration: Infinity,
        motion: { enter: 600, exit: 400, exitHold: 0 },
      });
    });
    advance(50);
    advance(240);
    advance(600);

    act(() => toast.dismiss("expanded"));
    expect(card().getAttribute("data-ztoast-expanded")).toBe("false");
    expect(body().style.opacity).toBe("0");
    expect(card().style.opacity).toBe("1");
    advance(100);
    expect(card().style.opacity).toBe("1");

    advance(400);
    expect(screen.queryByText("dismiss expanded")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reverses an expansion in progress without snapping to the full panel", () => {
    vi.useFakeTimers();
    render(<Toaster />);

    act(() => {
      toast.info("reverse midway", {
        id: "midway",
        description: "continue smoothly from the current shape",
        duration: Infinity,
        motion: { enter: 600, exit: 400, exitHold: 0 },
      });
    });
    advance(50);
    advance(240);
    advance(100);
    const painted = card().querySelector<HTMLElement>("[data-ztoast-surface]");
    const partialPath = painted?.style.clipPath;

    act(() => toast.dismiss("midway"));
    expect(card().getAttribute("data-ztoast-expanded")).toBe("false");
    expect(painted?.style.clipPath).toBe(partialPath);
    advance(100);
    expect(painted?.style.clipPath).not.toBe(partialPath);

    advance(400);
    expect(screen.queryByText("reverse midway")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases animation frames and timers when unmounted during expansion", () => {
    vi.useFakeTimers();
    const { unmount } = render(<Toaster />);

    act(() => {
      toast.success("unmount during entry", {
        description: "pending animation work is cancelled",
        duration: Infinity,
        motion: { enter: 600 },
      });
    });
    advance(50);
    advance(240);
    unmount();

    expect(vi.getTimerCount()).toBe(0);
    advance(1000);
    expect(document.querySelector("[data-ztoast]")).toBeNull();
  });
});

describe("notch surface styling", () => {
  it.each([
    { theme: "light", variant: "success", color: "rgb(4, 120, 87)" },
    { theme: "light", variant: "error", color: "rgb(190, 18, 60)" },
    { theme: "light", variant: "info", color: "rgb(29, 78, 216)" },
    { theme: "light", variant: "warning", color: "rgb(161, 98, 7)" },
    { theme: "dark", variant: "success", color: "rgb(52, 211, 153)" },
    { theme: "dark", variant: "error", color: "rgb(251, 113, 133)" },
    { theme: "dark", variant: "info", color: "rgb(96, 165, 250)" },
    { theme: "dark", variant: "warning", color: "rgb(251, 191, 36)" },
  ] as const)("preserves the gradient and thin $variant border in $theme mode", ({ theme, variant, color }) => {
    render(<Toaster theme={theme} />);

    act(() => {
      toast[variant]("custom surface", {
        description: "one continuous background",
        position: "bottom-center",
        duration: Infinity,
        motion: { enter: 0 },
        bgColor: "linear-gradient(135deg, rgb(30, 27, 75), rgb(49, 46, 129))",
      });
    });

    const surface = card().querySelector<HTMLElement>("[data-ztoast-surface]");
    const outline = card().querySelector("svg > path[stroke]");
    expect(surface?.style.background).toContain("linear-gradient");
    expect(outline?.getAttribute("stroke")).toBe(color);
    expect(outline?.getAttribute("stroke-width")).toBe("1");
  });
});
