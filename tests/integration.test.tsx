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
});

function card(): HTMLElement {
  const element = document.querySelector("[data-ztoast]");
  if (!element) throw new Error("no toast rendered");
  return element as HTMLElement;
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
  it("renders a message, an icon node and a description", () => {
    render(<Toaster />);

    act(() => {
      toast.success("profile updated", <span data-testid="icon">ok</span>, {
        description: "all your settings have been saved",
      });
    });

    expect(screen.getByText("profile updated")).toBeTruthy();
    expect(screen.getByText("all your settings have been saved")).toBeTruthy();
    expect(screen.getByTestId("icon")).toBeTruthy();
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
    render(<Toaster />);

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

  it("renders an emoji icon and can turn the icon off", () => {
    render(<Toaster />);

    act(() => {
      toast.show("party", "🎉");
      // the variant icon plus the close button is two svgs; `false` leaves one
      toast.success("with icon", { id: "a" });
      toast.success("bare", false, { id: "b" });
    });

    const svgCount = (text: string) =>
      screen.getByText(text).closest("[data-ztoast]")!.querySelectorAll("svg")
        .length;

    expect(screen.getByText("🎉")).toBeTruthy();
    expect(svgCount("with icon")).toBe(2);
    expect(svgCount("bare")).toBe(1);
  });

  it("dismisses on click of the close button", async () => {
    render(<Toaster />);

    act(() => {
      toast.info("temporary");
    });
    fireEvent.click(screen.getByLabelText("Dismiss notification"));

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
  it("applies the colours, size and font given in the config", () => {
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
      });
    });

    const element = card();
    expect(element.style.color).toBe("rgb(1, 2, 3)");
    expect(element.style.background).toContain("rgb(4, 5, 6)");
    expect(element.style.width).toBe("340px");
    expect(element.style.height).toBe("64px");
    expect(element.style.fontFamily).toBe("Inter, sans-serif");
    expect(element.style.borderRadius).toBe("22px");
    expect(element.style.padding).toBe("10px 18px");
  });

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
    expect(fitted.style.width).toBe("");
    expect(fitted.style.maxWidth).toBe("min(92vw, 440px)");
    expect(fitted.style.minWidth).toBe("240px");
  });

  it("accepts a gradient as the background", () => {
    render(<Toaster />);

    act(() => {
      toast.show("gradient", {
        bgColor: "linear-gradient(135deg, rgb(30, 27, 75), rgb(49, 46, 129))",
      });
    });

    expect(card().style.background).toContain("linear-gradient");
  });

  it("drops an unsafe value and keeps the default", () => {
    render(<Toaster />);

    act(() => {
      toast.show("guarded", { bgColor: "url(javascript:alert(1))" });
    });

    const style = card().getAttribute("style") ?? "";
    expect(style).not.toContain("javascript");
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
    expect(inherits.style.background).toContain("rgb(255, 255, 255)");
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
