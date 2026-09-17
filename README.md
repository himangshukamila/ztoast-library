# ztoast

Toast notifications for React, with the icon and the styling passed straight into the call:

```tsx
toast.success("Project saved", <FiCheck />, { bgColor: "#052e16", width: 360 });
```

- **One component to mount, then call `toast.*` from anywhere** — including files that are not components.
- **Put a toast anywhere on screen** — nine named spots, an offset from any edge (`"top-10vh"`), or an exact coordinate.
- **Smooth by default** — every toast fades, slides, unblurs and scales in over half a second, and the stack glides closed when one leaves.
- **Countdown bar that pauses on hover**, on by default.
- **No CSS file to import, no runtime dependencies.**

---

## Contents

**Start here**
1. [Install](#1-install)
2. [Set it up](#2-set-it-up)
3. [Show a toast](#3-show-a-toast)
4. [The three arguments](#4-the-three-arguments)

**Do things with it**

5. [Icons](#5-icons) · 6. [Position](#6-position) · 7. [Styling](#7-styling) · 8. [Timing, progress bar and hover](#8-timing-progress-bar-and-hover) · 9. [Motion](#9-motion) · 10. [Promises](#10-promises) · 11. [Update or dismiss a toast](#11-update-or-dismiss-a-toast) · 12. [Call it outside React](#12-call-it-outside-react) · 13. [Set defaults for every toast](#13-set-defaults-for-every-toast)

**Look things up**

[Full options reference](#full-options-reference) · [Recipes](#recipes) · [Troubleshooting](#troubleshooting) · [Next.js and SSR](#nextjs-and-ssr) · [How it behaves](#how-it-behaves) · [Security](#security) · [For contributors](#for-contributors) · [Upgrading from 0.x](#upgrading-from-0x)

---

# Start here

## 1. Install

```bash
npm install ztoast
```

React 17 or newer. `react` and `react-dom` are peer dependencies; nothing else is installed.

## 2. Set it up

Render `<Toaster />` **once**, at the root of your app. That is the entire setup — no provider to wrap things in, no CSS to import.

```tsx
// App.tsx
import { Toaster } from "ztoast";

export default function App() {
  return (
    <>
      <YourApp />
      <Toaster />
    </>
  );
}
```

## 3. Show a toast

Import `toast` wherever you need it and call it. Nothing else is required.

```tsx
import { toast } from "ztoast";

toast.success("Project saved");
toast.error("Could not connect");
toast.warn("Login failed");
toast.info("Version 2.0 is available");
toast.loading("Uploading…");      // stays until you replace or dismiss it
toast.show("New message");        // neutral, no icon
```

That is all you need to use the library. Everything below is optional.

## 4. The three arguments

```
toast.success( message , icon , style )
                 ↑        ↑      ↑
             required  optional  optional
```

**Only the message is required.** Every key inside the style object is optional too.

```tsx
toast.success("Deployed");                                 // message
toast.success("Deployed", <FiCheck />);                    // + icon
toast.success("Deployed", <FiCheck />, { width: 360 });     // + style
toast.success("Deployed", { width: 360 });                 // style, no icon
```

The second argument works out which one you meant: an icon (a React element, a component, an emoji string) or the style object. So you never have to pass `null` to skip the icon.

| Argument | Accepts |
|---|---|
| `message` | Any text or JSX — `"Saved"`, `<span>Saved to <b>prod</b></span>` |
| `icon` | A React element, a component reference, an emoji string, or `false` for no icon |
| `style` | The options object — colours, size, position, duration, everything in the [reference](#full-options-reference) |

---

# Do things with it

## 5. Icons

Each variant has a built-in icon, so you only pass one when you want something different.

```tsx
toast.success("Saved");                    // built-in check
toast.success("Saved", <FiCheck />);       // your own element
toast.success("Saved", FiCheck);           // a component reference
toast.success("Saved", "🎉");              // an emoji
toast.success("Saved", false);             // no icon
toast.success("Saved", { icon: <FiCheck /> });   // same thing, inside the config
```

A component reference is called with `{ size: 18, color }`, which is what `react-icons`, `lucide-react` and `@heroicons/react` expect — so it picks up the variant colour automatically. Pass a rendered element instead if you want full control.

## 6. Position

Toasts appear **top right** by default. Three ways to change that:

**a. A named spot**

```tsx
toast.show("Down here", { position: "bottom-center" });
```

```
 top-left        top-center       top-right
center-left        center       center-right
bottom-left     bottom-center   bottom-right
```

Each sits 16px from the edges it touches.

**b. A distance from an edge** — `"<edge>-<distance>"`, in any CSS unit

```tsx
toast.show("10vh below the top",  { position: "top-10vh" });
toast.show("10vw in from the left", { position: "left-10vw" });
toast.show("Both edges",          { position: "bottom-24px right-5%" });
toast.show("Just the edge",       { position: "bottom" });       // default 16px inset
```

An axis you do not mention is **centred**, so `"top-10vh"` means 10vh down from the top, horizontally centred. Use two tokens when you want both axes. Units: `px`, `%`, `em`, `rem`, `vh`, `vw`, `dvh`, `svh`, `vmin`, `vmax`, `ch`, `pt`, `cm`, or a `calc(...)`; a bare number (`"top-40"`) means pixels.

**c. An exact coordinate**

```tsx
toast.show("Anywhere", { position: { x: "62%", y: "80%" } });
toast.show("Dead centre", { position: { x: "50%", y: "50%" } });
toast.show("From its own corner", { position: { x: 24, y: 120, anchor: "top-left" } });
```

`anchor` decides which point of the *toast* lands on the coordinate. It defaults to `center`, which is why `{ x: "50%", y: "50%" }` is the middle of the screen. Set it to any named spot to change that.

Toasts at the same spot stack together; different spots stack separately. New ones appear away from the anchor, so nothing already on screen moves. Flip with `stack: "up" | "down"`, space them with `gap`.

## 7. Styling

Plain option names. Numbers mean pixels. Nothing is a class name, so there is no CSS to override.

```tsx
toast.show("Custom", {
  textColor: "#e0e7ff",
  bgColor: "#1e1b4b",
  width: 380,
  height: 72,
  font: "Inter, sans-serif",
  radius: 18,
  padding: "14px 18px",
});
```

Useful to know:

- `bgColor` takes anything CSS `background` takes, so gradients and images work: `bgColor: "linear-gradient(135deg, #1e1b4b, #312e81)"`.
- `theme: "light"` switches the palette for anything you have not set yourself (`"dark"` is the default).
- `style` is the escape hatch for anything without its own option: `style: { backdropFilter: "blur(8px)" }`.
- Colours accept hex, `rgb()`, `hsl()`, `oklch()` and CSS variables: `textColor: "var(--brand-fg)"`.

Full list in the [reference](#style-options).

## 8. Timing, progress bar and hover

A toast lasts **4 seconds** and shows a progress bar counting that down. Hovering it — or tabbing into it — **freezes the bar and the timer** until you leave.

```tsx
toast.success("Uploaded", { duration: 8000 });        // longer
toast.show("Stays put",   { duration: Infinity });    // until dismissed
toast.show("No bar",      { progress: false });
toast.show("Never pauses",{ pauseOnHover: false });
toast.show("No X button", { closable: false });
```

A toast with `duration: Infinity` has no progress bar, because there is nothing to count down.

## 9. Motion

The defaults are tuned to feel unhurried, so you should not need this. If you do:

```tsx
toast.show("Slower, from further away", {
  motion: { enter: 900, exit: 500, slide: 40 },
});

toast.show("Plain fade", { motion: { slide: 0, blur: 0, scale: 1 } });
```

| Key | Default | What it does |
|---|---|---|
| `enter` / `exit` | `520` / `340` | Duration in ms |
| `slide` | `22` | How far it travels in, in px |
| `scale` | `0.94` | Size it grows from |
| `blur` | `2` | Blur it sharpens from, in px |
| `from` | `"auto"` | Direction: `auto` follows the position, or `top` / `bottom` / `left` / `right` / `none` |
| `easing` / `exitEasing` | expo-out / ease-out | Any CSS easing function |

If the operating system asks for reduced motion, the travel, scale and blur are dropped automatically.

## 10. Promises

Show a loading toast, then swap it for the result in the same spot.

```tsx
await toast.promise(
  deploy(),
  {
    loading: "Deploying…",
    success: (data) => `Live at ${data.url}`,
    error: (err) => `Failed: ${err.message}`,
  },
  { duration: 5000 }   // optional, applies to the result toast
);
```

`success` and `error` take either text or a function of the result. The original promise is returned, so `await` and `.catch()` behave exactly as they would without the toast.

## 11. Update or dismiss a toast

Give a toast an `id` and call again with the same one to replace it in place — it keeps its spot in the stack and restarts its countdown.

```tsx
toast.loading("Uploading…", { id: "upload" });
// later
toast.success("Upload complete", { id: "upload" });
```

Every call also returns the id, so you can hold on to it:

```tsx
const id = toast.loading("Working…");
toast.dismiss(id);      // dismiss that one
toast.dismiss();        // dismiss everything
toast.dismissAll();     // same thing, spelled out
```

## 12. Call it outside React

`toast` is not a hook, so any file can use it — API clients, interceptors, stores. A toast fired before `<Toaster />` has mounted waits and appears when it does.

```ts
import { toast } from "ztoast";

export async function api(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    toast.error("Request failed", { description: `HTTP ${res.status}` });
  }
  return res.json();
}
```

If you want to read the live list inside a component, `useToast()` gives you that (and works anywhere in the tree):

```tsx
const { toasts, dismissAll } = useToast();
return <span>{toasts.length} notifications</span>;
```

## 13. Set defaults for every toast

Any option can go on `<Toaster />` instead, and applies to every toast. A toast's own options always win.

```tsx
<Toaster
  position="bottom-right"
  duration={6000}
  theme="light"
  radius={10}
  gap={18}
  max={3}            // show 3 at a time; the rest queue up
/>
```

---

# Full options reference

Everything here is optional. Every option can also go on `<Toaster />` as a default for all toasts, except `id`, `description` and `onClose`, which only make sense per toast.

### Behaviour

| Option | Default | |
|---|---|---|
| `id` | auto | Reuse to replace a toast in place. Per toast only |
| `duration` | `4000` | ms before it dismisses itself; `Infinity` to keep it |
| `description` | — | Second line, under the message. Per toast only |
| `icon` | variant icon | Element, component, emoji, or `false` |
| `closable` | `true` | Show the ✕ button |
| `progress` | `true` | Show the countdown bar |
| `pauseOnHover` | `true` | Freeze the countdown on hover or focus |
| `onClose` | — | Called once, when the toast starts leaving. Per toast only |

### Placement

| Option | Default | |
|---|---|---|
| `position` | `"top-right"` | Named spot, edge offset (`"top-10vh"`), or `{ x, y, anchor }` |
| `gap` | `14` | px between stacked toasts |
| `stack` | from position | `"down"` or `"up"` |
| `zIndex` | `2147483000` | Container z-index |

### Style options

| Option | Default | |
|---|---|---|
| `textColor` (or `color`) | theme text | |
| `bgColor` (or `background`) | theme surface | Colour, gradient, or `url(…)` |
| `width` / `height` | fits content | Without `width` it sits between 240px and `min(92vw, 440px)`; setting `width` replaces that range exactly |
| `font` | system stack | Font family |
| `fontSize` / `fontWeight` | `14` / `600` | |
| `radius` | `14` | Corner radius |
| `padding` | `"13px 15px"` | |
| `border` | theme hairline | |
| `shadow` | theme shadow | |
| `progressColor` | variant colour | Progress bar fill |
| `iconColor` | variant colour | Built-in icon colour |
| `theme` | `"dark"` | `"dark"` or `"light"` |
| `style` | — | Raw `CSSProperties`, merged over everything else |
| `motion` | [see above](#9-motion) | |

### `<Toaster />` only

| Prop | Default | |
|---|---|---|
| `max` | unlimited | How many to show per position; the rest queue and appear as room frees up |

### The `toast` object

| Call | |
|---|---|
| `toast.success(message, icon?, config?)` | Green check |
| `toast.error(…)` | Red cross, announced to screen readers as an alert |
| `toast.info(…)` | Blue info |
| `toast.warning(…)` / `toast.warn(…)` | Amber triangle — same thing, two spellings |
| `toast.loading(…)` | Spinner, persists until replaced or dismissed |
| `toast.show(…)` | Neutral, no icon |
| `toast.promise(promise, messages, config?)` | Loading → result, in place |
| `toast.dismiss(id?)` | One toast, or all of them |
| `toast.dismissAll()` | All of them |

Every creator returns the toast's id, so you can dismiss or replace it later. `toast.promise` returns your promise instead.

### TypeScript

```ts
import type { ToastConfig, ToastPosition, ToasterProps } from "ztoast";
```

Also exported: `ToastIcon`, `ToastMotion`, `NamedPosition`, `EdgeOffsetPosition`, `FreePosition`, `ToastRecord`, `ToastVariant`, `PromiseMessages`.

---

# Recipes

**Brand-coloured success toast**

```tsx
toast.success("Payment received", <FiCheck />, {
  bgColor: "linear-gradient(135deg, #064e3b, #022c22)",
  textColor: "#ecfdf5",
  progressColor: "#34d399",
  radius: 18,
  width: 360,
});
```

**Centred modal-style notice that waits for the user**

```tsx
toast.info("Session expiring", {
  description: "You will be signed out in 2 minutes.",
  position: { x: "50%", y: "50%" },
  duration: Infinity,
  width: 420,
});
```

**A toast tucked under a fixed header**

```tsx
<Toaster position="top-88px" />
```

**Bottom-left, one at a time, light theme**

```tsx
<Toaster position="bottom-left" max={1} theme="light" />
```

**Form validation error next to the form**

```tsx
toast.warn("Check the highlighted fields", { position: "left-20vw" });
```

---

# Troubleshooting

**Nothing appears.** No `<Toaster />` is mounted. Render it once at the root; the console tells you this in development.

**My toast is in the wrong place.** If `position` is a string that cannot be parsed (a typo like `"tpo-10vh"`), it falls back to `top-right` and warns in the console. Remember that an edge offset centres the axis you did not mention.

**Part of my toast is off screen.** Coordinates are not clamped — `{ x: "99%", y: "50%" }` with the default `center` anchor hangs off the right edge. That is intentional; use an edge offset like `"right-16px"` when you want it kept inside.

**A colour or shadow is ignored.** It failed the CSS guard and the default was used instead. Values containing `;`, `{`, `}`, a backslash, a comment, or a `url()` that is not https / relative / `data:image` are rejected — see [Security](#security).

**No progress bar.** The toast's `duration` is `Infinity` (which is what `toast.loading` uses), so there is nothing to count down.

**It is hidden behind my modal.** The container already uses a near-maximum `z-index`, so the modal is in a different stacking context. Raise it with `zIndex`, or render the modal before `<Toaster />`.

**Toasts pile up during a burst.** Use `max` on `<Toaster />`; the extras queue and appear as room frees up.

---

# Next.js and SSR

The build carries a `"use client"` banner, so you can import `<Toaster />` straight into a server component:

```tsx
// app/layout.tsx
import { Toaster } from "ztoast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
```

It renders nothing on the server and nothing on the first client render, mounting its portal in an effect, so there is no hydration mismatch.

---

# How it behaves

Details that are useful when something surprises you.

**Motion.** Each card sits in a wrapper that animates `grid-template-rows` from `0fr` to `1fr`, so heights are never measured in JavaScript and the stack settles smoothly when a toast leaves. The gap between toasts lives inside that collapsing box, so it closes with the toast instead of leaving a hole. Where `fr` interpolation is unsupported the height snaps while the fade, slide and scale still play.

**Timing.** The countdown starts on the first painted frame, not on mount, so the bar and the toast stay in step. It lives in the card, the only place that knows whether the pointer or keyboard is resting on it.

**Dismissal.** Dismissing marks the toast as leaving; it is removed from state once its exit animation has finished. Re-adding the same `id` cancels a pending removal, so `dismiss(id)` followed immediately by another call with that `id` keeps the new toast.

**`onClose`.** Fires exactly once, when the toast starts leaving. A callback that throws is caught and reported in development instead of breaking the toast.

**Accessibility.** Error toasts are `role="alert"` / `aria-live="assertive"`; everything else is `role="status"` / `aria-live="polite"`. Icons are hidden from screen readers, the ✕ has a label, and focusing it pauses the countdown so a toast cannot vanish mid-tab.

**Invalid values.** An unusable `duration` (`NaN`, negative, not a number) becomes "keep until dismissed" rather than dismissing instantly. An unparseable position falls back to `top-right`. A rejected style value falls back to the default.

---

# Security

The library never uses `dangerouslySetInnerHTML` and never injects a `<style>` tag. Your `message`, `description` and `icon` are React nodes, so text is escaped for you.

The one surface worth guarding is the styling API, since a value could have come from user data. Every raw CSS string passes through [`src/css.ts`](src/css.ts) first. React assigns style values through the CSSOM, where an invalid value is dropped by the browser rather than parsed as new declarations — so this is validation, not escaping, and what it blocks is narrow:

- Anything that can execute: `javascript:`, `vbscript:`, `expression(`, `eval(`, `behavior:`, `-moz-binding`, `@import`, `@charset`, `<script`, `</`.
- **Backslashes**, because a CSS escape (`\6a avascript:`) can spell a blocked keyword that no substring check sees.
- Declaration breakout: `;`, `{`, `}`, and comment markers in any state.
- `url(…)` pointing anywhere other than `http(s)://`, a relative path, or `data:image/…;base64`. An unparseable `url(` is refused outright.
- Control characters, non-strings, and anything over 600 characters.

Everything else passes through untouched, which is why `"10px 18px"`, `rgb(0 0 0 / 50%)`, `clamp(280px, 40vw, 420px)` and multi-layer shadows all work.

Not covered: JSX you render into `message`, `description` or `icon` is yours to vouch for, and `bgColor` allows remote URLs by design.

---

# For contributors

```
src/                    the library
  index.ts              public entry point, the only exported surface
  store.ts              the toast list, argument handling, promise tracking
  Toaster.tsx           subscribes, merges defaults, groups by position, portals
  Toast.tsx             one card: motion, countdown, pause, progress bar
  placement.ts          position -> container geometry, stack and slide direction
  icons.tsx             built-in icons, consumer icon rendering
  css.ts                the security boundary
  useToast.ts           live list subscription
  types.ts              public types
tests/
  css.test.ts           the security boundary, value by value
  integration.test.tsx  rendering, placement, countdown, promises, lifecycle
```

Requires Node 22.12+ (a Vitest 5 requirement; the published package has no Node requirement of its own).

```bash
npm run typecheck   # tsc --noEmit, over src and tests
npm test            # vitest run
npm run build       # tsup -> dist (esm + cjs + .d.ts)
```

Nine devDependencies, no runtime dependencies, `npm audit` clean. Two things not to trip over:

- Do not enable `treeshake` in [`tsup.config.ts`](tsup.config.ts) — it pipes the bundle through rollup, which strips the `"use client"` banner.
- `overrides.esbuild` in `package.json` pins esbuild to `^0.28.2`. tsup 8.5.1 asks for `^0.27.0`, and every 0.27 release from 0.27.3 on carries [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr). Drop the override once tsup widens its range.

---

# Upgrading from 0.x

The provider pair is gone, and the option names are shorter.

| 0.x | 1.0 |
|---|---|
| `<ToastProvider>…<ToastViewport /></ToastProvider>` | `<Toaster />` |
| `defaultPosition` / `defaultDuration` / `defaultProgressBar` | `position` / `duration` / `progress` |
| `toast.show(msg, { icon: <I /> })` | `toast.show(msg, <I />)` — the object form still works |
| `background` / `borderRadius` / `boxShadow` / `progressBar` | `bgColor` / `radius` / `shadow` / `progress` |
| `{ position: "top-center", top: "50vh" }` | `{ position: "top-50vh" }` |
| `{ offset: { bottom: 40, right: 32 } }` | `{ position: "bottom-40px right-32px" }` |
| `progressBar` off by default | `progress` on by default |
| `useToast()` throws outside a provider | `useToast()` works anywhere |

---

MIT — see [LICENSE](LICENSE). Demo and docs site: [ztoast.onrender.com](https://ztoast.onrender.com) (still showing the 0.x API).
