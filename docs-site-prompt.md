# Prompt for updating the ztoast docs website

Paste everything below the line into an agent session opened in the **docs website**
repo (ztoast.onrender.com). It is self-contained: the agent does not need access to
the library source.

---

You are updating the documentation website for **ztoast**, a React toast
notification library. The library was just rewritten and released as **1.0.0**, a
breaking change from 0.1.x. This site still documents the 0.x API, so most code
samples on it are now wrong. Your job is to bring the whole site in line with 1.0.

First explore the site and tell me what you find before changing anything: the
framework, where content lives (MDX? TSX? a CMS?), whether there is an interactive
demo/playground, and a list of every file that mentions the old API. Then work
through the tasks.

## Prerequisite to check first

The site must build against ztoast **1.0.0**. Check the installed version in
`package.json`. If 1.0.0 is not on npm yet, say so and stop before touching the
dependency — the maintainer may need to publish it first, or link a local build
(`npm link ../ztoast-library`, or `"ztoast": "file:../ztoast-library"`). Do not
silently leave the site on 0.1.x while rewriting the docs to 1.0 syntax.

## Ground truth: the 1.0 API

This is the complete public surface. Nothing else exists — do not document any
option, prop or method that is not listed here.

### Setup

There is **no provider and no context**. One component, mounted once at the root:

```tsx
import { Toaster, toast } from "ztoast";

<Toaster />
```

No stylesheet to import, ever. Zero runtime dependencies. `react` and `react-dom`
are peer dependencies, React 17+.

### Calling it

Every creator has the signature `(message, icon?, config?)`. Only the message is
required. The second argument is type-sniffed, so it can be either the icon or the
config — you never pass `null` to skip the icon.

```tsx
toast.success("Deployed");                               // message only
toast.success("Deployed", <FiCheck />);                  // + icon
toast.success("Deployed", { width: 360 });               // + config
toast.success("Deployed", <FiCheck />, { width: 360 });  // + both
```

| Method | Notes |
|---|---|
| `toast.show(message, icon?, config?)` | neutral variant, no built-in icon |
| `toast.success(…)` | |
| `toast.error(…)` | rendered as `role="alert"` / `aria-live="assertive"` |
| `toast.info(…)` | |
| `toast.warning(…)` | |
| `toast.warn(…)` | **alias of `toast.warning`** — both must be documented |
| `toast.loading(…)` | defaults to `duration: Infinity` |
| `toast.promise(promise, messages, config?)` | returns **the original promise**, not an id |
| `toast.dismiss(id?)` | one toast; **with no argument, dismisses all** |
| `toast.dismissAll()` | same as `dismiss()` with no argument |
| `useToast()` | returns `{ toasts, ...every method above }`. Optional, **never throws**, works anywhere in the tree |

Every creator except `promise` returns the toast id (`string | number`).

`toast.promise` messages object: `{ loading, success, error }`, where `success` and
`error` accept a ReactNode **or** a function of the resolved value / error.

### The icon argument

Accepts: a rendered element (`<FiCheck />`, an `<svg>`), a component reference
(`FiCheck`), an emoji or plain string (`"🎉"`), a number, or `false` to remove the
icon entirely. A component reference is invoked with `{ size: 18, color }`, which
matches `react-icons`, `lucide-react` and `@heroicons/react`. It can also be passed
as `config.icon`.

### Position — three forms

```tsx
position: "bottom-center"                         // 1. named spot
position: "top-10vh"                              // 2. edge offset
position: { x: "62%", y: "80%" }                   // 3. free coordinate
```

1. **Named** (nine): `top-left`, `top-center`, `top-right`, `center-left`,
   `center`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`. Each
   inset 16px from the edges it touches.
2. **Edge offset**: `"<edge>-<distance>"`, one token per axis, max two tokens.
   Examples: `"top-10vh"`, `"left-10vw"`, `"bottom-24px right-5%"`,
   `"top-2rem left-calc(50% - 120px)"`, `"top-40"` (bare number = px), `"bottom"`
   (bare edge = default 16px inset). **An axis you do not mention is centred**, so
   `"top-10vh"` is 10vh down from the top and horizontally centred. The offset
   positions the toast's own edge. Units accepted: `px % em rem ex ch vh vw vmin
   vmax dvh dvw svh svw lvh lvw cm mm in pt pc q` and `calc(...)`.
3. **Free coordinate**: `{ x, y, anchor? }`. `x`/`y` take any CSS length or a plain
   number (px). **`anchor` defaults to `"center"`** and names which point of the
   toast lands on the coordinate, which is why `{ x: "50%", y: "50%" }` is the dead
   centre of the screen. `anchor` accepts any of the nine named spots.

Toasts resolving to the same spot share one stack; different spots stack
independently. New toasts appear away from the anchor, so nothing already on screen
moves. `stack: "down" | "up"` overrides the direction, `gap` the spacing.

Nothing is clamped to the viewport — a coordinate can hang a toast off the edge on
purpose. A position string that cannot be parsed falls back to `top-right` and logs
a development-only console warning.

### Config — every option, with real defaults

All optional. Everything except `id`, `description` and `onClose` can also be passed
to `<Toaster />` as a default for all toasts; a toast's own value always wins.

| Option | Default | Notes |
|---|---|---|
| `id` | auto | reuse to replace a toast in place (keeps its slot, restarts the countdown). Per toast only |
| `duration` | `4000` | ms. `Infinity`, `0`, `NaN` or a negative number all mean "keep until dismissed" |
| `description` | — | second line under the message. Per toast only |
| `icon` | variant icon | element / component / string / `false` |
| `closable` | `true` | the ✕ button |
| `progress` | **`true`** | countdown bar. Was `progressBar`, off by default, in 0.x |
| `pauseOnHover` | `true` | freezes bar + timer on hover and on keyboard focus |
| `onClose` | — | fires exactly once, when the toast starts leaving. Per toast only |
| `position` | `"top-right"` | the three forms above |
| `gap` | `14` | px between stacked toasts |
| `stack` | from position | `"down"` \| `"up"` |
| `zIndex` | `2147483000` | |
| `textColor` / `color` | theme text | aliases of each other |
| `bgColor` / `background` | theme surface | aliases. Takes anything CSS `background` takes: colour, gradient, `url(...)` |
| `width` | fits content | without it the card sits between `240px` and `min(92vw, 440px)`; setting it replaces that range exactly |
| `height` | fits content | |
| `font` | system stack | font family |
| `fontSize` | `14` | |
| `fontWeight` | `600` | applies to the message line |
| `radius` | `14` | corner radius |
| `padding` | `"13px 15px"` | |
| `border` | theme hairline | shorthand |
| `shadow` | theme shadow | |
| `progressColor` | variant accent | |
| `iconColor` | variant accent | built-in icons only |
| `theme` | `"dark"` | `"dark"` \| `"light"` — the palette used for anything not set explicitly |
| `style` | — | raw `CSSProperties`, merged last, for anything without its own option |
| `motion` | see below | |

Numbers mean pixels everywhere. Colours accept hex, `rgb()`, `hsl()`, `oklch()`,
`rgb(0 0 0 / 50%)` and CSS variables (`var(--brand-fg)`).

`<Toaster />` has one extra prop of its own: **`max`** (default unlimited) — how many
toasts to show per position at once. Extras queue and appear as room frees up.

### Motion

| Key | Default |
|---|---|
| `enter` / `exit` | `520` / `340` ms |
| `easing` / `exitEasing` | `cubic-bezier(0.16, 1, 0.3, 1)` / `cubic-bezier(0.4, 0, 0.2, 1)` |
| `slide` | `22` px travelled inwards |
| `scale` | `0.94` starting scale |
| `blur` | `2` px starting blur |
| `from` | `"auto"` (follows the position) \| `top` \| `bottom` \| `left` \| `right` \| `none` |

The enter animation is a fade + slide + unblur + scale on a decelerating curve; the
exit fades out and the stack's height collapses just behind it, so nothing jumps.
When the OS requests reduced motion, travel, scale and blur are dropped
automatically.

### Behaviour worth documenting

- A toast fired **before** `<Toaster />` mounts is queued and appears when it
  mounts (0.x dropped it with a warning).
- `toast.*` works from any file — API clients, interceptors, stores. It is not a hook.
- SSR-safe: the build carries a `"use client"` banner, and `<Toaster />` renders
  nothing on the server or the first client render, so there is no hydration
  mismatch in the Next.js App Router.
- A toast with a non-finite duration shows no progress bar, because there is
  nothing to count down.
- Style values are validated before reaching the DOM; an unsafe value (containing
  `;`, `{`, `}`, a backslash, a CSS comment, `javascript:`, or a `url()` that is not
  https / relative / `data:image`) is dropped and the default is used.

### Exported TypeScript types

`ToastConfig`, `ToasterProps`, `ToastIcon`, `ToastMotion`, `ToastPosition`,
`NamedPosition`, `EdgeOffsetPosition`, `FreePosition`, `ToastRecord`,
`ToastVariant`, `PromiseMessages`.

## Removed in 1.0 — delete every trace from the site

These no longer exist and must not appear anywhere, including in screenshots,
playground output, copy-paste snippets or navigation:

- `ToastProvider`, `ToastViewport`, `ToastContextValue`, `ToastProviderProps`,
  `ToastOptions`, `ToastStyleOptions`, `ToastOffsetOptions`, `PromiseToastMessages`
- `defaultPosition`, `defaultDuration`, `defaultProgressBar`, `progressBar`
- `offset`, and the top-level `top` / `bottom` / `left` / `right` / `transform`
  coordinate options
- `background` as the *only* background name, `borderRadius`, `boxShadow`,
  `backgroundGradient`, `backgroundImage`, `borderColor`, `borderWidth`
- any claim that `useToast()` throws outside a provider
- any claim that toasts fired before mount are dropped

### Migration table to reproduce on the site

| 0.x | 1.0 |
|---|---|
| `<ToastProvider>…<ToastViewport /></ToastProvider>` | `<Toaster />` |
| `defaultPosition` / `defaultDuration` / `defaultProgressBar` | `position` / `duration` / `progress` |
| `toast.show(msg, { icon: <I /> })` | `toast.show(msg, <I />)` (object form still works) |
| `background` / `borderRadius` / `boxShadow` / `progressBar` | `bgColor` / `radius` / `shadow` / `progress` |
| `backgroundGradient` / `backgroundImage` | `bgColor` (it takes gradients and urls) |
| `{ position: "top-center", top: "50vh" }` | `{ position: "top-50vh" }` |
| `{ offset: { bottom: 40, right: 32 } }` | `{ position: "bottom-40px right-32px" }` |
| `progressBar` off by default | `progress` on by default |
| `useToast()` throws outside a provider | `useToast()` works anywhere |

## Tasks

1. **Update the dependency** to ztoast 1.0.0 (see the prerequisite above) and get
   the site building again.
2. **Hero / landing page.** Lead with the new call shape — the icon and the styling
   go into the call:
   `toast.success("Project saved", <FiCheck />, { bgColor: "#052e16", width: 360 })`.
   The headline claims should be: one component to mount then call from anywhere;
   place a toast anywhere on screen; smooth motion by default; countdown bar that
   pauses on hover; no CSS file, no runtime dependencies.
3. **Getting started.** Install → mount `<Toaster />` once → call `toast.success(...)`.
   Make it explicit that this is the entire setup and that everything else is
   optional.
4. **Rewrite every code sample** on every page against the API above. Each one must
   actually run — no invented options.
5. **The interactive demo / playground**, if the site has one, is the most important
   piece. Its controls must map only to real options. At minimum expose:
   variant, message, description, icon on/off, duration, progress, pauseOnHover,
   closable, theme, textColor, bgColor, width, radius, font, and **all three
   position forms** (a picker for the nine named spots, a text field for edge
   offsets, and x/y + anchor inputs for coordinates). Show the generated
   `toast.*()` call as copy-pasteable code that reflects the current controls.
   A motion panel (`enter`, `exit`, `slide`, `scale`, `blur`, `from`) is a strong
   addition, since smooth motion is the library's main selling point.
6. **Add a dedicated Positioning page or section.** This is the biggest new
   capability. Cover all three forms, include the "unmentioned axis is centred"
   rule and the `anchor` default, and ideally a clickable screen diagram that fires
   a toast at the clicked point using free coordinates.
7. **API reference page.** Rebuild the tables from the Config, Motion, `<Toaster />`
   and method sections above, with the real defaults.
8. **Add a "Upgrading from 0.x" page** with the migration table, linked from the
   getting-started page and the changelog.
9. **Sweep the metadata**: page titles, meta and OG descriptions, any JSON-LD, the
   README in this site's repo, version numbers and badges, and any social preview
   image that shows old code.
10. **Search the whole repo** for `ToastProvider`, `ToastViewport`, `progressBar`,
    `defaultPosition`, `defaultDuration`, `ToastOptions`, `offset`, `borderRadius`,
    `boxShadow` and report anything you could not migrate.

## Rules

- Do not invent features, options or defaults. If something is unclear, ask instead
  of guessing — a wrong default in the docs is worse than a gap.
- Every snippet must type-check against the real `ToastConfig`. Run the site's
  typecheck and build before you report done.
- Keep the existing design system, tone and page structure unless a change is
  needed for accuracy; this is a content and correctness pass, not a redesign.
- Prefer showing the simplest form first and the advanced form second on every page.
- Do not add a stylesheet import anywhere. There is no CSS file to import.

## Done when

- The site builds and typechecks with ztoast 1.0.0.
- No reference to any removed export or option survives anywhere in the repo.
- Every sample on the site runs as written, and the playground only emits valid calls.
- Positioning (all three forms), the icon argument, `progress`/`pauseOnHover`,
  `theme`, `max` and `motion` are all documented.
- An upgrade path from 0.x exists and is linked.
