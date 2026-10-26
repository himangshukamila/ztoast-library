import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { Toaster, toast } from "../src/index";
import { drop, getToasts } from "../src/store";

afterEach(() => {
  act(() => {
    for (const record of [...getToasts()]) drop(record.id);
  });
  vi.restoreAllMocks();
});

function outline(): SVGPathElement {
  const path = document.querySelector<SVGPathElement>("[data-ztoast] svg > path[stroke]");
  if (!path) throw new Error("no toast outline rendered");
  return path;
}

describe("custom notch borders", () => {
  it("keeps the default thin solid variant border", () => {
    render(<Toaster />);
    act(() => toast.success("Saved", { duration: Infinity }));

    expect(outline().getAttribute("stroke-width")).toBe("1");
    expect(outline().getAttribute("stroke")).toBe("rgb(52, 211, 153)");
    expect(outline().style.strokeDasharray).toBe("");
  });

  it.each([
    { border: "2px dashed red", width: "2", dashes: "6 4", cap: "butt" },
    { border: "3px dotted blue", width: "3", dashes: "0 6", cap: "round" },
    { border: "0.25em solid green", width: "0.25em", dashes: "", cap: "butt" },
    { border: "0.125rem dashed red", width: "0.125rem", dashes: "calc(0.125rem * 3) calc(0.125rem * 2)", cap: "butt" },
  ])("preserves the width and pattern of $border", ({ border, width, dashes, cap }) => {
    render(<Toaster />);
    act(() => toast.success("Custom border", { border, duration: Infinity }));

    expect(outline().getAttribute("stroke-width")).toBe(width);
    expect(outline().style.strokeDasharray).toBe(dashes);
    expect(outline().getAttribute("stroke-linecap")).toBe(cap);
  });

  it.each(["none", "hidden"])("suppresses a %s border", (style) => {
    render(<Toaster />);
    act(() => toast.success("No border", { border: `4px ${style} red`, duration: Infinity }));

    expect(outline().getAttribute("stroke-width")).toBe("0");
  });

  it.each([
    { keyword: "thin", width: 1 },
    { keyword: "medium", width: 3 },
    { keyword: "thick", width: 5 },
  ])("resolves $keyword using the browser without leaving a layout box", ({ keyword, width }) => {
    const computedStyle = window.getComputedStyle.bind(window);
    let probe: HTMLElement | undefined;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudoElement) => {
      const style = computedStyle(element, pseudoElement);
      if (element instanceof HTMLElement && element.hasAttribute("data-ztoast-border-probe")) {
        probe = element;
        // jsdom keeps keyword widths; supply the browser's computed pixel value.
        Object.defineProperty(style, "borderTopWidth", { value: `${width}px` });
      }
      return style;
    });
    render(<Toaster />);
    act(() => toast.success("Keyword border", { border: `${keyword} solid red`, duration: Infinity }));

    expect(outline().getAttribute("stroke-width")).toBe(String(width));
    expect(probe?.style.position).toBe("absolute");
    expect(probe?.style.visibility).toBe("hidden");
    expect(probe?.getAttribute("aria-hidden")).toBe("true");
    expect(probe?.isConnected).toBe(false);
    expect(document.querySelector("[data-ztoast-border-probe]")).toBeNull();
  });

  it("keeps inline border precedence and removes a previous dotted pattern on update", () => {
    render(<Toaster />);
    act(() => toast.success("Custom border", {
      id: "border-update", duration: Infinity, border: "4px dashed blue",
      style: { border: "2px dotted red" },
    }));
    expect(outline().getAttribute("stroke-width")).toBe("2");
    expect(outline().getAttribute("stroke")).toBe("red");
    expect(outline().style.strokeDasharray).toBe("0 4");

    act(() => toast.success("Custom border", {
      id: "border-update", duration: Infinity, style: { border: "1px solid green" },
    }));
    expect(outline().getAttribute("stroke-width")).toBe("1");
    expect(outline().getAttribute("stroke")).toBe("green");
    expect(outline().style.strokeDasharray).toBe("");
    expect(outline().getAttribute("stroke-linecap")).toBe("butt");
  });
});
