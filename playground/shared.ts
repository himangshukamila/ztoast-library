import type { NamedPosition, ToastVariant } from "../src";
import { css } from "../src/css";

export const visibleLimit = 2;
export const initialMotion = { enter: 500, exit: 450, exitHold: 2000 };

export type DescriptionMode = "text" | "none" | "team";
export type IconMode = "default" | "text" | "jsx" | "none";

export const positions: NamedPosition[] = [
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
];

export const presets: {
  variant: ToastVariant;
  label: string;
  title: string;
  description: string;
}[] = [
  { variant: "success", label: "Success", title: "Saved successfully", description: "Your changes have been saved. You're all set." },
  { variant: "error", label: "Error", title: "Failed to save", description: "Something went wrong. Please try again." },
  { variant: "warning", label: "Warning", title: "Unsaved changes", description: "You have unsaved changes on this page." },
  { variant: "info", label: "Info", title: "New update available", description: "Version 2.0 is ready whenever you are." },
  { variant: "loading", label: "Loading", title: "Getting things ready", description: "A loading toast for your in-progress work." },
  { variant: "default", label: "Default", title: "A little heads-up", description: "A simple notification, right where you need it." },
];

export interface PreviewSettings {
  theme: "dark" | "light";
  position: NamedPosition;
  progress: boolean;
  bgColor?: string;
}

export const initialSettings: PreviewSettings = {
  theme: "dark",
  position: "center",
  progress: true,
};

export type PreviewCommand =
  | { source: "ztoast-playground"; action: "ready" }
  | { source: "ztoast-playground"; action: "configure"; settings: PreviewSettings }
  | { source: "ztoast-playground"; action: "dismiss" }
  | {
      source: "ztoast-playground";
      action: "show";
      variant: ToastVariant;
      title: string;
      description: string;
      descriptionMode: DescriptionMode;
      iconMode: IconMode;
      customIcon: string;
      duration: number | "persistent";
      closable: boolean;
      motion: { enter: number; exit: number; exitHold: number };
    };

export function isPreviewCommand(value: unknown): value is PreviewCommand {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (item.source !== "ztoast-playground") return false;
  if (item.action === "dismiss" || item.action === "ready") return true;
  if (item.action === "show") {
    if (!item.motion || typeof item.motion !== "object") return false;
    const motion = item.motion as Record<string, unknown>;
    return presets.some((preset) => preset.variant === item.variant) &&
      typeof item.title === "string" && typeof item.description === "string" &&
      (item.descriptionMode === "text" || item.descriptionMode === "none" || item.descriptionMode === "team") &&
      (item.iconMode === "default" || item.iconMode === "text" || item.iconMode === "jsx" || item.iconMode === "none") &&
      typeof item.customIcon === "string" &&
      typeof item.closable === "boolean" &&
      [motion.enter, motion.exit].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 3000) &&
      typeof motion.exitHold === "number" && Number.isFinite(motion.exitHold) && motion.exitHold >= 0 && motion.exitHold <= 5000 &&
      (item.duration === "persistent" ||
        (typeof item.duration === "number" && Number.isFinite(item.duration) && item.duration > 0));
  }
  if (item.action !== "configure" || !item.settings || typeof item.settings !== "object") return false;
  const settings = item.settings as Record<string, unknown>;
  return (settings.theme === "dark" || settings.theme === "light") &&
    positions.some((position) => position === settings.position) &&
    typeof settings.progress === "boolean" &&
    (settings.bgColor === undefined || css(settings.bgColor) !== undefined);
}
