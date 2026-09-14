/**
 * Minimal inline SVG icon set.
 *
 * Deliberately hand-rolled rather than pulled from an icon package: the popup
 * and the content script both run under the extension CSP, and inlining keeps
 * the bundle free of a runtime icon dependency.
 */

import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}>
      {children}
    </svg>
  )
}

/** Crop frame - used as the product mark and for the capture-area section. */
export function IconCrop(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </Svg>
  )
}

export function IconZap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 14h6v8l10-12h-6V2z" />
    </Svg>
  )
}

export function IconType(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </Svg>
  )
}

export function IconImage(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </Svg>
  )
}

export function IconSliders(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </Svg>
  )
}

export function IconPalette(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 22a10 10 0 1 1 10-10c0 1.7-1.3 3-3 3h-1.5a2.5 2.5 0 0 0-1.8 4.2A2 2 0 0 1 14 22z" />
      <circle cx="7.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconCloudUp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 13v8" />
      <path d="m8 17 4-4 4 4" />
      <path d="M20.9 18.1A5 5 0 0 0 18 9h-1.3A8 8 0 1 0 3 16.3" />
    </Svg>
  )
}

export function IconRotateCcw(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8" />
      <path d="M3 3v5h5" />
    </Svg>
  )
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Svg>
  )
}

export function IconKeyboard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </Svg>
  )
}

export function IconExternal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Svg>
  )
}
