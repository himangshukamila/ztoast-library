import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast, useToast } from "../src";
import { ErrorBoundary } from "./ErrorBoundary";
import { TeamUpdate } from "./TeamUpdate";
import { TeamIcon } from "./TeamIcon";
import { initialSettings, isPreviewCommand, visibleLimit } from "./shared";
import "./styles.css";

function Preview() {
  const [settings, setSettings] = useState(initialSettings);
  const { toasts } = useToast();
  const activeCount = toasts.filter((item) => !item.leaving).length;

  useEffect(() => {
    function receive(event: MessageEvent<unknown>) {
      if (event.origin !== window.location.origin || event.source !== window.parent || !isPreviewCommand(event.data)) return;
      const command = event.data;
      if (command.action === "ready") {
        window.parent.postMessage({ source: "ztoast-preview", action: "ready" }, window.location.origin);
      } else if (command.action === "configure") {
        setSettings(command.settings);
      } else if (command.action === "dismiss") {
        console.log("[playground] Dismissing all preview notifications");
        toast.dismissAll();
      } else {
        const method = command.variant === "default" ? "show" : command.variant;
        console.log("[playground] Showing notification", { variant: command.variant, duration: command.duration, motion: command.motion });
        toast[method](command.title, {
          description: command.descriptionMode === "team" ? <TeamUpdate /> : command.descriptionMode === "text" ? command.description.trim() || undefined : undefined,
          icon: command.iconMode === "jsx" ? <TeamIcon /> : command.iconMode === "none" ? false : command.iconMode === "text" ? command.customIcon.trim() || "🎉" : undefined,
          duration: command.duration === "persistent" ? Infinity : command.duration,
          closable: command.closable,
          motion: command.motion,
        });
      }
    }

    window.addEventListener("message", receive);
    console.log("[playground] Preview ready");
    window.parent.postMessage({ source: "ztoast-preview", action: "ready" }, window.location.origin);
    return () => {
      window.removeEventListener("message", receive);
      toast.dismissAll();
    };
  }, []);

  useEffect(() => {
    window.parent.postMessage({ source: "ztoast-preview", action: "count", count: activeCount }, window.location.origin);
  }, [activeCount]);

  return (
    <>
      <div className="preview-surface" data-theme={settings.theme} aria-hidden="true">
        <span className="preview-corner preview-corner--tl" />
        <span className="preview-corner preview-corner--tr" />
        <span className="preview-corner preview-corner--bl" />
        <span className="preview-corner preview-corner--br" />
        {toasts.length === 0 && (
          <div className="empty-preview">
            <span className="empty-preview-mark">z</span>
            <p>A little space for your next notification.</p>
          </div>
        )}
      </div>
      <Toaster {...settings} max={visibleLimit} />
    </>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<ErrorBoundary><Preview /></ErrorBoundary>);
