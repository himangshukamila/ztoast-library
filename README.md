# ztoast

A modern, lightweight, zero-runtime-dependency toast notification library for React.

**[Live Documentation & Interactive Demo](https://ztoast.onrender.com)**

Built around a sleek dark popover aesthetic, a countdown progress bar that stays synchronized with a pause-on-hover timer, first-class promise lifecycle handling, and a strict allowlist sanitizer on every raw CSS value a consumer can pass in.

- **No runtime dependencies.** `react` and `react-dom` are peer dependencies; nothing else is shipped.
- **No stylesheet to import.** Every style is an inline style object, so there is no CSS file, no `<style>` injection, and nothing to configure in your bundler.
- **Call it from anywhere.** `toast.success(...)` works inside components *and* from plain modules such as API clients and fetch interceptors.
- **Dual ESM + CJS build** with full TypeScript declarations and a `"use client"` banner for the Next.js App Router.

---

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Usage guide](#usage-guide)
  - [Variants and descriptions](#1-variants-and-descriptions)
  - [Progress bar and pause-on-hover](#2-progress-bar-and-pause-on-hover)
  - [Promises](#3-promises-toastpromise)
  - [Updating a toast in place](#4-updating-a-toast-in-place)
  - [Calling from outside React](#5-calling-from-outside-react)
  - [Styling and theming](#6-styling-and-theming)
  - [Positioning and coordinates](#7-positioning-and-coordinates)
  - [The useToast hook](#8-the-usetoast-hook)
- [API reference](#api-reference)
- [Behaviour details](#behaviour-details)
- [Security model](#security-model)
- [Implementation notes](#implementation-notes)
- [Server-side rendering and Next.js](#server-side-rendering-and-nextjs)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Browser support](#browser-support)
- [License](#license)

---

## Installation

```bash
npm install ztoast
# or
pnpm add ztoast
# or
yarn add ztoast
```

Requires React 17 or newer (`react` and `react-dom` are peer dependencies).

---

## Quick start

Mount `<Toaster />` **once**, at the root of your app (`App.tsx`, `main.tsx`, or the Next.js root `layout.tsx`). Everything else is imperative.

```tsx
import { Toaster, toast } from "ztoast";

export function App() {
  return (
    <>
      <MainContent />
      {/* mount once, at the root */}
      <Toaster defaultPosition="top-right" defaultDuration={4000} defaultProgressBar />
    </>
  );
}

function MainContent() {
  return (
    <button onClick={() => toast.success("Project saved successfully")}>
      Save project
    </button>
  );
}
```

If you would rather control where the toasts are portalled from, compose the two primitives yourself. `<Toaster />` is nothing more than this pairing:

```tsx
import { ToastProvider, ToastViewport } from "ztoast";

<ToastProvider defaultPosition="bottom-right">
  <App />
  <ToastViewport />
</ToastProvider>
```

Mount **one** provider per app. A second provider takes over the imperative `toast.*` API while it is mounted.

---

## Usage guide

### 1. Variants and descriptions

Six variants ship with inline SVG icons — no icon package required.

```tsx
toast.success("Profile updated", { description: "Your preferences have been saved." });
toast.error("Deployment failed", { description: "Check your build logs for details." });
toast.info("Update available", { description: "Version 2.0 is ready to download." });
toast.warning("Low disk space", { description: "Less than 10% storage remaining." });
toast.loading("Uploading assets…");   // persists until dismissed or replaced
toast.show("New message received");   // neutral / default variant
```

`message` and `description` accept any `ReactNode`, so you can pass JSX:

```tsx
toast.info(<span>Deployed to <strong>production</strong></span>);
```

### 2. Progress bar and pause-on-hover

```tsx
toast.success("File uploaded", { duration: 6000, progressBar: true });
```

The bar fills from 0% to 100% over the toast's lifetime. When the pointer enters the toast — or when keyboard focus lands inside it — the dismiss timer pauses and the bar freezes at the exact current percentage. On mouse leave or blur, both resume from that point over the remaining time.

Enable it for every toast at once:

```tsx
<Toaster defaultProgressBar />
```

Toasts with `duration: Infinity` never show a progress bar, because there is nothing to count down.

### 3. Promises (`toast.promise`)

Shows a loading toast immediately, then replaces it in place with the success or error result.

```tsx
await toast.promise(
  deployProject(),
  {
    loading: "Deploying application…",
    success: (data) => `Deployed to ${data.url}`,
    error: (err) => `Deployment failed: ${err.message}`,
  },
  { position: "bottom-right", progressBar: true, duration: 5000 }
);
```

- The loading toast is always persistent (`duration: Infinity`); the result toast uses `options.duration`, defaulting to `4000`.
- `success` and `error` accept either a `ReactNode` or a callback.
- The **original** promise is returned, so `await`/`.catch()` behave exactly as they would without the toast. ztoast attaches its own rejection handler, so tracking a promise never produces a spurious "unhandled rejection" warning — but you still need to handle the rejection yourself if you care about it.

### 4. Updating a toast in place

Pass an explicit `id` and call again. The existing toast is replaced rather than duplicated, and its countdown restarts.

```tsx
const id = "upload-status";

toast.loading("Uploading…", { id });
// later
toast.success("Upload complete", { id, duration: 3000 });
```

### 5. Calling from outside React

The store is a module-level singleton, so any module can trigger a toast — no hook, no context, no prop drilling:

```ts
import { toast } from "ztoast";

export async function apiClient(endpoint: string, options?: RequestInit) {
  try {
    const res = await fetch(endpoint, options);
    if (!res.ok) {
      toast.error("Request failed", { description: `HTTP ${res.status}` });
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    toast.error("Connection failed", { description: "Could not reach the server." });
    throw error;
  }
}
```

If a toast is fired before any provider has mounted, it is dropped and a single development-only console warning is emitted.

### 6. Styling and theming

Every toast can be styled individually. Each raw CSS string is validated before it reaches the DOM (see [Security model](#security-model)); anything that fails validation is silently dropped and the default style is kept.

```tsx
toast.show("Custom announcement", {
  position: "top-center",
  duration: 5000,
  progressBar: true,
  backgroundGradient: "linear-gradient(135deg, #1e1b4b, #312e81)",
  borderColor: "#6366f1",
  borderRadius: 14,
  boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.4)",
  textColor: "#e0e7ff",
  progressColor: "#818cf8",
  fontFamily: "Inter, sans-serif",
  width: 380,
  closable: true,
});
```

Numbers are treated as pixels (`borderRadius: 14` → `14px`). CSS custom properties work anywhere a colour is accepted: `textColor: "var(--brand-fg)"`.

Replace the icon entirely with `icon`:

```tsx
toast.show("Synced", { icon: <MyIcon /> });
```

### 7. Positioning and coordinates

Six anchors are supported: `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`. Beyond those, you can pin a toast to arbitrary viewport coordinates.

```tsx
// vertically centred
toast.info("Centered notification", { position: "top-center", top: "50vh" });

// custom offsets from the anchored corner
toast.success("Nudged inwards", {
  position: "bottom-right",
  offset: { bottom: "40px", right: "32px" },
});

// exact placement with a transform
toast.show("Middle of the screen", {
  top: "50vh",
  left: "50%",
  transform: "translate(-50%, -50%)",
});
```

Defaults for every toast can be set on the root component:

```tsx
<Toaster defaultPosition="top-center" top="50vh" gap={16} />
```

Resolution order for each coordinate, first defined wins:

`toast.<edge>` → `toast.offset.<edge>` → `toast.offset.x|y` → `provider.<edge>` → `provider.offset.<edge>` → `provider.offset.x|y` → `16px` default inset.

`offset.x` only feeds the horizontal edge the position is anchored to, and `offset.y` only the vertical one, so a shorthand offset never accidentally stretches the container across the screen.

### 8. The `useToast` hook

For reading live state or doing bulk operations from inside a component:

```tsx
import { useToast } from "ztoast";

function NotificationCenter() {
  const { toasts, show, dismiss, dismissAll } = useToast();

  return (
    <div>
      <p>Active notifications: {toasts.length}</p>
      <button onClick={dismissAll}>Clear all</button>
    </div>
  );
}
```

`useToast()` must be called inside a `<ToastProvider>` (or `<Toaster>`); it throws otherwise.

---

## API reference

### `toast`

| Method | Signature | Notes |
|---|---|---|
| `toast.show` | `(message, options?) => string \| number` | Neutral variant |
| `toast.success` | `(message, options?) => string \| number` | |
| `toast.error` | `(message, options?) => string \| number` | Rendered with `role="alert"` / `aria-live="assertive"` |
| `toast.info` | `(message, options?) => string \| number` | |
| `toast.warning` | `(message, options?) => string \| number` | |
| `toast.loading` | `(message, options?) => string \| number` | Defaults to `duration: Infinity` |
| `toast.promise` | `(promise, messages, options?) => Promise<T>` | Returns the original promise |
| `toast.dismiss` | `(id) => void` | Plays the exit animation, then removes |
| `toast.dismissAll` | `() => void` | Clears immediately, firing every `onClose` |

Each creator returns the toast id — keep it to update or dismiss the toast later.

### `<Toaster />` and `<ToastProvider>` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `defaultPosition` | `ToastPosition` | `"top-right"` | Anchor used when a toast does not specify one |
| `defaultDuration` | `number` | `4000` | Auto-dismiss duration in ms |
| `defaultProgressBar` | `boolean` | `false` | Show the countdown bar on every toast |
| `gap` | `number` | `12` | Pixel spacing between stacked toasts |
| `offset` | `ToastOffsetOptions` | `undefined` | Default coordinate offsets (`top`, `bottom`, `left`, `right`, `x`, `y`) |
| `top` / `bottom` / `left` / `right` | `number \| string` | `undefined` | Default screen coordinates (`"50vh"`, `"24px"`, `32`) |
| `children` | `ReactNode` | — | Required on `ToastProvider`, optional on `Toaster` |

`<Toaster />` forwards every prop straight through to `<ToastProvider>` and renders `<ToastViewport />` for you, so the defaults live in exactly one place.

### `ToastOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `id` | `string \| number` | auto | Reuse to update a toast in place |
| `variant` | `ToastVariant` | `"default"` | Set automatically by the `toast.*` helpers |
| `description` | `ReactNode` | — | Secondary line under the title |
| `position` | `ToastPosition` | provider default | Anchor position |
| `duration` | `number` | provider default | ms; `Infinity` persists until dismissed |
| `closable` | `boolean` | `true` | Show the dismiss button |
| `progressBar` | `boolean` | provider default | Show the countdown bar |
| `progressColor` | `string` | variant accent | Progress bar fill colour |
| `icon` | `ReactNode` | variant icon | Replaces the built-in icon |
| `onClose` | `() => void` | — | Fired exactly once, when the toast is dismissed |
| `offset` | `ToastOffsetOptions` | — | Structured coordinate offsets |
| `top` / `bottom` / `left` / `right` | `number \| string` | — | Viewport coordinates |
| `transform` | `string` | — | CSS transform on the viewport container |
| `width` / `height` | `number \| string` | — | Custom dimensions |
| `padding` | `number \| string` | `14px 16px` | Inner spacing; a single value only (`16`, `"1rem"`) — multi-value shorthands are rejected |
| `background` | `string` | `#18181b` | Solid background colour |
| `backgroundGradient` | `string` | — | `linear`/`radial`/`conic-gradient(...)` |
| `backgroundImage` | `string` | — | `url(...)` — https, relative, or `data:image/*;base64` |
| `textColor` | `string` | `#f4f4f5` | Text colour |
| `fontFamily` | `string` | system stack | Font stack |
| `fontSize` / `fontWeight` | `number \| string` | `14px` / `600` | Typography |
| `border` | `string` | `1px solid #27272a` | Border shorthand (`"2px dashed #333"`) |
| `borderColor` / `borderWidth` | `string` / `number \| string` | — | Applied after the shorthand |
| `borderRadius` | `number \| string` | `14px` | Corner radius |
| `boxShadow` | `string` | popover shadow | Drop shadow |

### Exported types

`ToastOptions`, `ToastPosition`, `ToastVariant`, `ToastStyleOptions`, `ToastOffsetOptions`, `ToastProviderProps`, `ToastRecord`, `PromiseToastMessages`, `ToasterProps`, `ToastContextValue`.

---

## Behaviour details

**Timing.** The countdown is owned by the `<Toast />` component — the only place that knows whether the user is currently hovering or focusing it. The provider never runs a competing timer, so a paused toast is genuinely paused.

**Dismissal.** `dismiss` marks the record `isLeaving`, which drives a 200 ms opacity/scale transition; the record is dropped from state when the transition ends. Re-adding a toast with the same id cancels any pending removal, so `dismiss(id)` immediately followed by `show(..., { id })` behaves the way you would expect.

**`onClose`.** Fired exactly once per dismissal, from an event handler rather than from inside a state updater, so React StrictMode's double-invoked updaters cannot fire it twice. A throwing `onClose` is caught and warned about in development instead of breaking the lifecycle.

**Stacking.** Toasts are grouped by their resolved container geometry, and each group is rendered into one fixed-position flex container. Bottom anchored groups use `column-reverse`, so new toasts always stack away from the screen edge. The container itself is `pointer-events: none`; only the toast cards are interactive, so an empty viewport never blocks clicks.

**Invalid durations.** A `NaN`, negative, or non-numeric duration is normalized to "persist until dismissed" rather than dismissing instantly.

**Accessibility.** Error toasts render as `role="alert"` / `aria-live="assertive"`; everything else is `role="status"` / `aria-live="polite"`, with `aria-atomic="true"`. Icons are `aria-hidden`, and the dismiss button carries an `aria-label`. Focusing the dismiss button pauses the countdown, so a toast cannot vanish out from under a keyboard user mid-tab.

---

## Security model

The library never uses `dangerouslySetInnerHTML` and never injects a `<style>` tag. `message`, `description`, and `icon` are `ReactNode`s rendered by React, so text is escaped for you.

The one attack surface is the styling API: a `ToastOptions` value that originated from user data could try to smuggle CSS. Every raw CSS string therefore goes through [`sanitize.ts`](sanitize.ts), the library's single security boundary, before it reaches a style object.

**Method: allowlist, not denylist.** Each value must match a narrow pattern for its own property. Anything that does not match is dropped, and the built-in default is used instead. Denylists were deliberately avoided — they always miss a variant.

Validated properties: `background`, `backgroundGradient`, `backgroundImage`, `textColor`, `progressColor`, `borderColor`, `border`, `boxShadow`, `fontFamily`, `fontWeight`, `width`, `height`, `padding`, `borderWidth`, `borderRadius`, `fontSize`, `top`, `bottom`, `left`, `right`, and `transform`.

| Validator | Accepts |
|---|---|
| `sanitizeColor` | `#hex`, `rgb()/rgba()`, `hsl()/hsla()`, `oklch()`, `oklab()`, `var(--name)`, bare named colours |
| `sanitizeGradient` | `linear-`, `radial-`, `conic-gradient(...)` over an alphanumeric/percent/comma character set |
| `sanitizeBackgroundImage` | `url()` limited to `http(s)://`, root/relative paths, or `data:image/{png,jpeg,jpg,gif,webp,svg+xml};base64,` |
| `sanitizeFontFamily` | Letters, digits, spaces, hyphens, commas and quotes, max 200 chars |
| `sanitizeBorderShorthand` | `<length> <line-style>` with an optional colour tail that is itself run through `sanitizeColor` |
| `sanitizeDimension` | A signed number with a known unit, `auto`, `0`, or a conservative `calc()` |
| `sanitizeTransform` | An allowlisted set of transform functions with numeric arguments, tokenized and checked one function at a time |
| `sanitizeBoxShadow` | Lengths, colours and the `inset` keyword, max 300 chars |

Rejected across the board, before any pattern matching runs:

- `javascript:`, `vbscript:`, `data:text/html`, `data:application`, `expression(`, `behavior:`, `-moz-binding`, `@import`, `@charset`, `<script`, `</`, `eval(`, and NUL bytes.
- **Backslashes**, because a CSS escape sequence (`\6a avascript:`) can spell a blocked keyword that no substring check can see.
- Comments, which are stripped in a bounded loop first; a leftover `/*` or `*/` means the value is rejected outright.
- `{`, `}` and `;` (the last one only allowed inside a well-formed `data:image/…;base64` URL), which blocks declaration and rule breakout.
- Control characters, which are stripped, and runs of whitespace, which are collapsed.
- Non-string values from untyped JavaScript callers, and any value over 500 characters (200 for font stacks, 300 for shadows).

**ReDoS.** Every pattern is written to stay linear on its input: no quantifier nested over an overlapping character class, and the length cap is applied before any regex touches the value. The transform validator tokenizes the value and checks one `name(args)` token at a time rather than matching a whitespace-separated chain in a single ambiguous pattern.

**What this does not cover.** If you render your own JSX into `message`, `description`, or `icon`, its safety is yours to guarantee — passing `dangerouslySetInnerHTML` inside a custom node bypasses everything above. `backgroundImage` also permits remote URLs by design; if the URL comes from user input, that is an outbound request the user controls.

---

## Implementation notes

| File | Role |
|---|---|
| [`index.ts`](index.ts) | Public entry point; the only exported surface |
| [`toastStore.ts`](toastStore.ts) | Module-level singleton holding the mounted provider's handlers, plus the imperative `toast` object and `toast.promise` |
| [`ToastProvider.tsx`](ToastProvider.tsx) | Owns toast state, ids, exit timers and `onClose` callbacks; publishes context |
| [`ToastViewport.tsx`](ToastViewport.tsx) | Resolves coordinates, groups toasts by container geometry, portals into `document.body` |
| [`Toast.tsx`](Toast.tsx) | A single toast card: countdown, pause/resume, progress bar, icons, dismiss button |
| [`Toaster.tsx`](Toaster.tsx) | Provider + viewport in one drop-in component |
| [`useToast.ts`](useToast.ts) | Hook access to live toasts and bulk actions |
| [`resolveStyle.ts`](resolveStyle.ts) | Turns `ToastStyleOptions` into a sanitized `CSSProperties` object |
| [`sanitize.ts`](sanitize.ts) | The security boundary: allowlist validators for every raw CSS value |
| [`types.ts`](types.ts) | Public type definitions |

**Why a module-level store?** `toast.success(...)` has to work from files that are not components. The provider registers its handlers into the store on mount and removes them on unmount — but only if the slot still points at its own handlers, so unmounting a second provider cannot silently disable the first.

**Why inline styles instead of CSS?** Shipping a stylesheet would force consumers to import it and would give a CSS injection a place to land. Style objects go through the CSSOM, where an invalid value is dropped by the browser rather than being parsed as new declarations, which makes the sanitizer's job a validation problem rather than an escaping problem.

**Rendering.** One portal into `document.body` per provider, containing one fixed container per distinct geometry, `z-index: 2147483647`.

---

## Server-side rendering and Next.js

The build carries a `"use client"` banner, so `import { Toaster } from "ztoast"` works directly from an App Router server component:

```tsx
// app/layout.tsx
import { Toaster } from "ztoast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster defaultPosition="bottom-right" />
      </body>
    </html>
  );
}
```

`<ToastViewport />` renders nothing on the server and nothing on the first client render; it mounts its portal in an effect. That keeps server and client markup identical and avoids hydration mismatches in Next.js, Remix and any other SSR framework.

---

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run test:watch  # vitest in watch mode
npm run build       # tsup -> dist/ (esm + cjs + .d.ts + sourcemaps)
npm run dev         # tsup --watch
```

`prepublishOnly` runs typecheck, tests and build, so a broken build cannot be published.

Tests live next to the source:

- [`sanitize.test.ts`](sanitize.test.ts) — validator behaviour and injection defence (escape sequences, comment splitting, oversized input, non-string input, transform tokenization).
- [`integration.test.tsx`](integration.test.tsx) — rendering, dismissal, in-place updates, promises, progress bar, positioning, hover pausing, `onClose` semantics, and id reuse.

Build output is `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts` / `dist/index.d.cts`, plus sourcemaps. Do not enable `treeshake` in [`tsup.config.ts`](tsup.config.ts) — it pipes the bundle through rollup, which strips the `"use client"` banner.

---

## Troubleshooting

**"toast() was called before a `<ToastProvider>` mounted"** — nothing rendered `<Toaster />` (or `<ToastProvider>` + `<ToastViewport />`), or the toast fired during module evaluation, before React mounted. The warning is emitted once, in development only.

**A custom colour or shadow is ignored** — it failed sanitization and was dropped. Check it against the [Security model](#security-model) table; `rgb(0 0 0 / 50%)` style space-separated syntax, `!important`, and anything containing a backslash or semicolon are not accepted.

**Toasts appear behind a modal** — the viewport already uses the maximum `z-index`. The modal is most likely in a different stacking context; render it before the toaster in the DOM or lower its own `z-index`.

**`useToast()` throws** — it was called outside the provider tree. `<Toaster />` renders its provider internally, so components that call `useToast()` must be *inside* it, not siblings of it.

---

## Browser support

Any browser with `Element.prototype.style`, `requestAnimationFrame` and portal support — all evergreen browsers. The build targets ES2020.

---

## License

MIT — see [LICENSE](LICENSE).
