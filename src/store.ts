import { isValidElement } from "react";
import type { ReactNode } from "react";
import type {
  PromiseMessages,
  ToastConfig,
  ToastIcon,
  ToastRecord,
  ToastVariant,
} from "./types";

// the toast list lives in a plain module store, not in react context. that is
// what lets `toast.success(...)` work from any file - components, api clients,
// fetch interceptors - with no provider to wire up and no hook to call.
//
// <Toaster /> is only a subscriber. a toast fired before it mounts is kept in
// the store and shows up as soon as a toaster renders.

type Listener = (toasts: ToastRecord[]) => void;

// a leaving toast is normally dropped by its own card once the exit animation
// ends. this is the fallback for when no card is mounted to report that: the
// toaster unmounted mid-exit, or the toast was queued behind `max`.
const EXIT_SAFETY_MS = 3000;

let records: ToastRecord[] = [];
let counter = 0;
let warnedMissingToaster = false;

const listeners = new Set<Listener>();
const exitTimers = new Map<string | number, ReturnType<typeof setTimeout>>();

function commit(next: ToastRecord[]): void {
  records = next;
  for (const listener of listeners) listener(records);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastRecord[] {
  return records;
}

function nextId(): string {
  counter += 1;
  return `ztoast-${counter}`;
}

// bundlers cannot statically replace this, so it is read defensively: any
// runtime without `process` (browsers, workers) counts as development.
function isProduction(): boolean {
  const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } })
    .process?.env;
  return env?.NODE_ENV === "production";
}

/** diagnostics are development only, so a production bundle never logs */
export function devWarn(message: string): void {
  if (isProduction()) return;
  // eslint-disable-next-line no-console
  console.warn(`[ztoast] ${message}`);
}

// consumer callbacks must never be able to break the toast lifecycle
function fireClose(record: ToastRecord): void {
  const onClose = record.config.onClose;
  if (!onClose) return;
  try {
    onClose();
  } catch (error) {
    devWarn(`onClose callback threw: ${String(error)}`);
  }
}

function clearExitTimer(id: string | number): void {
  const timer = exitTimers.get(id);
  if (!timer) return;
  clearTimeout(timer);
  exitTimers.delete(id);
}

/**
 * replaces the fallback timer with the exact moment a mounted card's exit
 * animation ends, so a custom motion.exit of any length plays out in full.
 */
export function holdExit(id: string | number, ms: number): void {
  const record = records.find((item) => item.id === id);
  if (!record || !record.leaving) return;
  clearExitTimer(id);
  exitTimers.set(
    id,
    setTimeout(() => drop(id), Math.max(ms, 0))
  );
}

/** removes the record outright, once its exit animation has finished. */
export function drop(id: string | number): void {
  clearExitTimer(id);
  if (!records.some((record) => record.id === id)) return;
  commit(records.filter((record) => record.id !== id));
}

function startLeaving(record: ToastRecord): void {
  fireClose(record);
  exitTimers.set(
    record.id,
    setTimeout(() => drop(record.id), EXIT_SAFETY_MS)
  );
}

/** plays the exit animation, then removes. with no id, dismisses everything. */
export function dismiss(id?: string | number): void {
  if (id === undefined) {
    dismissAll();
    return;
  }

  const record = records.find((item) => item.id === id);
  // already leaving: never start a second exit, and never fire onClose twice
  if (!record || record.leaving) return;

  commit(
    records.map((item) => (item.id === id ? { ...item, leaving: true } : item))
  );
  startLeaving(record);
}

export function dismissAll(): void {
  const leaving = records.filter((record) => !record.leaving);
  if (leaving.length === 0) return;

  commit(
    records.map((record) =>
      record.leaving ? record : { ...record, leaving: true }
    )
  );
  for (const record of leaving) startLeaving(record);
}

function add(
  message: ReactNode,
  variant: ToastVariant,
  config: ToastConfig
): string | number {
  const id = config.id ?? nextId();

  // an id being reused may still have a pending exit timer from its previous
  // dismissal; letting it run would delete the toast we are adding right now
  clearExitTimer(id);

  const record: ToastRecord = {
    id,
    message,
    variant,
    config,
    createdAt: Date.now(),
    leaving: false,
  };

  const index = records.findIndex((item) => item.id === id);
  if (index === -1) {
    commit([...records, record]);
  } else {
    // replace in place so an updated toast keeps its spot in the stack
    const next = records.slice();
    next[index] = record;
    commit(next);
  }

  if (listeners.size === 0 && !warnedMissingToaster) {
    warnedMissingToaster = true;
    devWarn(
      "no <Toaster /> is mounted yet, so this toast is queued. render <Toaster /> " +
        "once at the root of your app."
    );
  }

  return id;
}

// the second argument is an icon or a config object, and both are optional, so
// it has to be sniffed: react elements, components, emoji strings and numbers
// are icons; anything else object shaped is the config.
function looksLikeIcon(value: unknown): boolean {
  if (value === null) return false;
  const type = typeof value;
  if (type === "string" || type === "number" || type === "function") return true;
  if (type === "boolean") return true;
  if (Array.isArray(value)) return true;
  return isValidElement(value);
}

export function normalizeArgs(
  a?: ToastIcon | ToastConfig,
  b?: ToastConfig
): ToastConfig {
  // both given: always (icon, config)
  if (b !== undefined) {
    return { ...b, icon: b.icon ?? (a as ToastIcon) };
  }
  if (a === undefined || a === null) return {};
  if (looksLikeIcon(a)) return { icon: a as ToastIcon };
  return a as ToastConfig;
}

function creator(variant: ToastVariant) {
  return (
    message: ReactNode,
    icon?: ToastIcon | ToastConfig,
    config?: ToastConfig
  ): string | number => add(message, variant, normalizeArgs(icon, config));
}

// resolves a static or callback message without letting a throwing consumer
// callback break the promise chain the caller is still awaiting
function resolveMessage<T>(
  message: ReactNode | ((value: T) => ReactNode),
  value: T
): ReactNode {
  if (typeof message !== "function") return message;
  try {
    return (message as (value: T) => ReactNode)(value);
  } catch (error) {
    devWarn(`toast.promise message callback threw: ${String(error)}`);
    return null;
  }
}

function trackPromise<T>(
  promise: Promise<T>,
  messages: PromiseMessages<T>,
  config: ToastConfig = {}
): Promise<T> {
  if (!promise || typeof promise.then !== "function") {
    devWarn("toast.promise() expects a promise as its first argument.");
    return promise;
  }

  const id = config.id ?? nextId();
  const duration = config.duration ?? 4000;

  add(messages.loading, "loading", { ...config, id, duration: Infinity });

  // a two argument then() attaches the rejection handler to the original
  // promise, so tracking it never turns the caller's rejection into an
  // "unhandled promise rejection" warning. the caller still receives it.
  promise.then(
    (value) => {
      add(resolveMessage(messages.success, value), "success", {
        ...config,
        id,
        duration,
      });
    },
    (error: unknown) => {
      add(resolveMessage(messages.error, error), "error", {
        ...config,
        id,
        duration,
      });
    }
  );

  return promise;
}

/**
 * only the message is required. the icon and the config are both optional, and
 * every key of the config is optional too:
 *
 *   toast.warn("Login failed");
 *   toast.success("Saved", <CheckIcon />, { bgColor: "#052e16", width: 340 });
 *   toast.error("Failed", { position: "bottom-10vh" });
 */
export const toast = {
  show: creator("default"),
  success: creator("success"),
  error: creator("error"),
  info: creator("info"),
  warning: creator("warning"),
  /** alias of toast.warning */
  warn: creator("warning"),
  /** persists until dismissed or replaced, unless a duration is given */
  loading: (
    message: ReactNode,
    icon?: ToastIcon | ToastConfig,
    config?: ToastConfig
  ): string | number =>
    add(message, "loading", {
      duration: Infinity,
      ...normalizeArgs(icon, config),
    }),
  promise: trackPromise,
  dismiss,
  dismissAll,
};
