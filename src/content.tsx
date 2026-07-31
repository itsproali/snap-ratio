import cssText from "data-text:@/style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Rnd } from "react-rnd"

import {
  formatBytes,
  isCaptureError,
  type CaptureMessage,
  type CaptureResponse,
  type CaptureResult
} from "@/lib/messages"
import {
  DEFAULT_SETTINGS,
  getLastBounds,
  getSettings,
  resolveAspectRatio,
  setLastBounds,
  type SelectionBounds,
  type Settings
} from "@/lib/settings"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  all_frames: false
}

/**
 * Generates a style element with adjusted CSS to work correctly within a Shadow DOM.
 *
 * Tailwind CSS relies on `rem` units, which are based on the root font size (typically defined on the <html>
 * or <body> element). However, in a Shadow DOM (as used by Plasmo), there is no native root element, so the
 * rem values would reference the actual page's root font size-often leading to sizing inconsistencies.
 *
 * To address this, we:
 * 1. Replace the `:root` selector with `:host(plasmo-csui)` to properly scope the styles within the Shadow DOM.
 * 2. Convert all `rem` units to pixel values using a fixed base font size, ensuring consistent styling
 *    regardless of the host page's font size.
 */
export const getStyle = (): HTMLStyleElement => {
  const baseFontSize = 16

  let updatedCssText = cssText.replaceAll(":root", ":host(plasmo-csui)")
  const remRegex = /([\d.]+)rem/g
  updatedCssText = updatedCssText.replace(remRegex, (match, remValue) => {
    const pixelsValue = parseFloat(remValue) * baseFontSize

    return `${pixelsValue}px`
  })

  const styleElement = document.createElement("style")

  styleElement.textContent = updatedCssText

  return styleElement
}

const MIN_WIDTH = 120
const MIN_HEIGHT = 68

/**
 * Computes the initial selection rect from the user's settings.
 * `remembered` is only used when the user picked the "remember last" anchor.
 */
function computeInitialBounds(
  settings: Settings,
  remembered: SelectionBounds | null
): SelectionBounds {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const ratio = resolveAspectRatio(settings)

  if (settings.defaultAnchor === "remember" && remembered) {
    // Clamp the remembered rect into the current viewport, which may differ
    // from the one it was captured in.
    const width = Math.min(remembered.width, viewportWidth)
    const height = Math.min(remembered.height, viewportHeight)

    return {
      width,
      height,
      x: clampNumber(remembered.x, 0, Math.max(0, viewportWidth - width)),
      y: clampNumber(remembered.y, 0, Math.max(0, viewportHeight - height))
    }
  }

  let width = Math.min(
    (viewportWidth * settings.defaultWidthPercent) / 100,
    settings.maxDefaultWidth,
    viewportWidth
  )
  let height = ratio ? width / ratio : width * (9 / 16)

  // A tall ratio (e.g. 9:16) can overflow the viewport height, so scale back.
  if (height > viewportHeight) {
    height = viewportHeight * 0.9
    width = ratio ? height * ratio : width
  }

  width = Math.max(MIN_WIDTH, Math.round(width))
  height = Math.max(MIN_HEIGHT, Math.round(height))

  const position = resolveAnchorPosition(
    settings,
    width,
    height,
    viewportWidth,
    viewportHeight
  )

  return { ...position, width, height }
}

function resolveAnchorPosition(
  settings: Settings,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } {
  const maxX = Math.max(0, viewportWidth - width)
  const maxY = Math.max(0, viewportHeight - height)
  const centerX = maxX / 2
  const centerY = maxY / 2

  switch (settings.defaultAnchor) {
    case "top-left":
      return { x: 0, y: 0 }
    case "top-center":
      return { x: centerX, y: 0 }
    case "top-right":
      return { x: maxX, y: 0 }
    case "bottom-left":
      return { x: 0, y: maxY }
    case "bottom-center":
      return { x: centerX, y: maxY }
    case "bottom-right":
      return { x: maxX, y: maxY }
    case "custom":
      return {
        x: clampNumber(settings.customX, 0, maxX),
        y: clampNumber(settings.customY, 0, maxY)
      }
    case "remember":
    case "center":
    default:
      return { x: centerX, y: centerY }
  }
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min

  return Math.min(max, Math.max(min, value))
}

/**
 * Selection overlay for choosing the capture region.
 * Uses react-rnd for drag/resize, with the aspect ratio and appearance
 * driven entirely by the user's saved settings.
 */
const SelectionOverlay = ({
  settings,
  initialBounds,
  onCapture,
  onCancel
}: {
  settings: Settings
  initialBounds: SelectionBounds
  onCapture: (bounds: SelectionBounds) => void
  onCancel: () => void
}) => {
  const [bounds, setBounds] = useState<SelectionBounds>(initialBounds)
  const ratio = resolveAspectRatio(settings)
  const accent = settings.accentColor

  // Keep the latest bounds in a ref so the key handler never goes stale.
  const boundsRef = useRef(bounds)
  boundsRef.current = bounds

  /** Re-clamps the selection when the window is resized mid-selection. */
  useEffect(() => {
    const handleResize = () => {
      setBounds((prev) => {
        const width = Math.min(prev.width, window.innerWidth)
        const height = Math.min(prev.height, window.innerHeight)

        return {
          width,
          height,
          x: clampNumber(prev.x, 0, Math.max(0, window.innerWidth - width)),
          y: clampNumber(prev.y, 0, Math.max(0, window.innerHeight - height))
        }
      })
    }

    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [])

  /** Enter captures, Escape cancels, arrows nudge the selection. */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        onCancel()

        return
      }

      if (event.key === "Enter") {
        event.preventDefault()
        event.stopPropagation()
        onCapture(boundsRef.current)

        return
      }

      const nudges: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0]
      }

      const delta = nudges[event.key]

      if (!delta) return

      event.preventDefault()
      event.stopPropagation()

      const step = event.shiftKey ? 10 : 1

      setBounds((prev) => ({
        ...prev,
        x: clampNumber(
          prev.x + delta[0] * step,
          0,
          Math.max(0, window.innerWidth - prev.width)
        ),
        y: clampNumber(
          prev.y + delta[1] * step,
          0,
          Math.max(0, window.innerHeight - prev.height)
        )
      }))
    }

    // Capture phase so the host page cannot swallow the shortcut first.
    window.addEventListener("keydown", handleKeyDown, true)

    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [onCapture, onCancel])

  const handleStyle = (size: number) => ({
    width: `${size}px`,
    height: `${size}px`,
    backgroundColor: accent,
    border: "2px solid white",
    borderRadius: "50%",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
  })

  const edgeOffset = -5
  const cornerOffset = -6

  return (
    // Transparent on purpose: the dimming comes from the selection box's
    // huge spread box-shadow below, which leaves the selected region clear.
    <div className="fixed inset-0 z-[2147483646]">
      <Rnd
        size={{ width: bounds.width, height: bounds.height }}
        position={{ x: bounds.x, y: bounds.y }}
        onDragStop={(_e, d) => {
          setBounds((prev) => ({
            ...prev,
            x: clampNumber(d.x, 0, Math.max(0, window.innerWidth - prev.width)),
            y: clampNumber(
              d.y,
              0,
              Math.max(0, window.innerHeight - prev.height)
            )
          }))
        }}
        onResizeStop={(_e, _direction, ref, _delta, position) => {
          setBounds({
            x: position.x,
            y: position.y,
            width: ref.offsetWidth,
            height: ref.offsetHeight
          })
        }}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        // `lockAspectRatio` handles the ratio math for us, including the
        // position compensation when dragging a top/left handle.
        lockAspectRatio={ratio ?? false}
        bounds="window"
        enableResizing={{
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true
        }}
        style={{
          border: `2px solid ${accent}`,
          backgroundColor: "transparent",
          boxShadow: `0 0 0 1px rgba(255,255,255,0.35), 0 0 0 9999px rgba(0,0,0,${
            settings.backdropOpacity / 100
          })`,
          cursor: "move"
        }}
        resizeHandleStyles={{
          top: {
            ...handleStyle(10),
            top: edgeOffset,
            left: "50%",
            marginLeft: -5
          },
          bottom: {
            ...handleStyle(10),
            bottom: edgeOffset,
            left: "50%",
            marginLeft: -5
          },
          left: {
            ...handleStyle(10),
            left: edgeOffset,
            top: "50%",
            marginTop: -5
          },
          right: {
            ...handleStyle(10),
            right: edgeOffset,
            top: "50%",
            marginTop: -5
          },
          topLeft: {
            ...handleStyle(12),
            top: cornerOffset,
            left: cornerOffset
          },
          topRight: {
            ...handleStyle(12),
            top: cornerOffset,
            right: cornerOffset
          },
          bottomLeft: {
            ...handleStyle(12),
            bottom: cornerOffset,
            left: cornerOffset
          },
          bottomRight: {
            ...handleStyle(12),
            bottom: cornerOffset,
            right: cornerOffset
          }
        }}>
        <div className="relative h-full w-full">
          {settings.showGrid && <RuleOfThirdsGrid />}

          {settings.showDimensions && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                className="rounded px-2 py-1 text-xs font-semibold text-white shadow"
                style={{ backgroundColor: accent }}>
                {Math.round(bounds.width)} x {Math.round(bounds.height)}
              </span>
            </div>
          )}
        </div>
      </Rnd>

      {/* Control bar */}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-white/95 p-2 shadow-2xl backdrop-blur">
        <button
          onClick={() => onCapture(bounds)}
          className="rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none"
          style={{ backgroundColor: accent }}>
          Capture
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 focus:outline-none">
          Cancel
        </button>
        <span className="px-1.5 text-[11px] text-gray-400">
          Enter to capture &middot; Esc to cancel
        </span>
      </div>
    </div>
  )
}

function RuleOfThirdsGrid() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
      <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
      <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
      <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
    </div>
  )
}

/**
 * Module-level overlay state.
 *
 * The message listener is registered as soon as the content script evaluates,
 * which is earlier than React mounting, so incoming requests are never lost.
 */
const overlayState = {
  show: false,
  name: "",
  listeners: new Set<() => void>(),
  emit() {
    this.listeners.forEach((listener) => listener())
  },
  open(name: string) {
    this.name = name
    this.show = true
    this.emit()
  },
  close() {
    this.show = false
    this.emit()
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "showSelectionOverlay") {
    overlayState.open(message.name ?? "")
    sendResponse({ success: true })

    return false
  }

  if (message?.action === "commandStartCapture") {
    overlayState.open("")
    sendResponse({ success: true })

    return false
  }

  return false
})

/** Result dialog shown after a successful capture. */
const ResultDialog = ({
  result,
  onClose
}: {
  result: CaptureResult
  onClose: () => void
}) => {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  const handleDownload = () => {
    const link = document.createElement("a")

    link.href = result.imageDataUrl
    link.download = result.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    onClose()
  }

  const handleCopy = async () => {
    try {
      const blob = await (await fetch(result.imageDataUrl)).blob()

      // The async clipboard API only accepts PNG for images, so re-encode
      // anything else through a canvas before writing.
      const pngBlob =
        blob.type === "image/png" ? blob : await toPngBlob(result.imageDataUrl)

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob })
      ])

      setCopied(true)
      setCopyError(null)
    } catch (err) {
      console.error("[Snap Ratio] Clipboard write failed", err)
      setCopyError("Could not copy. Try downloading instead.")
    }
  }

  const remote = result.stats.remote

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-5 py-3.5">
          <h2 className="text-base font-semibold text-gray-800">
            Capture ready
          </h2>
          <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400">
            {result.filename}
          </p>
        </div>

        <div className="bg-gray-50 p-4">
          <img
            src={result.imageDataUrl}
            alt="Captured preview"
            className="mx-auto max-h-56 w-auto rounded-lg border border-gray-200 bg-white shadow-sm"
          />
        </div>

        <div className="px-5 py-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
            <span>
              {result.stats.width} x {result.stats.height} px
            </span>
            <span>{formatBytes(result.stats.bytes)}</span>
            <span>
              {result.stats.format.replace("image/", "").toUpperCase()}
            </span>
            {result.stats.format !== "image/png" && (
              <span>Quality {Math.round(result.stats.quality * 100)}%</span>
            )}
          </div>

          {remote && (
            <p
              className={`mt-2 text-[11px] ${
                remote.compressed ? "text-green-600" : "text-amber-600"
              }`}>
              {remote.compressed
                ? `Remote compression saved ${remote.reduction}.`
                : `Remote compression skipped: ${remote.error}`}
            </p>
          )}

          {copyError && (
            <p className="mt-2 text-[11px] text-red-600">{copyError}</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-5 py-3">
          <button
            onClick={handleDownload}
            className="flex-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus:outline-none">
            Download
          </button>
          <button
            onClick={handleCopy}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 focus:outline-none">
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 focus:outline-none">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/** Re-encodes any image data URL as a PNG blob for the clipboard. */
async function toPngBlob(dataUrl: string): Promise<Blob> {
  const image = new Image()

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("Failed to decode image"))
    image.src = dataUrl
  })

  const canvas = document.createElement("canvas")

  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  const ctx = canvas.getContext("2d")

  if (!ctx) throw new Error("Canvas unavailable")

  ctx.drawImage(image, 0, 0)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encode failed"))),
      "image/png"
    )
  })
}

const LoadingUI = () => (
  <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/60">
    <div className="flex flex-col items-center rounded-xl bg-white px-8 py-6 shadow-2xl">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-brand-700" />
      <p className="mt-3 text-sm font-medium text-gray-700">Processing</p>
      <p className="mt-0.5 text-xs text-gray-400">
        Cropping, resizing and encoding
      </p>
    </div>
  </div>
)

const Toast = ({
  message,
  onDone
}: {
  message: string
  onDone: () => void
}) => {
  useEffect(() => {
    const timer = setTimeout(onDone, 2600)

    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="fixed bottom-6 left-1/2 z-[2147483647] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-2xl">
      {message}
    </div>
  )
}

const PlasmoOverlay = () => {
  const [showOverlay, setShowOverlay] = useState(overlayState.show)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [initialBounds, setInitialBounds] = useState<SelectionBounds | null>(
    null
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<CaptureResult | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  /** Subscribe to the module-level overlay state. */
  useEffect(() => {
    const update = () => setShowOverlay(overlayState.show)

    overlayState.listeners.add(update)
    update()

    return () => {
      overlayState.listeners.delete(update)
    }
  }, [])

  /**
   * Load fresh settings every time the overlay opens, so changes made in the
   * popup take effect without reloading the page.
   */
  useEffect(() => {
    if (!showOverlay) return

    // A leftover toast from the previous capture would otherwise linger over
    // the new selection UI.
    setToast(null)

    let cancelled = false

    const load = async () => {
      const [loaded, remembered] = await Promise.all([
        getSettings(),
        getLastBounds()
      ])

      if (cancelled) return

      setSettings(loaded)
      setInitialBounds(computeInitialBounds(loaded, remembered))
    }

    load().catch((err) => {
      console.error("[Snap Ratio] Failed to load settings", err)

      if (!cancelled) {
        setSettings(DEFAULT_SETTINGS)
        setInitialBounds(computeInitialBounds(DEFAULT_SETTINGS, null))
      }
    })

    return () => {
      cancelled = true
    }
  }, [showOverlay])

  const handleCapture = useCallback(
    async (bounds: SelectionBounds) => {
      // Hide the overlay before the screenshot so it is not captured itself.
      overlayState.close()

      if (settings.defaultAnchor === "remember") {
        void setLastBounds(bounds)
      }

      // Two frames guarantees the removal has been painted.
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))
      )

      setIsProcessing(true)

      try {
        const message: CaptureMessage = {
          action: "captureScreenshot",
          bounds,
          name: overlayState.name,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio || 1
          },
          pageTitle: document.title
        }

        const response: CaptureResponse | undefined =
          await chrome.runtime.sendMessage(message)

        setIsProcessing(false)

        if (!response) {
          throw new Error("No response from the extension background worker.")
        }

        if (isCaptureError(response)) {
          throw new Error(response.error)
        }

        await handleSuccess(response)
      } catch (error) {
        console.error("[Snap Ratio] Capture failed", error)
        setIsProcessing(false)
        setToast(
          error instanceof Error ? error.message : "Capture failed. Try again."
        )
      }
    },
    [settings.defaultAnchor]
  )

  /** Applies the user's configured post-capture action. */
  const handleSuccess = async (response: CaptureResult) => {
    if (response.afterCapture === "preview") {
      setResult(response)

      return
    }

    if (response.afterCapture === "download") {
      // The background worker already saved it via chrome.downloads.
      setToast(`Saved ${response.filename}`)

      return
    }

    try {
      const pngBlob = await toPngBlob(response.imageDataUrl)

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob })
      ])

      setToast("Copied to clipboard")
    } catch (err) {
      console.error("[Snap Ratio] Clipboard write failed", err)
      // Clipboard writes need a focused document; fall back to the dialog.
      setResult(response)
    }
  }

  const handleCancel = useCallback(() => {
    overlayState.close()
    setIsProcessing(false)
    setResult(null)
  }, [])

  const handleCloseResult = useCallback(() => setResult(null), [])
  const handleToastDone = useCallback(() => setToast(null), [])

  // The toast is rendered alongside the other surfaces rather than instead of
  // them, so a capture started while a toast is still fading is not swallowed.
  const toastNode = toast ? (
    <Toast message={toast} onDone={handleToastDone} />
  ) : null

  let surface: ReactNode = null

  if (result) {
    surface = <ResultDialog result={result} onClose={handleCloseResult} />
  } else if (isProcessing) {
    surface = <LoadingUI />
  } else if (showOverlay && initialBounds) {
    surface = (
      <SelectionOverlay
        // Remount whenever the starting rect changes so react-rnd picks up the
        // new size/position instead of keeping its previous internal state.
        key={`${initialBounds.x}-${initialBounds.y}-${initialBounds.width}`}
        settings={settings}
        initialBounds={initialBounds}
        onCapture={handleCapture}
        onCancel={handleCancel}
      />
    )
  }

  return (
    <>
      {surface}
      {toastNode}
    </>
  )
}

export default PlasmoOverlay
