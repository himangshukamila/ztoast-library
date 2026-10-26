import { useState } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Toaster, toast } from "../src/index";
import { drop, getToasts } from "../src/store";

afterEach(() => {
  act(() => {
    for (const record of [...getToasts()]) drop(record.id);
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function card(title: string): HTMLElement {
  const element = screen.getByText(title).closest<HTMLElement>("[data-ztoast]");
  if (!element) throw new Error(`no toast for ${title}`);
  return element;
}

function outline(element: HTMLElement): SVGPathElement {
  const path = element.querySelector<SVGPathElement>("svg > path[stroke]");
  if (!path) throw new Error("no toast outline rendered");
  return path;
}

function mockLayout(width: number, height: () => number, headingHeight = 52): void {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-ztoast")) return width;
    return this.hasAttribute("data-ztoast-heading") ? Math.min(width, 220) : 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-ztoast")) return height();
    return this.hasAttribute("data-ztoast-heading") ? headingHeight : 0;
  });
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudoElement) => {
    const style = computedStyle(element, pseudoElement);
    // jsdom does not expand border-radius into its computed corner longhands.
    // Supply the browser's computed radius alongside the simulated layout.
    if (element instanceof HTMLElement && element.hasAttribute("data-ztoast")) {
      Object.defineProperty(style, "borderTopLeftRadius", { value: element.style.borderRadius });
    }
    return style;
  });
}

describe("title-only pills", () => {
  it("fits the heading and rounds both ends to half the measured height", () => {
    mockLayout(200, () => 52);
    render(<Toaster />);
    act(() => toast.success("Saved", { duration: Infinity, motion: { enter: 0 } }));

    const element = card("Saved");
    expect(element.querySelector("[data-ztoast-body]")).toBeNull();
    expect(element.style.width).toBe("fit-content");
    expect(element.style.minWidth).not.toContain("240px");
    const path = outline(element).getAttribute("d");
    expect(path).toContain("M26 0 H174 Q200 0 200 26");
    expect(path).toContain("Q200 52 174 52 H26 Q0 52 0 26");
    expect(element.querySelector<HTMLElement>("[data-ztoast-surface]")?.style.clipPath).toBe(`path("${path}")`);
    expect(screen.queryByLabelText("Dismiss notification")).toBeNull();
  });

  const emptyDescriptions: { label: string; description: ReactNode }[] = [
    { label: "undefined", description: undefined },
    { label: "null", description: null },
    { label: "false", description: false },
    { label: "true", description: true },
    { label: "empty string", description: "" },
    { label: "empty array", description: [] },
    { label: "array of empty children", description: [null, undefined, false, ""] },
  ];

  it.each(emptyDescriptions)("does not reserve a description panel for $label", ({ description }) => {
    render(<Toaster />);
    act(() => toast.info("Pill", { description, duration: Infinity }));

    expect(card("Pill").querySelector("[data-ztoast-body]")).toBeNull();
    expect(card("Pill").style.width).toBe("fit-content");
  });

  it("keeps zero as visible description content", () => {
    render(<Toaster />);
    act(() => toast.info("Unread", { description: 0, duration: Infinity, motion: { enter: 0 } }));

    expect(card("Unread").querySelector("[data-ztoast-body]")?.textContent).toBe("0");
    expect(card("Unread").style.width).toBe("fit-content");
  });

  it("accepts JSX, component, and emoji icons inside the pill", () => {
    function TeamIcon() { return <span data-testid="component-icon">T</span>; }
    render(<Toaster />);
    act(() => {
      toast.success("JSX icon", <span data-testid="jsx-icon">S</span>, { duration: Infinity });
      toast.info("Component icon", TeamIcon, { duration: Infinity });
      toast.show("Emoji icon", "🎉", { duration: Infinity });
    });

    for (const [title, icon] of [
      ["JSX icon", screen.getByTestId("jsx-icon")],
      ["Component icon", screen.getByTestId("component-icon")],
      ["Emoji icon", screen.getByText("🎉")],
    ] as const) {
      const element = card(title);
      expect(element.querySelector("[data-ztoast-body]")).toBeNull();
      expect(element.querySelector("[data-ztoast-heading]")?.contains(icon)).toBe(true);
      expect(element.querySelectorAll("[data-ztoast-icon]")).toHaveLength(1);
    }
  });

  it("preserves inherited and per-toast width and radius controls", () => {
    mockLayout(280, () => 52);
    render(<Toaster width={280} radius={12} />);
    act(() => {
      toast.show("Inherited", { duration: Infinity, motion: { enter: 0 } });
      toast.show("Configured", { duration: Infinity, width: 320, radius: 8, motion: { enter: 0 } });
      toast.show("Inline radius", { duration: Infinity, style: { borderRadius: 6 }, motion: { enter: 0 } });
    });

    expect(card("Inherited").style.width).toBe("280px");
    expect(outline(card("Inherited")).getAttribute("d")).toMatch(/^M12 0 /);
    expect(card("Configured").style.width).toBe("320px");
    expect(outline(card("Configured")).getAttribute("d")).toMatch(/^M8 0 /);
    expect(card("Inline radius").style.borderRadius).toBe("6px");
    expect(outline(card("Inline radius")).getAttribute("d")).toMatch(/^M6 0 /);
  });
});

describe("compact description spacing", () => {
  it.each([
    { position: "top-left", closable: false, top: "8px", right: "12px", bottom: "14px" },
    { position: "bottom-right", closable: false, top: "14px", right: "12px", bottom: "8px" },
    { position: "top-right", closable: true, top: "8px", right: "44px", bottom: "14px" },
    { position: "bottom-left", closable: true, top: "14px", right: "44px", bottom: "8px" },
  ])("reserves dismiss-button space only when enabled at $position ($closable)", ({ position, closable, top, right, bottom }) => {
    render(<Toaster closable={closable} />);
    act(() => toast.info("Compact details", {
      description: "A short description without a wide empty inset.",
      position,
      duration: Infinity,
      motion: { enter: 0 },
    }));

    const element = card("Compact details");
    const panel = element.querySelector<HTMLElement>("[data-ztoast-body]");
    expect(panel?.style.paddingTop).toBe(top);
    expect(panel?.style.paddingRight).toBe(right);
    expect(panel?.style.paddingBottom).toBe(bottom);
    expect(panel?.style.paddingLeft).toBe("12px");
    expect(panel?.style.textAlign).toBe("center");
    expect(panel?.style.lineHeight).toBe("1.5");
    expect(element.style.width).toBe("fit-content");
    expect(element.style.minWidth).toBe("");
    expect(Boolean(screen.queryByLabelText("Dismiss notification"))).toBe(closable);
  });

  it.each(["padding", "style.padding"])("preserves an explicit %s override even with a dismiss button", (source) => {
    render(<Toaster closable />);
    act(() => toast.info("Custom spacing", {
      description: "Application-defined spacing still takes precedence.",
      position: "bottom-right",
      padding: source === "padding" ? "7px 13px" : "20px",
      style: source === "style.padding" ? { padding: "7px 13px" } : undefined,
      duration: Infinity,
      motion: { enter: 0 },
    }));

    for (const section of card("Custom spacing").querySelectorAll<HTMLElement>("[data-ztoast-heading], [data-ztoast-body]")) {
      expect(section.style.padding).toBe("7px 13px");
    }
    expect(screen.getByLabelText("Dismiss notification")).toBeTruthy();
  });
});

describe("React description content", () => {
  it("renders images and a stateful component without replacing its controls or custom icon", () => {
    function TeamUpdate() {
      const [joined, setJoined] = useState(3);
      return (
        <div>
          <div>
            {["Ada", "Lin", "Sam"].map((name) => <img key={name} src={`/memojis/${name}.png`} alt={name} width={28} height={28} />)}
          </div>
          <span>{joined} new members joined the project.</span>
          <button type="button" onClick={() => setJoined((count) => count + 1)}>Add a member</button>
        </div>
      );
    }
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toaster />);
    act(() => toast.info("Team update", {
      icon: <span data-testid="team-icon">T</span>,
      description: <TeamUpdate />,
      closable: true,
      duration: Infinity,
      onClose,
      motion: { enter: 0, exit: 0 },
    }));

    const element = card("Team update");
    const panel = element.querySelector("[data-ztoast-body]");
    const images = screen.getAllByRole("img");
    expect(images.map((image) => image.getAttribute("alt"))).toEqual(["Ada", "Lin", "Sam"]);
    expect(images.every((image) => panel?.contains(image))).toBe(true);
    expect(element.querySelector("[data-ztoast-heading]")?.contains(screen.getByTestId("team-icon"))).toBe(true);
    expect(panel?.contains(screen.getByText("Team update"))).toBe(false);

    const action = screen.getByRole("button", { name: "Add a member" });
    fireEvent.click(action);
    expect(screen.getByText("4 new members joined the project.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add a member" })).toBe(action);
    expect(screen.getAllByRole("img")[0]).toBe(images[0]);
    expect(screen.getAllByText("Team update")).toHaveLength(1);

    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    act(() => { vi.runAllTimers(); });
    expect(screen.queryByText("Team update")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resizes the continuous surface when an image loads and releases its observer", () => {
    let height = 120;
    let notifyResize: (() => void) | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { notifyResize = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    mockLayout(360, () => height);
    function ImageUpdate() {
      const [loaded, setLoaded] = useState(false);
      return <div><img src="/team.png" alt="Project team" onLoad={() => setLoaded(true)} /><span>{loaded ? "Team photo loaded" : "Loading team photo"}</span></div>;
    }
    const { unmount } = render(<Toaster />);
    act(() => toast.info("Photo update", {
      description: <ImageUpdate />,
      bgColor: "linear-gradient(135deg, rgb(30, 27, 75), rgb(49, 46, 129))",
      position: "bottom-right",
      duration: Infinity,
      motion: { enter: 0 },
    }));
    const element = card("Photo update");
    const path = outline(element);
    const surface = element.querySelector<HTMLElement>("[data-ztoast-surface]");
    const initialPath = path.getAttribute("d");
    const initialBackground = surface?.style.background;
    expect(path.parentElement?.getAttribute("viewBox")).toBe("0 0 360 120");
    expect(observe).toHaveBeenCalledWith(element);
    expect(observe).toHaveBeenCalledWith(element.querySelector("[data-ztoast-heading]"));

    fireEvent.load(screen.getByRole("img", { name: "Project team" }));
    act(() => {
      height = 218;
      notifyResize?.();
    });

    expect(screen.getByText("Team photo loaded")).toBeTruthy();
    expect(path.parentElement?.getAttribute("viewBox")).toBe("0 0 360 218");
    expect(path.getAttribute("d")).not.toBe(initialPath);
    expect(surface?.style.clipPath).toBe(`path("${path.getAttribute("d")}")`);
    expect(surface?.style.background).toBe(initialBackground);
    expect(path.getAttribute("stroke-width")).toBe("1");
    expect(element.getAttribute("data-ztoast-notch")).toBe("bottom");
    expect(element.getAttribute("data-ztoast-notch-align")).toBe("right");
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
