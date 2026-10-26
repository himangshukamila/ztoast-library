import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { createElement, forwardRef, memo } from "react";
import { Toaster } from "../src/index";
import { dismiss, dismissAll, drop, getToasts, holdExit, subscribe, toast } from "../src/store";

afterEach(() => {
  act(() => {
    for (const record of [...getToasts()]) drop(record.id);
  });
  vi.useRealTimers();
});

describe("createElement consumers", () => {
  it("accepts Toaster props without explicit generic type arguments", () => {
    render(createElement(Toaster, { theme: "light", max: 2 }));

    act(() => {
      toast.success("with props", { duration: Infinity });
    });

    expect(screen.getByText("with props")).toBeTruthy();
  });

  it("accepts Toaster with no props", () => {
    render(createElement(Toaster));

    act(() => {
      toast.success("without props", { duration: Infinity });
    });

    expect(screen.getByText("without props")).toBeTruthy();
  });
});

interface IconProps {
  size?: number;
  color?: string;
}

const MemoIcon = memo(function MemoIcon({ size, color }: IconProps) {
  return <svg data-testid="custom-icon" width={size} stroke={color} />;
});

const ForwardIcon = forwardRef<SVGSVGElement, IconProps>(function ForwardIcon(
  { size, color },
  ref
) {
  return <svg ref={ref} data-testid="custom-icon" width={size} stroke={color} />;
});

describe.each([
  ["memo", MemoIcon],
  ["forwardRef", ForwardIcon],
] as const)("%s icon components", (_name, Icon) => {
  it("accepts a component as the positional icon without treating it as config", () => {
    render(<Toaster duration={Infinity} iconColor="#aabbcc" />);

    act(() => {
      toast.success("custom icon", Icon);
    });

    expect(getToasts()[0].config.icon).toBe(Icon);
    expect(screen.getByTestId("custom-icon").getAttribute("width")).toBe("18");
    expect(screen.getByTestId("custom-icon").getAttribute("stroke")).toBe("#aabbcc");
  });

  it("accepts a component inside config", () => {
    render(<Toaster duration={Infinity} />);

    act(() => {
      toast.info("custom icon", { icon: Icon, iconColor: "#ccbbaa" });
    });

    expect(screen.getByTestId("custom-icon").getAttribute("width")).toBe("18");
    expect(screen.getByTestId("custom-icon").getAttribute("stroke")).toBe("#ccbbaa");
  });

  it("preserves an already rendered icon element and its props", () => {
    render(<Toaster duration={Infinity} iconColor="#aabbcc" />);

    act(() => {
      toast.info("custom icon", <Icon size={25} color="#123456" />);
    });

    expect(screen.getByTestId("custom-icon").getAttribute("width")).toBe("25");
    expect(screen.getByTestId("custom-icon").getAttribute("stroke")).toBe("#123456");
  });
});

describe("reentrant dismissal callbacks", () => {
  it("keeps a replacement created by onClose after the fallback deadline", () => {
    vi.useFakeTimers();
    const unsubscribe = subscribe(() => {});
    try {
      const onClose = vi.fn(() => {
        toast.success("replacement", { id: "update", duration: Infinity });
      });
      toast.info("original", { id: "update", duration: Infinity, onClose });

      dismiss("update");
      vi.advanceTimersByTime(4000);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(getToasts()).toMatchObject([{ id: "update", message: "replacement", leaving: false }]);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      unsubscribe();
    }
  });

  it("keeps replacements for other ids created during dismissAll callbacks", () => {
    vi.useFakeTimers();
    const unsubscribe = subscribe(() => {});
    try {
      const secondClose = vi.fn();
      toast.info("first", {
        id: "first",
        duration: Infinity,
        onClose: () => toast.success("replacement", { id: "second", duration: Infinity }),
      });
      toast.info("second", { id: "second", duration: Infinity, onClose: secondClose });

      dismissAll();
      vi.advanceTimersByTime(4000);

      expect(secondClose).toHaveBeenCalledTimes(1);
      expect(getToasts()).toMatchObject([{ id: "second", message: "replacement", leaving: false }]);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      unsubscribe();
    }
  });

  it("preserves the exit duration registered by a synchronous subscriber", () => {
    vi.useFakeTimers();
    const unsubscribe = subscribe((records) => {
      if (records.some((record) => record.id === "measured" && record.leaving)) {
        holdExit("measured", 5000);
      }
    });
    try {
      toast.info("measured exit", { id: "measured", duration: Infinity });

      dismiss("measured");
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(4999);
      expect(getToasts()).toMatchObject([{ id: "measured", leaving: true }]);
      vi.advanceTimersByTime(1);
      expect(getToasts()).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      unsubscribe();
    }
  });
});
