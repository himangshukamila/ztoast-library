import { createElement } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import type { ToastIcon, ToastVariant } from "./types";

// inline svgs so the library keeps zero runtime dependencies. a consumer icon
// always wins: pass a node (<FaCheck />, an <svg>, "🎉") or a component
// reference (FaCheck), which is called with { size, color }.

const SIZE = 18;

function strokeProps(color: string): SVGProps<SVGSVGElement> {
  return {
    width: SIZE,
    height: SIZE,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    style: { display: "block", flexShrink: 0 },
  };
}

function variantIcon(variant: ToastVariant, color: string): ReactNode {
  switch (variant) {
    case "success":
      return (
        <svg {...strokeProps(color)}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12.5 2.5 2.5L16 9.5" />
        </svg>
      );
    case "error":
      return (
        <svg {...strokeProps(color)}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      );
    case "warning":
      return (
        <svg {...strokeProps(color)}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "info":
      return (
        <svg {...strokeProps(color)}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      );
    case "loading":
      return (
        <svg {...strokeProps(color)}>
          <path d="M12 3a9 9 0 1 0 9 9" opacity="0.9" />
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur="0.9s"
            repeatCount="indefinite"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function renderIcon(
  icon: ToastIcon | undefined,
  variant: ToastVariant,
  color: string
): ReactNode {
  if (icon === undefined) return variantIcon(variant, color);
  // `icon: false` (or null) explicitly means "no icon at all"
  if (icon === false || icon === null) return null;

  const node =
    typeof icon === "function"
      ? createElement(icon as ComponentType<Record<string, unknown>>, {
          size: SIZE,
          color,
        })
      : icon;

  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        lineHeight: 0,
        color,
        fontSize: SIZE,
      }}
    >
      {node}
    </span>
  );
}
