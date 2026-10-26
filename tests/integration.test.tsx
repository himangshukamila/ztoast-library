import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Toaster, toast, useToast } from "../src/index";
import { drop, getToasts } from "../src/store";

const sleep = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

// the store is a module singleton, so it has to be emptied between tests
afterEach(() => {
  act(() => {
    for (const record of [...getToasts()]) drop(record.id);
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function card(): HTMLElement {
  const element = document.querySelector("[data-ztoast]");
  if (!element) throw new Error("no toast rendered");
  return element as HTMLElement;
}

function surface(element: HTMLElement = card()): HTMLElement {
  const result = element.querySelector<HTMLElement>("[data-ztoast-surface]");
  if (!result) throw new Error("no toast surface rendered");
  return result;
}

function viewports(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll("[data-ztoast-viewport]")
  ) as HTMLElement[];
}

function viewportOf(text: string): HTMLElement {
  const element = screen
    .getByText(text)
    .closest("[data-ztoast-viewport]") as HTMLElement | null;
  if (!element) throw new Error(`no viewport for "${text}"`);
  return element;
}

describe("the toast api", () => {
  it("groups one icon and the message in the notch above the description", () => {
    render(<Toaster />);

    act(() => {
      toast.success("profile updated", <span data-testid="icon">ok</span>, {
        description: "all your settings have been saved",
      });
    });

    const message = screen.getByText("profile updated");
    const description = screen.getByText("all your settings have been saved");
    const heading = message.closest("[data-ztoast-heading]");
    const body = description.closest("[data-ztoast-body]");

    expect(heading).not.toBeNull();
    expect(body).not.toBeNull();
    expect(heading?.contains(screen.getByTestId("icon"))).toBe(true);
    expect(heading?.contains(description)).toBe(false);
    expect(body?.contains(message)).toBe(false);
    expect(screen.getAllByTestId("icon")).toHaveLength(1);
    expect(screen.getAllByText("profile updated")).toHaveLength(1);
    expect(card().contains(heading)).toBe(true);
    expect(card().contains(body)).toBe(true);
  });

  it("keeps message-only toasts compact without an empty description panel", () => {
    render(<Toaster />);

    act(() => {
      toast.success("saved");
    });

    expect(screen.getByText("saved").closest("[data-ztoast-heading]")).not.toBeNull();
    expect(card().querySelector("[data-ztoast-body]")).toBeNull();
  });

  it("announces the heading and description together with the right urgency", () => {
    render(<Toaster />);

    act(() => {
      toast.success("saved", { description: "your changes are available" });
      toast.error("save failed", { description: "please try again" });
    });

    const success = screen.getByRole("status");
    const error = screen.getByRole("alert");
    expect(success.getAttribute("aria-live")).toBe("polite");
    expect(error.getAttribute("aria-live")).toBe("assertive");
    for (const element of [success, error]) {
      expect(element.getAttribute("aria-atomic")).toBe("true");
      expect(element.querySelector("[data-ztoast-heading]")).not.toBeNull();
      expect(element.querySelector("[data-ztoast-body]")).not.toBeNull();
    }
  });

  it("needs nothing but a message", () => {
    render(<Toaster />);

    act(() => {
      toast.warn("login fail");
      toast.success("saved");
      toast.error("boom");
      toast.info("heads up");
      toast.show("plain");
      toast.warning("careful");
    });

    expect(screen.getByText("login fail")).toBeTruthy();
    expect(screen.getByText("saved")).toBeTruthy();
    expect(screen.getByText("boom")).toBeTruthy();
    expect(screen.getByText("heads up")).toBeTruthy();
    expect(screen.getByText("plain")).toBeTruthy();
    // warn is an alias of warning: same variant, same icon
    expect(
      screen
        .getByText("login fail")
        .closest("[data-ztoast]")
        ?.getAttribute("data-variant")
    ).toBe("warning");
  });

  it("accepts a config object as the second argument", () => {
    render(<Toaster closable />);

    act(() => {
      toast.info("no close button here", { closable: false });
    });

    expect(screen.getByText("no close button here")).toBeTruthy();
    expect(screen.queryByLabelText("Dismiss notification")).toBeNull();
  });

  it("renders an icon passed as a component reference", () => {
    const Star = () => <span data-testid="star">*</span>;
    render(<Toaster />);

    act(() => {
      toast.show("starred", Star);
    });

    expect(screen.getByTestId("star")).toBeTruthy();
  });

  it("gives a text icon a line box so it sits on the title line", () => {
    render(<Toaster />);

    act(() => {
      toast.success("saved", "🎉", { description: "a description sits below" });
    });

    const wrapper = screen.getByText("🎉");
    const heading = screen.getByText("saved").closest("[data-ztoast-heading]") as HTMLElement;

    // An emoji needs its own line box even when the title and icon are centred.
    expect(heading.style.alignItems).toBe("center");
    expect(wrapper.style.lineHeight).toBe("1");
    expect(wrapper.style.fontSize).toBe("18px");
  });

  it("spins the loading icon about its own centre", () => {
    render(<Toaster />);

    act(() => {
      toast.loading("syncing records");
    });

    const svg = screen
      .getByText("syncing records")
      .closest("[data-ztoast]")
      ?.querySelector("[data-ztoast-icon] svg") as SVGSVGElement;
    const spin = svg.getElementsByTagName("animateTransform")[0];

    // the centre is given in viewBox units, so the animated element has to be
    // inside the viewBox. on the <svg> itself the transform resolves against
    // the parent's css pixels and the icon orbits instead of spinning.
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(spin.getAttribute("to")).toBe("360 12 12");
    expect(spin.parentElement?.tagName).toBe("g");

    // a quarter arc over a faint full ring, rather than a 270 degree arc that
    // looks like a closed ring with a gap orbiting it
    const arc = svg.getElementsByTagName("path")[0];
    expect(arc.getAttribute("d")).toBe("M12 3a9 9 0 0 1 9 9");
    expect(svg.getElementsByTagName("circle")).toHaveLength(1);
  });

  it("honours reduced motion and follows preference changes until unmount", () => {
    const listeners = new Set<() => void>();
    const media = {
      matches: true,
      addEventListener: vi.fn((_event: string, callback: () => void) => {
        listeners.add(callback);
      }),
      removeEventListener: vi.fn((_event: string, callback: () => void) => {
        listeners.delete(callback);
      }),
    };
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    const { unmount } = render(<Toaster />);

    act(() => toast.loading("loading quietly"));
    expect(card().querySelector("[data-ztoast-icon] svg")).not.toBeNull();
    expect(card().querySelector("animateTransform")).toBeNull();
    expect(card().style.transform).toBe("none");

    act(() => {
      media.matches = false;
      for (const listener of listeners) listener();
    });
    expect(card().querySelector("[data-ztoast-icon] animateTransform")).not.toBeNull();

    act(() => {
      media.matches = true;
      for (const listener of listeners) listener();
    });
    expect(card().querySelector("animateTransform")).toBeNull();

    unmount();
    expect(listeners.size).toBe(0);
  });

  it("centres the icon when there is no description", () => {
    render(<Toaster />);

    act(() => {
      toast.success("just a line");
    });

    const heading = card().querySelector<HTMLElement>("[data-ztoast-heading]");
    expect(heading?.style.alignItems).toBe("center");
  });

  it("renders an emoji icon and can turn the icon off", () => {
    render(<Toaster />);

    act(() => {
      toast.show("party", "🎉");
      toast.success("with icon", { id: "a" });
      toast.success("bare", false, { id: "b" });
    });

    const iconCount = (text: string) =>
      screen.getByText(text).closest("[data-ztoast]")!
        .querySelectorAll("[data-ztoast-icon]").length;

    expect(screen.getByText("🎉")).toBeTruthy();
    expect(iconCount("with icon")).toBe(1);
    expect(iconCount("bare")).toBe(0);
  });

  it("dismisses on click of the close button", async () => {
    render(<Toaster />);

    act(() => {
      toast.info("temporary", { closable: true });
    });
    const close = screen.getByLabelText("Dismiss notification");
    expect(close.closest("[data-ztoast-heading]")).not.toBeNull();
    fireEvent.click(close);

    await waitFor(() => expect(screen.queryByText("temporary")).toBeNull(), {
      timeout: 2000,
    });
  });

  it("replaces a toast in place when the id is reused", () => {
    render(<Toaster />);

    act(() => {
      toast.loading("loading data", { id: "job" });
    });
    expect(screen.getByText("loading data")).toBeTruthy();

    act(() => {
      toast.success("data loaded", { id: "job" });
    });
    expect(screen.queryByText("loading data")).toBeNull();
    expect(screen.getByText("data loaded")).toBeTruthy();
    expect(getToasts()).toHaveLength(1);
  });

  it("keeps a toast that reuses a just dismissed id", async () => {
    render(<Toaster />);

    act(() => {
      toast.show("first", { id: "reused", duration: Infinity });
    });
    act(() => {
      toast.dismiss("reused");
    });
    act(() => {
      toast.show("second", { id: "reused", duration: Infinity });
    });

    // the pending exit timer from the dismissal must not delete the new toast
    await sleep(700);
    expect(screen.queryByText("second")).not.toBeNull();
  });

  it("fires onClose exactly once per dismissal", () => {
    const onClose = vi.fn();
    render(<Toaster />);

    act(() => {
      toast.show("closing", { id: "close-me", duration: Infinity, onClose });
    });
    act(() => {
      toast.dismiss("close-me");
      toast.dismiss("close-me");
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("removes the record only after the exit animation has run", async () => {
    render(<Toaster />);

    act(() => {
      toast.show("leaving", {
        duration: Infinity,
        motion: { enter: 1, exit: 400 },
      });
    });
    act(() => {
      toast.dismiss();
    });

    // still on screen, animating out
    expect(getToasts()).toHaveLength(1);
    await sleep(120);
    expect(getToasts()).toHaveLength(1);

    await waitFor(() => expect(getToasts()).toHaveLength(0), { timeout: 2000 });
  });

  it("dismisses everything at once", async () => {
    render(<Toaster />);

    act(() => {
      toast.show("one", { duration: Infinity });
      toast.show("two", { duration: Infinity });
    });
    expect(getToasts()).toHaveLength(2);

    act(() => {
      toast.dismissAll();
    });

    await waitFor(() => expect(getToasts()).toHaveLength(0), { timeout: 2000 });
  });

  it("queues toasts beyond the max and shows them as room appears", async () => {
    render(<Toaster max={1} />);

    act(() => {
      toast.show("visible", { id: "a", duration: Infinity });
      toast.show("queued", { id: "b", duration: Infinity });
    });

    // max is per position, and the newest toast is the one on screen
    expect(document.querySelectorAll("[data-ztoast]")).toHaveLength(1);
    expect(screen.getByText("queued")).toBeTruthy();

    act(() => {
      toast.dismiss("b");
    });

    await waitFor(() => expect(screen.getByText("visible")).toBeTruthy(), {
      timeout: 2000,
    });
  });

  it("tracks a promise through to success", async () => {
    render(<Toaster />);

    let settle: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      settle = resolve;
    });

    act(() => {
      toast.promise(pending, {
        loading: "saving file",
        success: (name) => `saved ${name}`,
        error: "could not save",
      });
    });
    expect(screen.getByText("saving file")).toBeTruthy();

    await act(async () => {
      settle!("report.pdf");
    });

    expect(screen.queryByText("saving file")).toBeNull();
    expect(screen.getByText("saved report.pdf")).toBeTruthy();

    // the spinner is gone with it: no animation is left running on the card
    // that replaced the loading toast in place
    const settled = screen
      .getByText("saved report.pdf")
      .closest("[data-ztoast]") as HTMLElement;
    expect(settled.getElementsByTagName("animateTransform")).toHaveLength(0);
    expect(settled.getAttribute("data-variant")).toBe("success");
  });

  it("tracks a promise through to failure and still honours the duration", async () => {
    render(<Toaster />);

    let fail: (error: Error) => void;
    const pending = new Promise<string>((_, reject) => {
      fail = reject;
    });

    act(() => {
      toast.promise(
        pending,
        { loading: "uploading", success: "uploaded", error: "network timeout" },
        { duration: 150 }
      );
    });
    expect(screen.getByText("uploading")).toBeTruthy();

    await act(async () => {
      fail!(new Error("timeout"));
    });
    expect(screen.getByText("network timeout")).toBeTruthy();

    // the loading toast was persistent; its replacement must still count down
    await waitFor(
      () => expect(screen.queryByText("network timeout")).toBeNull(),
      { timeout: 3000 }
    );
  });
});

describe("styling", () => {
  it.each([undefined, "your settings have been saved"])(
    "applies configured styling with description %s",
    (description) => {
      render(<Toaster />);

      act(() => {
        toast.success("styled", null, {
          textColor: "rgb(1, 2, 3)",
          bgColor: "rgb(4, 5, 6)",
          width: 340,
          height: 64,
          font: "Inter, sans-serif",
          radius: 22,
          padding: "10px 18px",
          description,
        });
      });

      const element = card();
      const painted = surface(element);
      expect(element.style.color).toBe("rgb(1, 2, 3)");
      expect(painted.style.background).toContain("rgb(4, 5, 6)");
      expect(element.style.width).toBe("340px");
      expect(element.style.height).toBe("64px");
      expect(element.style.fontFamily).toBe("Inter, sans-serif");
      expect(element.style.borderRadius).toBe("22px");
      for (const content of element.querySelectorAll<HTMLElement>("[data-ztoast-heading], [data-ztoast-body]")) {
        expect(content.style.padding).toBe("10px 18px");
      }
    }
  );

  it("lets an explicit width escape the default max width", () => {
    render(<Toaster />);

    act(() => {
      toast.show("wide", { id: "wide", width: 600 });
      toast.show("default", { id: "default" });
    });

    const wide = screen.getByText("wide").closest("[data-ztoast]") as HTMLElement;
    // css max-width beats width, so the default clamp has to step aside
    expect(wide.style.width).toBe("600px");
    expect(wide.style.maxWidth).toBe("600px");

    const fitted = screen
      .getByText("default")
      .closest("[data-ztoast]") as HTMLElement;
    // CSSOM may simplify calc() expressions when serializing them.
    const expected = document.createElement("div").style;
    expected.maxWidth = "min(440px, calc(100vw - 32px))";
    expect(fitted.style.width).toBe("fit-content");
    expect(fitted.style.maxWidth).toBe(expected.maxWidth);
    expect(fitted.style.minWidth).toBe("");
  });

  it("paints its shadow on the very first frame", () => {
    render(<Toaster />);

    act(() => {
      // a deliberately long enter: the shadow must not wait for any part of it
      toast.show("shadowed", {
        shadow: "0 10px 20px rgb(0, 0, 0)",
        motion: { enter: 1500 },
      });
    });

    // synchronously, before a single animation frame has run
    expect(card().style.boxShadow).toBe("0 10px 20px rgb(0, 0, 0)");
    // nothing is clipping it, so none of it is sliced off
    expect(card().parentElement?.parentElement?.style.overflow).toBe("visible");
    // it is invisible at this point only because the whole card is
    expect(card().style.opacity).toBe("0");
  });

  it("removes the default shadow when style.boxShadow explicitly disables it", () => {
    render(<Toaster />);

    act(() => {
      toast.success("flat surface", {
        description: "no shadow requested",
        style: { boxShadow: "none" },
      });
    });

    expect(card().style.boxShadow).toBe("none");
    expect(card().style.filter).not.toContain("drop-shadow");
  });

  it("keeps the shadow through the enter, whatever the easing", async () => {
    render(<Toaster />);

    act(() => {
      toast.show("linear", {
        shadow: "0 10px 20px rgb(0, 0, 0)",
        motion: { enter: 800, easing: "linear" },
      });
    });

    const grid = () => card().parentElement?.parentElement?.parentElement;

    await sleep(200);

    // mid-enter: the row is still opening the slot, and the shadow is already
    // fully painted rather than waiting for the row or the card
    expect(card().style.boxShadow).toBe("0 10px 20px rgb(0, 0, 0)");
    expect(grid()?.style.transition).toBe(
      "grid-template-rows 400ms linear 0ms"
    );
    expect(card().style.transition).toContain("transform 800ms");
  });

  it("overflows away from the anchor while the slot opens", () => {
    render(<Toaster />);

    act(() => {
      toast.show("downwards", { id: "down", position: "top-right" });
      toast.show("upwards", { id: "up", position: "bottom-right" });
    });

    const clipBox = (text: string) =>
      screen.getByText(text).closest("[data-ztoast]")?.parentElement
        ?.parentElement as HTMLElement;

    // a top stack grows downwards, so the card overflows downwards; a bottom
    // stack grows upwards, so it must overflow upwards instead of covering the
    // toast already sitting below it
    expect(clipBox("downwards").style.alignItems).toBe("flex-start");
    expect(clipBox("upwards").style.alignItems).toBe("flex-end");
  });

  it("fades the shadow together with the toast instead of dropping it at departure", async () => {
    render(<Toaster />);

    act(() => {
      toast.show("leaving", {
        id: "leaving",
        duration: Infinity,
        shadow: "0 10px 20px rgb(0, 0, 0)",
        motion: { enter: 30 },
      });
    });

    await waitFor(
      () => expect(card().style.boxShadow).toBe("0 10px 20px rgb(0, 0, 0)"),
      { timeout: 2000 }
    );

    act(() => {
      toast.dismiss("leaving");
    });

    // Overall opacity fades the shadow too; it must not abruptly disappear
    // or be clipped when the final departure begins.
    expect(card().style.boxShadow).toBe("0 10px 20px rgb(0, 0, 0)");
    expect(card().parentElement?.parentElement?.style.overflow).toBe("visible");
    expect(card().style.transition).toContain("opacity 450ms");
  });

  it("accepts a gradient as the background", () => {
    render(<Toaster />);

    act(() => {
      toast.show("gradient", {
        bgColor: "linear-gradient(135deg, rgb(30, 27, 75), rgb(49, 46, 129))",
      });
    });

    expect(surface().style.background).toContain("linear-gradient");
  });

  it("updates the silhouette after a resize and releases its observer on unmount", () => {
    let width = 360;
    let notifyResize: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) {
        notifyResize = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute("data-ztoast")) return width;
      return this.hasAttribute("data-ztoast-heading") ? 240 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute("data-ztoast")) return 120;
      return this.hasAttribute("data-ztoast-heading") ? 50 : 0;
    });
    const { unmount } = render(<Toaster />);

    act(() => toast.success("responsive surface", { description: "fits its contents" }));
    const initialPath = surface().style.clipPath;
    expect(initialPath).not.toBe("");
    expect(notifyResize).toBeTypeOf("function");

    act(() => {
      width = 420;
      notifyResize?.();
    });
    expect(surface().style.clipPath).not.toBe(initialPath);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("drops an unsafe value and keeps the default", () => {
    render(<Toaster />);

    act(() => {
      toast.show("guarded", { bgColor: "url(javascript:alert(1))" });
    });

    expect(card().outerHTML).not.toContain("javascript");
  });

  it("takes defaults from <Toaster /> and lets a toast override them", () => {
    render(<Toaster theme="light" radius={4} />);

    act(() => {
      toast.show("inherits", { id: "a" });
      toast.show("overrides", { id: "b", radius: 30 });
    });

    const inherits = screen
      .getByText("inherits")
      .closest("[data-ztoast]") as HTMLElement;
    const overrides = screen
      .getByText("overrides")
      .closest("[data-ztoast]") as HTMLElement;

    expect(inherits.style.borderRadius).toBe("4px");
    expect(overrides.style.borderRadius).toBe("30px");
    // the light theme default background, from the toaster props
    expect(surface(inherits).style.background).toContain("rgb(255, 255, 255)");
  });
});

describe("positioning", () => {
  it("anchors the nine named positions", () => {
    render(<Toaster />);

    act(() => {
      toast.show("bottom centre", { position: "bottom-center" });
    });

    const viewport = viewportOf("bottom centre");
    expect(viewport.style.bottom).toBe("16px");
    expect(viewport.style.left).toBe("50%");
    expect(viewport.style.transform).toContain("-50%");
    expect(viewport.style.flexDirection).toBe("column-reverse");
  });

  it("places a toast at free x / y coordinates", () => {
    render(<Toaster />);

    act(() => {
      toast.show("anywhere", { position: { x: "62%", y: "80%" } });
    });

    const viewport = viewportOf("anywhere");
    expect(viewport.style.left).toBe("62%");
    expect(viewport.style.top).toBe("80%");
    // the toast's own centre lands on the coordinate by default
    expect(viewport.style.transform).toContain("-50%");
  });

  it("lets the anchor decide which corner the coordinate refers to", () => {
    render(<Toaster />);

    act(() => {
      toast.show("pinned", {
        position: { x: 40, y: 120, anchor: "top-left" },
      });
    });

    const viewport = viewportOf("pinned");
    expect(viewport.style.left).toBe("40px");
    expect(viewport.style.top).toBe("120px");
    expect(viewport.style.transform).toBe("");
  });

  it("offsets from a single edge and centres the other axis", () => {
    render(<Toaster />);

    act(() => {
      toast.show("ten vh down", { position: "top-10vh" });
      toast.show("ten vw in", { position: "left-10vw" });
    });

    const down = viewportOf("ten vh down");
    expect(down.style.top).toBe("10vh");
    expect(down.style.left).toBe("50%");
    expect(down.style.transform).toBe("translate(-50%, 0)");

    const inwards = viewportOf("ten vw in");
    expect(inwards.style.left).toBe("10vw");
    expect(inwards.style.top).toBe("50%");
    expect(inwards.style.transform).toBe("translate(0, -50%)");
    expect(inwards.style.alignItems).toBe("flex-start");
  });

  it("offsets from both edges, in any unit", () => {
    render(<Toaster />);

    act(() => {
      toast.show("two edges", { position: "bottom-24px right-5%" });
      toast.show("rem and calc", {
        position: "top-2rem left-calc(50% - 120px)",
      });
      toast.show("bare number is px", { position: "top-40" });
    });

    const both = viewportOf("two edges");
    expect(both.style.bottom).toBe("24px");
    expect(both.style.right).toBe("5%");
    expect(both.style.transform).toBe("");
    // a bottom edge still stacks upwards
    expect(both.style.flexDirection).toBe("column-reverse");

    const units = viewportOf("rem and calc");
    expect(units.style.top).toBe("2rem");
    expect(units.style.left).toBe("calc(50% - 120px)");

    expect(viewportOf("bare number is px").style.top).toBe("40px");
  });

  it("reads a bare edge keyword as that edge at the default inset", () => {
    render(<Toaster />);

    act(() => {
      toast.show("bare edge", { position: "bottom" });
    });

    const viewport = viewportOf("bare edge");
    expect(viewport.style.bottom).toBe("16px");
    expect(viewport.style.left).toBe("50%");
  });

  it("understands every position string used in the readme", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Toaster />);

    const documented = [
      "top-10vh",
      "left-10vw",
      "bottom-24px right-5%",
      "bottom",
      "top-40",
      "top-88px",
      "left-20vw",
      "top-50vh",
      "bottom-40px right-32px",
      "top-2rem left-calc(50% - 120px)",
      "right-16px",
      "top-right",
      "center",
    ];

    act(() => {
      for (const position of documented) {
        toast.show(position, { id: position, position });
      }
    });

    for (const position of documented) {
      const viewport = viewportOf(position);
      // a parsed position always pins at least one edge
      const pinned = [
        viewport.style.top,
        viewport.style.bottom,
        viewport.style.left,
        viewport.style.right,
      ].filter(Boolean);
      expect(pinned.length).toBeGreaterThan(0);
    }
    // none of them fell back, so nothing was reported as unparseable
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("falls back to top-right when a position string is not understood", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Toaster />);

    act(() => {
      toast.show("typo", { position: "tpo-10vh" });
    });

    const viewport = viewportOf("typo");
    expect(viewport.style.top).toBe("16px");
    expect(viewport.style.right).toBe("16px");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('position "tpo-10vh" was not understood')
    );
    warn.mockRestore();
  });

  it("shares one stack per position and splits different ones", () => {
    render(<Toaster />);

    act(() => {
      toast.show("a", { position: "top-right" });
      toast.show("b", { position: "top-right" });
    });
    expect(viewports()).toHaveLength(1);

    act(() => {
      toast.show("c", { position: { x: "10%", y: "90%" } });
    });
    expect(viewports()).toHaveLength(2);
  });

  it("uses the position given to <Toaster /> as the default", () => {
    render(<Toaster position="center" />);

    act(() => {
      toast.warning("dead centre");
    });

    const viewport = viewportOf("dead centre");
    expect(viewport.style.top).toBe("50%");
    expect(viewport.style.left).toBe("50%");
  });
});

describe("the countdown", () => {
  it("shows the progress bar by default and hides it when persistent", () => {
    render(<Toaster />);

    act(() => {
      toast.show("timed", { id: "timed" });
      toast.show("persistent", { id: "persistent", duration: Infinity });
      toast.show("opted out", { id: "opted-out", progress: false });
    });

    const has = (text: string) =>
      Boolean(
        screen
          .getByText(text)
          .closest("[data-ztoast]")
          ?.querySelector("[data-ztoast-progress]")
      );

    expect(has("timed")).toBe(true);
    expect(has("persistent")).toBe(false);
    expect(has("opted out")).toBe(false);
  });

  it("auto dismisses when the duration runs out", async () => {
    render(<Toaster />);

    act(() => {
      toast.show("short lived", { duration: 200 });
    });
    expect(screen.queryByLabelText("Dismiss notification")).toBeNull();

    await waitFor(() => expect(screen.queryByText("short lived")).toBeNull(), {
      timeout: 3000,
    });
  });

  it("freezes the countdown while the pointer rests on the toast", async () => {
    render(<Toaster />);

    act(() => {
      toast.info("hover to keep me", { duration: 250 });
    });

    fireEvent.mouseEnter(screen.getByRole("status"));

    // well past the original duration: the clock must be frozen
    await sleep(800);
    expect(screen.queryByText("hover to keep me")).not.toBeNull();

    fireEvent.mouseLeave(screen.getByRole("status"));

    await waitFor(
      () => expect(screen.queryByText("hover to keep me")).toBeNull(),
      { timeout: 3000 }
    );
  });

  it("keeps counting down when pauseOnHover is off", async () => {
    render(<Toaster />);

    act(() => {
      toast.info("ignores hover", { duration: 200, pauseOnHover: false });
    });

    fireEvent.mouseEnter(screen.getByRole("status"));

    await waitFor(() => expect(screen.queryByText("ignores hover")).toBeNull(), {
      timeout: 3000,
    });
  });

  it("preserves the remaining time when focus moves within a notification", () => {
    vi.useFakeTimers();
    render(<Toaster />);

    act(() => {
      toast.info("review this change", {
        closable: true,
        duration: 1000,
        motion: { enter: 1, exit: 1, exitHold: 0 },
        description: <button type="button">Review change</button>,
      });
    });
    act(() => vi.advanceTimersByTime(50));
    act(() => vi.advanceTimersByTime(200));
    act(() => screen.getByRole("button", { name: "Review change" }).focus());
    act(() => vi.advanceTimersByTime(1600));

    const close = screen.getByRole("button", { name: "Dismiss notification" });
    act(() => close.focus());
    act(() => vi.advanceTimersByTime(1600));
    expect(getToasts()[0]?.leaving).toBe(false);

    act(() => close.blur());
    act(() => vi.advanceTimersByTime(400));
    // Time spent focused, including the focus transfer, must not consume the
    // roughly 800ms that remained before the first button received focus.
    expect(getToasts()[0]?.leaving).toBe(false);
    act(() => vi.advanceTimersByTime(500));
    act(() => vi.advanceTimersByTime(20));
    expect(screen.queryByText("review this change")).toBeNull();
  });

  it("keeps the countdown paused when the pointer leaves a focused toast", () => {
    vi.useFakeTimers();
    render(<Toaster />);

    act(() => {
      toast.info("keyboard interaction", {
        closable: true,
        duration: 300,
        motion: { enter: 1, exit: 1 },
      });
    });
    act(() => vi.advanceTimersByTime(50));
    fireEvent.mouseEnter(card());
    const close = screen.getByRole("button", { name: "Dismiss notification" });
    act(() => close.focus());
    fireEvent.mouseLeave(card());

    act(() => vi.advanceTimersByTime(1000));
    expect(getToasts()[0]?.leaving).toBe(false);

    act(() => close.blur());
    act(() => vi.advanceTimersByTime(350));
    act(() => vi.advanceTimersByTime(20));
    expect(screen.queryByText("keyboard interaction")).toBeNull();
  });

  it("keeps a loading toast up until it is replaced", async () => {
    render(<Toaster />);

    act(() => {
      toast.loading("uploading assets");
    });

    await sleep(600);
    expect(screen.getByText("uploading assets")).toBeTruthy();
  });
});

describe("useToast", () => {
  it("exposes the live toast list", async () => {
    function Counter() {
      const { toasts, dismissAll } = useToast();
      return (
        <div>
          <span data-testid="count">{toasts.length}</span>
          <button type="button" onClick={dismissAll}>
            clear
          </button>
        </div>
      );
    }

    render(
      <>
        <Counter />
        <Toaster />
      </>
    );

    expect(screen.getByTestId("count").textContent).toBe("0");

    act(() => {
      toast.show("counted", { duration: Infinity });
    });
    expect(screen.getByTestId("count").textContent).toBe("1");

    fireEvent.click(screen.getByText("clear"));

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"), {
      timeout: 2000,
    });
  });
});
