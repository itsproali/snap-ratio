/**
 * Typed message contract shared by the popup, content script and background
 * service worker.
 */

import type { AfterCaptureAction, SelectionBounds } from "@/lib/settings"

/** Popup -> content script: show the selection overlay. */
export interface ShowOverlayMessage {
  action: "showSelectionOverlay"
  /** Free-form name typed by the user; feeds the `{name}` filename token. */
  name: string
}

/**
 * Content script -> background: crop, resize, encode the visible tab.
 *
 * The content script measures the viewport itself and passes it along, which
 * is why the extension no longer needs the `scripting` permission just to read
 * `window.innerWidth` from the service worker.
 */
export interface CaptureMessage {
  action: "captureScreenshot"
  bounds: SelectionBounds
  name: string
  viewport: {
    width: number
    height: number
    devicePixelRatio: number
  }
  pageTitle: string
}

/** Background -> content script response for a capture request. */
export interface CaptureResult {
  success: true
  filename: string
  imageDataUrl: string
  /** What the content script should do next, taken from the user's settings. */
  afterCapture: AfterCaptureAction
  stats: {
    width: number
    height: number
    bytes: number
    /** Quality actually used, after any max-file-size retries. */
    quality: number
    format: string
    /** Present only when remote compression ran. */
    remote?: {
      compressed: boolean
      error?: string
      originalBytes?: number
      compressedBytes?: number
      reduction?: string
    }
  }
}

export interface CaptureError {
  success: false
  error: string
}

export type CaptureResponse = CaptureResult | CaptureError

/**
 * Plasmo's base tsconfig sets `strict: false`, which disables narrowing a
 * union by a boolean literal discriminant, so these guards do it explicitly.
 */
export function isCaptureSuccess(
  response: CaptureResponse
): response is CaptureResult {
  return response.success === true
}

export function isCaptureError(
  response: CaptureResponse
): response is CaptureError {
  return response.success === false
}

/** Background -> content script: triggered by the keyboard command. */
export interface CommandTriggerMessage {
  action: "commandStartCapture"
}

export type RuntimeMessage =
  ShowOverlayMessage | CaptureMessage | CommandTriggerMessage

/** Formats a byte count for display, e.g. "412 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
