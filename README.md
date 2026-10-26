# ztoast

Toast notifications for React, with the icon and the styling passed straight into the call:

```tsx
toast.success("Project saved", {
  description: "Your changes have been saved.",
  bgColor: "#052e16",
});
```

- **A notch for the icon and heading**, with a wider description panel that opens away from the screen edge.
- **One component to mount, then call `toast.*` from anywhere** — including files that are not components.
- **Put a toast anywhere on screen** — nine named spots, an offset from any edge (`"top-10vh"`), or an exact coordinate.
- **Smooth by default** — the notch arrives first, unfolds into the description, then folds back before fading away on dismissal.
- **Countdown bar that pauses on hover**, on by default.
- **No CSS file to import, no runtime dependencies.**

## What's new in 0.1.11

- The icon and heading share one notch. It follows left, center, or right placement, and bottom toasts open upward.
- Omit `description` for a fully rounded pill. Add text, images, or a React component for an expanding description panel.
- Panels fit their content with centered text and compact side padding. Light and dark themes use thin, variant-colored borders; gradients still cover the whole shape.
- Opening takes **500ms** by default. Closing folds the description into the pill, holds it for **2000ms**, then squeezes both ends toward the center while fading. Closing movement takes **450ms**, separate from the hold.
- The X button is now **opt-in** with `closable: true`. Automatic dismissal still starts after `duration`, which defaults to **4000ms**.
- The local playground includes layout, JSX, icon, background, position, and animation controls with matching code examples.
- Release fixes include CommonJS TypeScript declaration resolution, `React.createElement(Toaster, options)` typing, and safe same-ID replacements created inside `onClose`. Custom icon references wrapped in `memo` or `forwardRef` now work in both call forms.

Existing users should review the [upgrade notes](#upgrading-to-the-notch-design), especially the dismiss-button and timing defaults.

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

[Full options reference](#full-options-reference) · [Recipes](#recipes) · [Troubleshooting](#troubleshooting) · [Next.js and SSR](#nextjs-and-ssr) · [How it behaves](#how-it-behaves) · [Security](#security) · [For contributors](#for-contributors) · [Upgrade notes](#upgrading-to-the-notch-design)

---

# Start here

## 1. Install

```bash
npm install ztoast
```

React 17 or newer. `react` and `react-dom` are peer dependencies; the library has no other runtime dependencies. The package declares Node 18 or newer for tooling that checks `engines`.

## 2. Set it up

Render `<Toaster />` **once**, at the root of your app. That is the entire setup — no provider to wrap things in, no CSS to import.

```tsx
// App.tsx
import { Toaster, toast } from "ztoast";

export default function App() {
  return (
    <>
      <button
        type="button"
        onClick={() => toast.success("Saved successfully", {
          description: "Your changes have been saved.",
          duration: 4000,
          closable: true,
        })}
      >
        Save changes
      </button>
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

### The notch layout

The first argument is the heading in the notch. Use `description` for the text in the wider panel:

```tsx
toast.success("Saved successfully", {
  description: "Your changes have been saved. You’re all set.",
});
```

The icon and heading appear first, then the description panel unfolds smoothly. The notch follows the placement: left toasts anchor it to the left corner, right toasts to the right corner, and center toasts keep it centered. Top toasts expand downward; bottom toasts keep the notch at the bottom and expand upward. Dismissal folds the panel into the same anchored notch, holds the pill for two seconds, then draws both ends into the pill's center as it fades away. Without a description, the toast stays a compact capsule and dismisses without the extra hold.

For free coordinates, an explicit left or right anchor determines the notch alignment. Otherwise, percentage `x` values below or above `50%` align it left or right; `50%` keeps it centered.

Light and dark themes use their own accent colors for the 1px border and built-in icon. Custom backgrounds and gradients flow continuously through both sections. Reduced motion skips the unfolding, folding, and pill hold.

### Pills and JSX descriptions

Leave out `description` for a pill that fits its heading and icon, with fully rounded ends. Custom icons work in both layouts:

```tsx
toast.success("Saved successfully");
toast.info("Team update", { icon: <span aria-hidden="true">👥</span> });
```

`description` accepts React nodes: text, images, JSX layouts, and your own components, including components with state and buttons. The heading is the first argument to `toast.info`; it does not use a `{ title, description }` single-object signature.

```tsx
function TeamUpdate() {
  const avatars = [
    "/memojis/Rectangle.png",
    "/memojis/Rectangle-1.png",
    "/memojis/Rectangle-2.png",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        {avatars.map((src, index) => (
          <img
            key={src}
            src={src}
            alt=""
            width={28}
            height={28}
            style={{
              borderRadius: "50%",
              border: "2px solid white",
              objectFit: "cover",
              marginLeft: index === 0 ? 0 : -8,
            }}
          />
        ))}
      </div>
      <span>3 new members joined the project.</span>
    </div>
  );
}

toast.info("Team update", {
  icon: <span aria-hidden="true">👥</span>,
  description: <TeamUpdate />,
  duration: Infinity,
  closable: true,
});
```

Use your own image files at those paths. Image dimensions reserve space while they load; for larger images, use `maxWidth: "100%"` and `height: "auto"`. The toast adjusts when its content changes size. Tailwind classes in your JSX work when your app includes Tailwind; the library itself needs no stylesheet.

In the local playground, choose **None — pill only** or **Team update — JSX component** under **Description content**, then choose an icon and click **Show toast**. The JSX example includes images and a working button, and the generated snippet includes its component code.

## 4. The three arguments

```
toast.success( message , icon , style )
                 ↑        ↑      ↑
             required  optional  optional
```

**Only the message is required.** Every key inside the style object is optional too.

```tsx
toast.success("Deployed");                                 // message
toast.success("Deployed", "🎉");                          // + icon
toast.success("Deployed", "🎉", { width: 360 });           // + style
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
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="m5 12 4 4L19 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

toast.success("Saved");                    // built-in check
toast.success("Saved", <CheckIcon />);      // your own element
toast.success("Saved", CheckIcon);          // a component reference
toast.success("Saved", "🎉");              // an emoji
toast.success("Saved", false);             // no icon
toast.success("Saved", { icon: <CheckIcon /> }); // same thing, inside the config
```

Component references, including icons wrapped in `memo` or `forwardRef`, receive `{ size: 18, color }`. Pass them positionally (`toast.success("Saved", CheckIcon)`) or through the config (`toast.success("Saved", { icon: CheckIcon })`). For custom props, prefer a rendered element such as `<YourIcon size={18} />`, using that component's supported props. Give decorative custom icons `aria-hidden="true"`.

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

These options style the toast inline. Numeric dimensions mean pixels; custom JSX can still use your application's classes.

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

The continuous SVG outline accepts CSS border widths such as `1px`, `0.1rem`, or `thin`, `medium`, and `thick`. Border styles `solid`, `dashed`, and `dotted` are rendered; `none` and `hidden` remove the outline. The CSS styles `double`, `groove`, `ridge`, `inset`, and `outset` use a solid-outline fallback.

```tsx
toast.info("Custom outline", { border: "0.1rem dashed #60a5fa" });
```

Full list in the [reference](#style-options).

## 8. Timing, progress bar and hover

A toast starts dismissing after **4 seconds** and shows a progress bar counting that down. Hovering it — or tabbing into it — **freezes the bar and the timer** until you leave. The closing animation and any pill hold happen after this countdown.

```tsx
toast.success("Uploaded", { duration: 8000 });        // longer
toast.show("Stays put",   { duration: Infinity });    // until dismissed
toast.show("No bar",      { progress: false });
toast.show("Never pauses",{ pauseOnHover: false });
toast.show("No X button", { closable: false });
toast.show("With an X",   { closable: true });
```

A toast with `duration: Infinity` has no progress bar, because there is nothing to count down.

The dismiss button is opt-in: pass `closable: true` to show it. Otherwise, the toast starts closing after its `duration` (4000ms by default). Persistent toasts can be closed with `toast.dismiss(id)` or an optional dismiss button.

## 9. Motion

Change the timings globally on `<Toaster />` or for one notification:

```tsx
toast.show("Slower, from further away", {
  motion: { enter: 1400, exit: 900, slide: 40 },
});

toast.show("Plain fade", { motion: { slide: 0, blur: 0, scale: 1 } });
```

| Key | Default | What it does |
|---|---|---|
| `enter` / `exit` | `500` / `450` | Opening and closing movement durations in ms, including the notch and description stages |
| `exitHold` | `2000` | Time the collapsed pill stays visible before departure; `0` skips the pause |
| `slide` | `22` | How far it travels in, in px |
| `scale` | `0.94` | Size it grows from |
| `blur` | `2` | Blur it sharpens from, in px |
| `from` | `"auto"` | Direction: `auto` follows the position, or `top` / `bottom` / `left` / `right` / `none` |
| `easing` / `exitEasing` | `cubic-bezier(0.33, 0, 0.67, 1)` | Any CSS easing function for the heading and content transitions |

All entry stages scale with `enter`: the heading arrives over the first 40%, then the panel unfolds over the remaining 60%. On close, the panel folds back over half of `exit`, the pill waits for `exitHold`, and then both ends draw into its center while it fades over the remaining half. The pill and its shadow fade together without clipping. Total dismissal time is `exit + exitHold`; pill-only toasts and dismissals before the panel opens skip the hold. Set `scale: 1` for a fade without the squeeze.

Set global defaults with `<Toaster motion={{ enter: 500, exit: 450, exitHold: 2000 }} />`, or pass `motion` to an individual toast. The playground's **Opening**, **Closing**, and **Pill hold after closing** controls let you test these values on new toasts.

If the operating system asks for reduced motion, the toast appears fully expanded without travel, scaling, blur or unfolding. Dismissal skips folding and the extra hold too. Set `enter: 0` or `exit: 0` to make that stage immediate; `exit: 0` also skips the hold.

## 10. Promises

Show a loading toast, then swap it for the result in the same spot.

```tsx
await toast.promise(
  deploy(),
  {
    loading: "Deploying…",
    success: (data) => `Live at ${data.url}`,
    error: (err) => `Failed: ${err instanceof Error ? err.message : String(err)}`,
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

Shared options can go on `<Toaster />` and apply to every toast. A toast's own options win. Keep `id`, `description`, and `onClose` on individual toast calls.

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
| `description` | — | Text or JSX, including images and components. Above the heading for bottom positions, below it otherwise; omit for a pill. Per toast only |
| `icon` | variant icon | Element, component, emoji, or `false` |
| `closable` | `false` | Pass `true` to show the ✕ button; timed dismissal works independently |
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
| `width` / `height` | fits content | Both layouts fit their content up to 440px, with room for the notch shoulders. Defaults keep a 16px viewport gutter. Explicit `width` replaces that range; content keeps its minimum height |
| `font` | system stack | Font family |
| `fontSize` / `fontWeight` | `14` / `600` | |
| `radius` | `20` for panels; fully rounded for pills | Corner radius, fitted to the content |
| `padding` | heading `12px 18px 10px`; body `8px 12px 14px` | Overrides both sections. Bottom toasts reverse vertical spacing; the body reserves 44px on the right only when the dismiss button is enabled. Pills use `10px 14px` |
| `border` | `1px solid` variant accent | CSS length or keyword width; solid, dashed, dotted, none, or hidden. Other CSS border styles use a solid fallback |
| `shadow` | silhouette shadow | A custom value applies a wrapper box shadow; `"none"` removes it |
| `progressColor` | variant colour | Progress bar fill |
| `iconColor` | variant colour | Built-in icon colour |
| `theme` | `"dark"` | `"dark"` or `"light"` |
| `style` | — | Raw wrapper `CSSProperties`; background, border, radius, and padding are applied to the notch surface or content |
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
toast.success("Payment received", {
  bgColor: "linear-gradient(135deg, #064e3b, #022c22)",
  textColor: "#ecfdf5",
  progressColor: "#34d399",
  radius: 18,
  width: 360,
});
```

**Centred notice that waits for the user**

```tsx
toast.info("Session expiring", {
  description: "You will be signed out in 2 minutes.",
  position: { x: "50%", y: "50%" },
  duration: Infinity,
  closable: true,
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

**No X button.** It is hidden by default. Set `closable: true` per toast or `<Toaster closable />` for all notifications.

**The pill remains after the description closes.** This is the default two-second hold. Set `motion: { exitHold: 0 }` to skip it, or choose another duration in milliseconds.

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

**Motion.** Each card sits in a wrapper that animates `grid-template-rows` from `0fr` to `1fr`. The silhouette is measured when content or dimensions change; its animation performs no layout reads or React state updates per frame. The gap between toasts lives inside the collapsing row, so it closes with the toast. Where `fr` interpolation is unsupported the height snaps while the fade and scale still play.

**The row does not clip the toast.** The card overflows its opening row away from the stack anchor, carrying its shadow from the first frame. During departure, the pill draws inward and fades with its shadow while the row closes. Keeping the row unmasked prevents it from slicing off the pill during that transition.

**Timing.** The countdown starts on the first painted frame, not on mount, so the bar and the toast stay in step. It lives in the card, the only place that knows whether the pointer or keyboard is resting on it.

**Dismissal.** Dismissing marks the toast as leaving; it is removed from state once its exit animation has finished. Re-adding the same `id` cancels a pending removal, so `dismiss(id)` followed immediately by another call with that `id` keeps the new toast.

**`onClose`.** Fires exactly once, when the toast starts leaving. A callback that throws is caught and reported in development instead of breaking the toast.

**Accessibility.** Error toasts are `role="alert"` / `aria-live="assertive"`; everything else is `role="status"` / `aria-live="polite"`. Built-in icons are hidden from screen readers, the optional ✕ has a label, and focusing controls inside the toast pauses its countdown. Custom JSX remains responsible for its own labels, image alternatives, and keyboard behavior.

**Invalid values.** A non-finite or non-numeric `duration` becomes "keep until dismissed". Zero and negative durations start dismissal immediately after entry begins. An unparseable position falls back to `top-right`. A rejected named style value falls back to the default.

---

# Security

The library never uses `dangerouslySetInnerHTML` and never injects a `<style>` tag. Your `message`, `description` and `icon` are React nodes, so text is escaped for you.

Named string options such as `bgColor`, `textColor`, `border`, and `shadow` pass through [`src/css.ts`](src/css.ts). React assigns style values through the CSSOM, where an invalid value is dropped by the browser rather than parsed as new declarations. The guard blocks:

- Anything that can execute: `javascript:`, `vbscript:`, `expression(`, `eval(`, `behavior:`, `-moz-binding`, `@import`, `@charset`, `<script`, `</`.
- **Backslashes**, because a CSS escape (`\6a avascript:`) can spell a blocked keyword that no substring check sees.
- Declaration breakout: `;`, `{`, `}`, and comment markers in any state.
- `url(…)` pointing anywhere other than `http(s)://`, a path starting with `/`, `./`, or `../`, or supported `data:image/…;base64`. An unparseable `url(` is refused outright.
- Non-strings and anything over 600 characters. Control characters are removed before validation.

Everything else passes through untouched, which is why `"10px 18px"`, `rgb(0 0 0 / 50%)`, `clamp(280px, 40vw, 420px)` and multi-layer shadows all work.

The raw `style` escape hatch does not pass through that guard; use it for trusted application CSS. Custom JSX is also application code, and `bgColor` allows remote URLs by design.

---

# For contributors

```
src/                    the library
  index.ts              public entry point, the only exported surface
  store.ts              the toast list, argument handling, promise tracking
  Toaster.tsx           subscribes, merges defaults, groups by position, portals
  Toast.tsx             notch surface, motion, countdown, pause, progress bar
  placement.ts          position -> container geometry, stack and slide direction
  icons.tsx             built-in icons, consumer icon rendering
  css.ts                the security boundary
  useToast.ts           live list subscription
  types.ts              public types
playground/             local interactive testing studio (Vite)
tests/
  css.test.ts           the security boundary, value by value
  integration.test.tsx  rendering, placement, countdown, promises, lifecycle
  notch.test.tsx        notch geometry, staged motion, holds, reduced motion
  content.test.tsx      pills, custom icons, JSX, content resizing and spacing
  border.test.tsx       outline widths, border styles and keyword measurement
  release.test.tsx      wrapped icon references and replacement lifecycle
```

Use Node **22.22.2+ on 22.x**, **24.15+ on 24.x**, or **26+** for the installed development tools. These requirements are separate from the published package's `engines.node: ">=18"` declaration.

```bash
npm run playground  # open http://127.0.0.1:5173
npm run playground:build # validate the standalone playground build
npm run typecheck   # tsc --noEmit, over src, tests and playground
npm test            # vitest run
npm run build       # tsup -> dist (esm + cjs + .d.ts)
npm run prepublishOnly # typecheck, tests and library build
npm pack --dry-run  # inspect the package file list without publishing
```

The playground includes all toast types, nine positions, light/dark themes, text/pill/JSX content, custom icons, solid/gradient/custom CSS backgrounds, timing sliders, and an optional dismiss button. Use **Show toast** to apply content and timing changes; theme, position, and background update the preview. Edit `playground/TeamUpdate.tsx` to try your own JSX.

No runtime dependencies. Vite is a development dependency for the local playground. Two things not to trip over:

- Do not enable `treeshake` in [`tsup.config.ts`](tsup.config.ts) — it pipes the bundle through rollup, which strips the `"use client"` banner.
- `overrides.esbuild` in `package.json` selects `^0.28.2` for the build tooling. Review the toolchain and its lockfile together before changing this override.

---

# Upgrading to the notch design

Existing `toast.success(message, icon?, config?)` calls and `<Toaster />` remain the public API. Review these changed defaults when upgrading:

| Change | How to control it |
|---|---|
| The X button is now off by default | Set `closable: true` per toast, or `<Toaster closable />` globally |
| A description opens in a notched panel; an omitted description renders a pill | Use `description` for text or JSX; the first argument stays the heading |
| Width fits content instead of reserving a fixed panel width | Set `width` when your design needs a consistent size |
| Panels use a 20px radius; pills are fully rounded | Set `radius` to override either layout |
| Both themes use a thin border in the toast's accent color | Set `border` to use your own outline |
| Opening and closing movement default to 500ms and 450ms | Set `motion.enter` and `motion.exit` |
| A collapsed description toast holds its pill for two seconds before departure | Set `motion.exitHold`; `0` removes the hold |
| Pill departure squeezes inward while fading | Set `motion.scale: 1` to disable the squeeze |

For example, retain a visible X, fixed width, and no extra pill hold:

```tsx
<Toaster closable width={360} motion={{ exitHold: 0 }} />
```

The countdown still defaults to 4000ms, pauses on hover/focus, and supports `Infinity`. Custom icons, JSX descriptions, themes, gradients, positions, and explicit style overrides remain available.

## Migrating from the provider-based API

The provider pair is gone, and the option names are shorter.

| Provider-based API | Current API |
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

MIT — see [LICENSE](LICENSE). Hosted demo: [ztoast.onrender.com](https://ztoast.onrender.com). Use the local playground to try the code in this checkout.
