import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toast } from "./Toast";
import { resolvePlacement } from "./placement";
import type { Placement } from "./placement";
import { useToastList } from "./useToast";
import type { ToastConfig, ToasterProps, ToastRecord } from "./types";

// the only component the library needs. mount it once at the root of the app;
// everything else is the imperative `toast.*` api.
//
// it subscribes to the store, merges its own props in as the defaults for every
// toast, and groups the result by resolved container geometry so that toasts
// sharing a spot on the screen share one stack.

interface Entry {
  record: ToastRecord;
  settings: ToastConfig;
}

interface Group {
  placement: Placement;
  entries: Entry[];
}

// a toast's own config always wins; the two nested objects merge key by key so
// that <Toaster motion={{ enter: 700 }} /> is not wiped out by motion.from
function mergeSettings(
  defaults: ToastConfig,
  config: ToastConfig
): ToastConfig {
  const merged: ToastConfig = { ...defaults, ...config };
  if (defaults.motion || config.motion) {
    merged.motion = { ...defaults.motion, ...config.motion };
  }
  if (defaults.style || config.style) {
    merged.style = { ...defaults.style, ...config.style };
  }
  return merged;
}

export function Toaster({ max, ...defaults }: ToasterProps = {}) {
  const toasts = useToastList();
  // a portal cannot be rendered during server rendering or the first hydration
  // pass - the markup would not match what the server produced. mounting on the
  // client only keeps next.js / remix hydration safe.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined" || !document.body) {
    return null;
  }

  const groups = new Map<string, Group>();
  for (const record of toasts) {
    const settings = mergeSettings(defaults, record.config);
    const placement = resolvePlacement(settings);
    const group = groups.get(placement.key);
    if (group) {
      group.entries.push({ record, settings });
    } else {
      groups.set(placement.key, { placement, entries: [{ record, settings }] });
    }
  }

  const limit = typeof max === "number" && max > 0 ? max : undefined;

  return createPortal(
    <>
      {Array.from(groups.values()).map(({ placement, entries }) => (
        <div
          key={placement.key}
          data-ztoast-viewport=""
          style={placement.style}
        >
          {/* anything over the cap stays in the store and shows up as soon as
              one of the visible toasts leaves */}
          {(limit ? entries.slice(-limit) : entries).map(
            ({ record, settings }) => (
              <Toast
                key={record.id}
                record={record}
                settings={settings}
                placement={placement}
              />
            )
          )}
        </div>
      ))}
    </>,
    document.body
  );
}
