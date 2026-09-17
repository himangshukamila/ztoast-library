// the single security boundary of the library.
//
// every style value a consumer passes in (bgColor, textColor, border, shadow,
// coordinates, ...) is a raw css string that could have come from user data, so
// it passes through `css()` before it reaches a react style object.
//
// react assigns style values through the cssom (`el.style.background = value`),
// which means a bad value is dropped by the browser instead of being parsed as
// a new declaration. escaping is therefore not the problem; the three things
// worth blocking are values that can execute (`javascript:`, `expression(`),
// values that can escape the declaration (`;`, `{`, `}`, comments) and values
// that can fetch a url the consumer did not intend.
//
// so this is a narrow denylist plus a url scheme allowlist, not a per property
// shape allowlist: "10px 20px", "rgb(0 0 0 / 50%)" and multi layer shadows all
// pass straight through, which is the whole point of the styling api.

const MAX_LENGTH = 600;

const BLOCKED = [
  "javascript:",
  "vbscript:",
  "data:text/html",
  "data:application",
  "expression(",
  "behavior:",
  "-moz-binding",
  "@import",
  "@charset",
  "<script",
  "</",
  "eval(",
  // a backslash starts a css escape sequence (\6a -> "j"), which can spell a
  // blocked keyword that no substring check can see
  "\\",
  // declaration / rule breakout
  "{",
  "}",
  // comment splitting
  "/*",
  "*/",
];

// one url(...) token, quoted or bare
const URL_TOKEN = /url\(\s*(['"]?)([^'")]*)\1\s*\)/g;

// the only schemes a style value may fetch from
const SAFE_URL =
  /^(https?:\/\/|\/|\.\/|\.\.\/|data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,)/i;

// drops c0 and c1 control characters, including the nul byte. written as a
// loop rather than a regex so the source stays free of literal control bytes.
function stripControlChars(value: string): string {
  let out = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20) continue;
    if (code >= 0x7f && code <= 0x9f) continue;
    out += value[index];
  }
  return out;
}

function urlsAreSafe(value: string): boolean {
  const opened = value.match(/url\(/gi)?.length ?? 0;
  if (opened === 0) return true;

  let parsed = 0;
  URL_TOKEN.lastIndex = 0;
  let match = URL_TOKEN.exec(value);
  while (match) {
    parsed += 1;
    if (!SAFE_URL.test(match[2].trim())) return false;
    match = URL_TOKEN.exec(value);
  }

  // an unbalanced or unparseable url( means we did not understand all of it
  return parsed === opened;
}

/**
 * validates a raw css value. returns the cleaned value, or undefined when the
 * value is missing or unsafe. a rejected value simply falls back to the default
 * style rather than throwing.
 */
export function css(input: unknown): string | undefined {
  // consumers are not always typescript users: anything but a string is refused
  if (typeof input !== "string") return undefined;
  if (input.length === 0 || input.length > MAX_LENGTH) return undefined;

  const value = stripControlChars(input).replace(/\s+/g, " ").trim();
  if (!value) return undefined;

  const lowered = value.toLowerCase();
  if (BLOCKED.some((blocked) => lowered.includes(blocked))) return undefined;
  if (!urlsAreSafe(lowered)) return undefined;

  // a semicolon may only survive inside a data: url, never in the value itself
  if (value.replace(URL_TOKEN, "").includes(";")) return undefined;

  return value;
}

/**
 * validates a css length. plain numbers are passed through untouched so react
 * appends "px" itself; strings go through the same guard as any other value.
 */
export function len(
  input: number | string | undefined
): number | string | undefined {
  if (input == null) return undefined;
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : undefined;
  }
  return css(input);
}

/** the first defined value, so long fallback chains stay readable. */
export function pick<T>(...values: Array<T | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}
