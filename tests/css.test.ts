import { describe, expect, it } from "vitest";
import { css, len, pick } from "../src/css";

describe("css", () => {
  it("passes ordinary css values straight through", () => {
    expect(css("#18181b")).toBe("#18181b");
    expect(css("rgba(0, 0, 0, 0.5)")).toBe("rgba(0, 0, 0, 0.5)");
    // modern space separated syntax: rejected by a per property allowlist,
    // which is exactly why there is not one any more
    expect(css("rgb(0 0 0 / 50%)")).toBe("rgb(0 0 0 / 50%)");
    expect(css("oklch(0.6 0.25 150)")).toBe("oklch(0.6 0.25 150)");
    expect(css("var(--brand-fg)")).toBe("var(--brand-fg)");
    expect(css("10px 18px")).toBe("10px 18px");
    expect(css("linear-gradient(135deg, #1e1b4b, #312e81)")).toBe(
      "linear-gradient(135deg, #1e1b4b, #312e81)"
    );
    expect(css("0 1px 2px #000, 0 12px 32px rgba(0, 0, 0, 0.4)")).toBe(
      "0 1px 2px #000, 0 12px 32px rgba(0, 0, 0, 0.4)"
    );
    expect(css("1px solid rgba(255, 255, 255, 0.1)")).toBe(
      "1px solid rgba(255, 255, 255, 0.1)"
    );
    expect(css("cubic-bezier(0.16, 1, 0.3, 1)")).toBe(
      "cubic-bezier(0.16, 1, 0.3, 1)"
    );
  });

  it("collapses whitespace and strips control characters", () => {
    expect(css("  red   dashed  ")).toBe("red dashed");
  });

  it("rejects values that can execute", () => {
    expect(css("javascript:alert(1)")).toBeUndefined();
    expect(css("url(javascript:alert(1))")).toBeUndefined();
    expect(css("expression(alert(1))")).toBeUndefined();
    expect(css("eval(alert(1))")).toBeUndefined();
    expect(css("behavior:url(evil.htc)")).toBeUndefined();
    expect(css("-moz-binding: url(evil.xml)")).toBeUndefined();
  });

  it("rejects declaration and rule breakout", () => {
    expect(css("red; background: black")).toBeUndefined();
    expect(css("red } body { background: black")).toBeUndefined();
    expect(css("@import url('evil.css')")).toBeUndefined();
  });

  it("rejects comments, including unbalanced markers", () => {
    expect(css("/*comment*/javascript:alert(1)")).toBeUndefined();
    expect(css("/*/*nested*/*/red")).toBeUndefined();
    expect(css("red/*")).toBeUndefined();
    expect(css("0 0 2px #000 */")).toBeUndefined();
  });

  it("rejects css escape sequences that smuggle blocked keywords", () => {
    // "\6a avascript:" resolves to "javascript:" once the css parser unescapes
    // it, which no substring check on the raw text can see
    expect(css("\\6a avascript:alert(1)")).toBeUndefined();
    expect(css("url('\\6a avascript:alert(1)')")).toBeUndefined();
  });

  it("allows only safe url schemes", () => {
    expect(css("url(https://example.com/bg.png)")).toBe(
      "url(https://example.com/bg.png)"
    );
    expect(css("url('/assets/bg.jpg')")).toBe("url('/assets/bg.jpg')");
    expect(css("url('./bg.webp')")).toBe("url('./bg.webp')");
    expect(
      css(
        "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')"
      )
    ).toContain("data:image/png;base64,");
    expect(css("url('data:text/html,<script>alert(1)</script>')")).toBeUndefined();
    expect(css("url('vbscript:msgbox')")).toBeUndefined();
    expect(css("url(ftp://example.com/bg.png)")).toBeUndefined();
    // unbalanced: we could not parse it, so we do not trust it
    expect(css("url(https://example.com/bg.png")).toBeUndefined();
  });

  it("rejects non strings and oversized values", () => {
    expect(css(undefined)).toBeUndefined();
    expect(css(null)).toBeUndefined();
    expect(css(12 as unknown as string)).toBeUndefined();
    expect(css({} as unknown as string)).toBeUndefined();
    expect(css("")).toBeUndefined();
    expect(css("a".repeat(601))).toBeUndefined();
  });
});

describe("len", () => {
  it("keeps finite numbers so react appends px itself", () => {
    expect(len(340)).toBe(340);
    expect(len(0)).toBe(0);
    expect(len(NaN)).toBeUndefined();
    expect(len(Infinity)).toBeUndefined();
  });

  it("guards strings like any other css value", () => {
    expect(len("50vh")).toBe("50vh");
    expect(len("calc(100% - 20px)")).toBe("calc(100% - 20px)");
    expect(len("clamp(280px, 40vw, 420px)")).toBe("clamp(280px, 40vw, 420px)");
    expect(len("100px; color: red")).toBeUndefined();
    expect(len(undefined)).toBeUndefined();
  });
});

describe("pick", () => {
  it("returns the first defined value", () => {
    expect(pick(undefined, "b", "c")).toBe("b");
    expect(pick(undefined, undefined)).toBeUndefined();
  });
});
