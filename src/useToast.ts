import { useEffect, useMemo, useState } from "react";
import { getToasts, subscribe, toast } from "./store";
import type { ToastRecord } from "./types";

/** live list of toasts currently in the store. */
export function useToastList(): ToastRecord[] {
  const [toasts, setToasts] = useState<ToastRecord[]>(getToasts);

  useEffect(() => {
    // re-read first: a toast fired between this render and the subscription
    // would otherwise be missed
    setToasts(getToasts());
    return subscribe(setToasts);
  }, []);

  return toasts;
}

/**
 * optional hook, for components that want to read the live toast list. the
 * imperative api is returned alongside it purely for convenience - `toast.*`
 * works just as well from anywhere, including outside react.
 */
export function useToast() {
  const toasts = useToastList();
  return useMemo(() => ({ toasts, ...toast }), [toasts]);
}
