import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { NamedPosition, ToastVariant } from "../src";
import { css } from "../src/css";
import { ErrorBoundary } from "./ErrorBoundary";
import { initialMotion, initialSettings, positions, presets, visibleLimit } from "./shared";
import type { DescriptionMode, IconMode, PreviewCommand, PreviewSettings } from "./shared";
import teamUpdateCode from "./TeamUpdate.tsx?raw";
import teamIconCode from "./TeamIcon.tsx?raw";
import "./styles.css";

function send(frame: HTMLIFrameElement | null, command: PreviewCommand) {
  frame?.contentWindow?.postMessage(command, window.location.origin);
}

function ArrowIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

type BackgroundMode = "theme" | "solid" | "gradient" | "custom";

function gradientBackground(from: string, to: string, angle: number) {
  return `linear-gradient(${angle}deg, ${from}, ${to})`;
}

function backgroundError(value: string): string | null {
  const safe = css(value);
  if (!safe) return "Enter a supported background color or gradient.";
  const style = document.createElement("div").style;
  style.background = safe;
  return style.background ? null : "This background is not valid CSS. The last valid background is still applied.";
}

function Playground() {
  const preview = useRef<HTMLIFrameElement>(null);
  const initializedFrame = useRef<MessageEventSource | null>(null);
  const currentSettings = useRef(initialSettings);
  const [variant, setVariant] = useState<ToastVariant>("success");
  const [title, setTitle] = useState(presets[0].title);
  const [description, setDescription] = useState(presets[0].description);
  const [descriptionMode, setDescriptionMode] = useState<DescriptionMode>("text");
  const [iconMode, setIconMode] = useState<IconMode>("default");
  const [customIcon, setCustomIcon] = useState("🎉");
  const [settings, setSettings] = useState<PreviewSettings>(initialSettings);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("theme");
  const [solidColor, setSolidColor] = useState("#12362c");
  const [gradientFrom, setGradientFrom] = useState("#064e3b");
  const [gradientTo, setGradientTo] = useState("#022c22");
  const [gradientAngle, setGradientAngle] = useState(135);
  const [customBackground, setCustomBackground] = useState("linear-gradient(135deg, #1e1b4b, #312e81)");
  const [duration, setDuration] = useState<number | "persistent">("persistent");
  const [closable, setClosable] = useState(false);
  const [motion, setMotion] = useState(initialMotion);
  const [ready, setReady] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);

  useEffect(() => {
    function receive(event: MessageEvent<unknown>) {
      if (event.origin !== window.location.origin || event.source !== preview.current?.contentWindow ||
        !event.data || typeof event.data !== "object") return;
      const message = event.data as Record<string, unknown>;
      if (message.source !== "ztoast-preview") return;
      if (message.action === "ready") {
        if (initializedFrame.current === event.source) return;
        initializedFrame.current = event.source;
        setReady(true);
        setPreviewError(null);
        send(preview.current, { source: "ztoast-playground", action: "configure", settings: currentSettings.current });
        send(preview.current, { source: "ztoast-playground", action: "show", variant: "success", title: presets[0].title, description: presets[0].description, descriptionMode: "text", iconMode: "default", customIcon: "", duration: "persistent", closable: false, motion: initialMotion });
      } else if (message.action === "count" && typeof message.count === "number") {
        setActiveCount(message.count);
      } else if (message.action === "error") {
        setPreviewError("The toast preview could not render. Check the console, then try again.");
        setReady(false);
      }
    }

    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    currentSettings.current = settings;
    if (ready) send(preview.current, { source: "ztoast-playground", action: "configure", settings });
  }, [ready, settings]);

  useEffect(() => {
    if (ready) return;
    const timeout = window.setTimeout(() => {
      console.log("[playground] Preview initialization timed out");
      setPreviewError("The preview is taking too long to load. Check that the dev server is running.");
    }, 10000);
    return () => window.clearTimeout(timeout);
  }, [ready, previewVersion]);

  function showToast(nextVariant = variant, nextTitle = title, nextDescription = description) {
    send(preview.current, { source: "ztoast-playground", action: "show", variant: nextVariant, title: nextTitle.trim() || "Notification", description: nextDescription, descriptionMode, iconMode, customIcon, duration, closable, motion });
  }

  function chooseVariant(preset: typeof presets[number]) {
    setVariant(preset.variant);
    const nextTitle = descriptionMode === "team" ? "Team update" : preset.title;
    setTitle(nextTitle);
    setDescription(preset.description);
    showToast(preset.variant, nextTitle, preset.description);
  }

  function applyBackground(bgColor?: string) {
    setSettings((previous) => ({ ...previous, bgColor }));
  }

  function chooseBackground(mode: BackgroundMode) {
    setBackgroundMode(mode);
    if (mode === "theme") applyBackground();
    if (mode === "solid") applyBackground(solidColor);
    if (mode === "gradient") applyBackground(gradientBackground(gradientFrom, gradientTo, gradientAngle));
    if (mode === "custom" && !backgroundError(customBackground)) applyBackground(css(customBackground));
  }

  const customBackgroundError = backgroundMode === "custom" ? backgroundError(customBackground) : null;
  const backgroundCode = settings.bgColor ? `\n  bgColor: ${JSON.stringify(settings.bgColor)},` : "";
  const descriptionCode = descriptionMode === "team" ? "\n  description: <TeamUpdate />," : descriptionMode === "text" && description.trim() ? `\n  description: ${JSON.stringify(description.trim())},` : "";
  const iconCode = iconMode === "jsx" ? "\n  icon: <TeamIcon />," : iconMode === "none" ? "\n  icon: false," : iconMode === "text" ? `\n  icon: ${JSON.stringify(customIcon.trim() || "🎉")},` : "";
  const closableCode = closable ? "\n  closable: true," : "";
  const componentCode = `${descriptionMode === "team" ? `${teamUpdateCode.trim()}\n\n` : ""}${iconMode === "jsx" ? `${teamIconCode.trim()}\n\n` : ""}`;
  const code = `import { toast } from "ztoast";\n\n${componentCode}toast.${variant === "default" ? "show" : variant}(${JSON.stringify(title.trim() || "Notification")}, {${descriptionCode}${iconCode}\n  theme: "${settings.theme}",\n  position: "${settings.position}",\n  duration: ${duration === "persistent" ? "Infinity" : duration},${closableCode}\n  motion: { enter: ${motion.enter}, exit: ${motion.exit}, exitHold: ${motion.exitHold} },\n  progress: ${settings.progress},${backgroundCode}\n});`;

  return (
    <div className="studio">
      <header className="site-header">
        <a className="brand" href="./" aria-label="ztoast playground home"><span className="brand-mark" aria-hidden="true">z</span><span>ztoast<span className="brand-period">.</span></span></a>
        <span className="header-divider" aria-hidden="true" />
        <span className="header-location">Design playground</span>
        <span className="local-badge"><span aria-hidden="true" />Local preview</span>
      </header>

      <main>
        <div className="page-intro">
          <p className="eyebrow">SMALL DETAILS. BETTER FEEDBACK.</p>
          <h1>A little notch.<br className="mobile-break" /> A clearer message.</h1>
          <p className="intro-description">Your icon and heading, together. A clean space for everything else.</p>
        </div>

        <div className="workspace">
          <section className="controls" aria-labelledby="controls-title">
            <div className="section-heading"><h2 id="controls-title">Make it yours</h2><span className="section-index">01</span></div>
            <fieldset disabled={!ready} className="variant-fieldset">
              <legend>Toast type <span>Click to preview</span></legend>
              <div className="variant-grid">
                {presets.map((preset) => (
                  <button key={preset.variant} type="button" className="variant-button" data-variant={preset.variant} aria-pressed={variant === preset.variant} onClick={() => chooseVariant(preset)}>
                    <span className="variant-dot" aria-hidden="true" />{preset.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <form onSubmit={(event) => { event.preventDefault(); showToast(); }}>
              <div className="field"><label htmlFor="toast-title">Heading</label><input id="toast-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div>
              <div className="field">
                <label htmlFor="toast-content">Description content</label>
                <select id="toast-content" value={descriptionMode} onChange={(event) => {
                  const mode = event.target.value as DescriptionMode;
                  setDescriptionMode(mode);
                  if (mode === "team") setTitle("Team update");
                }} aria-describedby="toast-content-help">
                  <option value="text">Text</option>
                  <option value="none">None — pill only</option>
                  <option value="team">Team update — JSX component</option>
                </select>
                <p id="toast-content-help" className="field-help">
                  {descriptionMode === "team" ? "Includes three images and a working button. Show the toast, then click Show member names to test component state." : descriptionMode === "none" ? "Only the heading and your selected icon. No description panel." : "Leave the description empty to show a pill."}
                </p>
              </div>
              {descriptionMode === "text" && <div className="field"><label htmlFor="toast-description">Description</label><textarea id="toast-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></div>}
              <div className="field">
                <label htmlFor="toast-icon">Icon</label>
                <select id="toast-icon" value={iconMode} onChange={(event) => setIconMode(event.target.value as IconMode)}>
                  <option value="default">Default for toast type</option>
                  <option value="text">Emoji / custom text</option>
                  <option value="jsx">Custom JSX icon</option>
                  <option value="none">No icon</option>
                </select>
              </div>
              {iconMode === "text" && <div className="field"><label htmlFor="toast-custom-icon">Your icon</label><input id="toast-custom-icon" value={customIcon} onChange={(event) => setCustomIcon(event.target.value)} placeholder="🎉" aria-describedby="toast-icon-help" /><p id="toast-icon-help" className="field-help">Try an emoji or a short symbol. Empty uses 🎉.</p></div>}
              <div className="field-row">
                <div className="field"><label htmlFor="toast-theme">Theme</label><select id="toast-theme" value={settings.theme} onChange={(event) => setSettings({ ...settings, theme: event.target.value as "dark" | "light" })}><option value="dark">Dark</option><option value="light">Light</option></select></div>
                <div className="field"><label htmlFor="toast-position">Position</label><select id="toast-position" value={settings.position} onChange={(event) => setSettings({ ...settings, position: event.target.value as NamedPosition })}>{positions.map((position) => <option key={position} value={position}>{position.replace(/-/g, " ").replace(/^./, (letter) => letter.toUpperCase())}</option>)}</select></div>
              </div>
              <fieldset className="background-controls" aria-describedby="background-help">
                <legend>Toast background</legend>
                <div className="field">
                  <label htmlFor="background-mode">Background style</label>
                  <select id="background-mode" value={backgroundMode} onChange={(event) => chooseBackground(event.target.value as BackgroundMode)}>
                    <option value="theme">Theme default</option>
                    <option value="solid">Solid color</option>
                    <option value="gradient">Gradient</option>
                    <option value="custom">Custom CSS</option>
                  </select>
                </div>
                {backgroundMode === "solid" && (
                  <div className="field">
                    <label htmlFor="background-solid">Color <span className="color-value">{solidColor}</span></label>
                    <input id="background-solid" type="color" value={solidColor} onChange={(event) => { setSolidColor(event.target.value); applyBackground(event.target.value); }} />
                  </div>
                )}
                {backgroundMode === "gradient" && (
                  <>
                    <div className="field-row">
                      <div className="field">
                        <label htmlFor="gradient-from">Start color</label>
                        <input id="gradient-from" type="color" value={gradientFrom} onChange={(event) => { setGradientFrom(event.target.value); applyBackground(gradientBackground(event.target.value, gradientTo, gradientAngle)); }} />
                      </div>
                      <div className="field">
                        <label htmlFor="gradient-to">End color</label>
                        <input id="gradient-to" type="color" value={gradientTo} onChange={(event) => { setGradientTo(event.target.value); applyBackground(gradientBackground(gradientFrom, event.target.value, gradientAngle)); }} />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="gradient-angle">Direction <output className="color-value" htmlFor="gradient-angle">{gradientAngle}°</output></label>
                      <input id="gradient-angle" type="range" min="0" max="360" step="15" value={gradientAngle} onChange={(event) => { const angle = Number(event.target.value); setGradientAngle(angle); applyBackground(gradientBackground(gradientFrom, gradientTo, angle)); }} />
                    </div>
                  </>
                )}
                {backgroundMode === "custom" && (
                  <div className="field">
                    <label htmlFor="background-css">CSS background</label>
                    <textarea id="background-css" rows={3} value={customBackground} spellCheck={false} aria-invalid={Boolean(customBackgroundError)} aria-describedby="background-validation background-help" onChange={(event) => {
                      const value = event.target.value;
                      setCustomBackground(value);
                      if (!backgroundError(value)) applyBackground(css(value));
                    }} />
                    <p id="background-validation" className="field-feedback" data-invalid={Boolean(customBackgroundError)} aria-live="polite">
                      {customBackgroundError ?? "Background applied to the live preview."}
                    </p>
                  </div>
                )}
                <p id="background-help" className="field-help">Applies to visible and new toasts. Choose Theme default to reset.</p>
              </fieldset>
              <fieldset className="motion-controls" aria-describedby="motion-help">
                <legend>Animation timing</legend>
                <div className="field">
                  <label htmlFor="motion-enter">Opening <output className="color-value" htmlFor="motion-enter">{motion.enter} ms</output></label>
                  <input id="motion-enter" type="range" min="0" max="3000" step="50" value={motion.enter} aria-valuetext={`${motion.enter} milliseconds`} onChange={(event) => setMotion({ ...motion, enter: Number(event.target.value) })} />
                </div>
                <div className="field">
                  <label htmlFor="motion-exit">Closing <output className="color-value" htmlFor="motion-exit">{motion.exit} ms</output></label>
                  <input id="motion-exit" type="range" min="0" max="3000" step="50" value={motion.exit} aria-valuetext={`${motion.exit} milliseconds`} onChange={(event) => setMotion({ ...motion, exit: Number(event.target.value) })} />
                </div>
                <div className="field">
                  <label htmlFor="motion-exit-hold">Pill hold after closing <output className="color-value" htmlFor="motion-exit-hold">{motion.exitHold} ms</output></label>
                  <input id="motion-exit-hold" type="range" min="0" max="5000" step="100" value={motion.exitHold} aria-valuetext={`${motion.exitHold} milliseconds`} aria-describedby="motion-exit-hold-help" onChange={(event) => setMotion({ ...motion, exitHold: Number(event.target.value) })} />
                  <p id="motion-exit-hold-help" className="field-help">Time the pill stays visible after the description closes, before fading away.</p>
                </div>
                <p id="motion-help" className="field-help">Applies to the next toast. Set any value to 0 to skip that stage.</p>
              </fieldset>
              <div className="field"><label htmlFor="toast-duration">Dismiss after</label><select id="toast-duration" value={duration} aria-describedby="toast-duration-help" onChange={(event) => setDuration(event.target.value === "persistent" ? "persistent" : Number(event.target.value))}><option value="persistent">Keep visible</option><option value="3000">3 seconds</option><option value="5000">5 seconds</option><option value="8000">8 seconds</option></select><p id="toast-duration-help" className="field-help">{duration === "persistent" ? "Keep visible stays until you use Dismiss all or an enabled dismiss button." : "The toast closes automatically after this time, with or without a dismiss button."}</p></div>
              <label className="checkbox-field" htmlFor="toast-closable"><input type="checkbox" id="toast-closable" checked={closable} onChange={(event) => setClosable(event.target.checked)} /><span>Show dismiss button</span></label>
              <label className="checkbox-field" htmlFor="toast-progress"><input type="checkbox" id="toast-progress" checked={settings.progress} onChange={(event) => setSettings({ ...settings, progress: event.target.checked })} /><span>Show countdown progress</span></label>
              <button className="launch-button" type="submit" disabled={!ready}><span>Show toast</span><ArrowIcon /></button>
              <p className="control-help">Heading, content, icon, timing, and dismiss button apply to the next toast.</p>
            </form>
          </section>

          <div className="preview-column">
            <section className="preview-panel" aria-labelledby="preview-title">
              <div className="preview-toolbar"><div className="preview-label"><span className="live-dot" aria-hidden="true" /><h2 id="preview-title">Live preview</h2></div><button className="text-button" type="button" disabled={!ready || activeCount === 0} onClick={() => send(preview.current, { source: "ztoast-playground", action: "dismiss" })}>Dismiss all <span aria-hidden="true">↗</span></button></div>
              <div className="preview-frame">
                <iframe key={previewVersion} ref={preview} title="Interactive toast preview" src="./preview.html" aria-busy={!ready} onLoad={() => send(preview.current, { source: "ztoast-playground", action: "ready" })} />
                {!ready && <div className="preview-loading" role={previewError ? "alert" : "status"}>{previewError ? <><p>{previewError}</p><button type="button" onClick={() => { setPreviewError(null); setActiveCount(0); setPreviewVersion((value) => value + 1); }}>Retry preview</button></> : <><span className="loading-ring" aria-hidden="true" /><p>Preparing your preview…</p></>}</div>}
              </div>
              <div className="preview-footer"><span>Hover or focus a toast to pause its timer.</span><span aria-live="polite">{Math.min(activeCount, visibleLimit)} visible · {activeCount} total</span></div>
            </section>

            <section className="code-panel" aria-labelledby="code-title"><div className="code-heading"><h2 id="code-title">The same simple API</h2><span>React / TypeScript</span></div>{descriptionMode === "team" && <p className="code-help">Edit <code>playground/TeamUpdate.tsx</code> to try your own JSX. The example below includes the component and its images.</p>}<pre tabIndex={0} aria-label="Code for the current toast settings"><code>{code}</code></pre></section>
          </div>
        </div>
      </main>
      <footer className="site-footer"><span>Built small. Feels considered.</span><span>ztoast / notch study</span></footer>
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<ErrorBoundary><Playground /></ErrorBoundary>);
