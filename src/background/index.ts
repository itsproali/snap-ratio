/**
 * Background service worker.
 *
 * Responsibilities:
 * - crop / resize / encode the visible tab into the user's configured output
 * - save the file when the user chose "download" as the post-capture action
 * - relay the keyboard command to the content script
 *
 * All image work happens on-device via OffscreenCanvas. The extension makes no
 * network requests at all.
 */

import type {
  CaptureMessage,
  CaptureResponse,
  CaptureResult
} from "@/lib/messages"
import {
  buildFilename,
  extensionFor,
  getSettings,
  type SelectionBounds,
  type Settings
} from "@/lib/settings"

const isDev = process.env.NODE_ENV !== "production"

function debug(...args: unknown[]): void {
  if (isDev) {
    console.log("[Snap Ratio]", ...args)
  }
}

/* -------------------------------------------------------------------------- */
/*                              image processing                              */
/* -------------------------------------------------------------------------- */

interface CroppedImage {
  canvas: OffscreenCanvas
  width: number
  height: number
}

/**
 * Crops the screenshot to the selected region and scales it to the configured
 * output size.
 *
 * `captureVisibleTab` returns an image in device pixels, while the selection
 * bounds are in CSS pixels, so the crop rect is scaled by the ratio between
 * the screenshot and the viewport the content script measured.
 */
async function cropAndResize(
  screenshotDataUrl: string,
  bounds: SelectionBounds,
  viewport: CaptureMessage["viewport"],
  settings: Settings
): Promise<CroppedImage> {
  const response = await fetch(screenshotDataUrl)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)

  const scaleX = bitmap.width / Math.max(1, viewport.width)
  const scaleY = bitmap.height / Math.max(1, viewport.height)

  // Scale the CSS-pixel selection into screenshot pixel space.
  const sourceX = clamp(Math.round(bounds.x * scaleX), 0, bitmap.width - 1)
  const sourceY = clamp(Math.round(bounds.y * scaleY), 0, bitmap.height - 1)
  const sourceWidth = clamp(
    Math.round(bounds.width * scaleX),
    1,
    bitmap.width - sourceX
  )
  const sourceHeight = clamp(
    Math.round(bounds.height * scaleY),
    1,
    bitmap.height - sourceY
  )

  // Derive the output size from the *actual* crop, so a free-form selection
  // keeps its own proportions instead of being forced into 16:9.
  let targetWidth: number
  let targetHeight: number

  if (settings.resizeMode === "native") {
    targetWidth = sourceWidth
    targetHeight = sourceHeight
  } else {
    targetWidth = Math.max(1, Math.round(settings.outputWidth))
    targetHeight = Math.max(
      1,
      Math.round(targetWidth * (sourceHeight / sourceWidth))
    )
  }

  const canvas = new OffscreenCanvas(targetWidth, targetHeight)
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Could not get a 2D canvas context.")
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  // Draw straight from the bitmap: one resample instead of crop-then-scale.
  ctx.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight
  )

  bitmap.close()

  return { canvas, width: targetWidth, height: targetHeight }
}

/**
 * Encodes the canvas, stepping quality down until the result fits under
 * `maxFileSizeKb`. Returns the blob together with the quality actually used.
 */
async function encode(
  canvas: OffscreenCanvas,
  settings: Settings
): Promise<{ blob: Blob; quality: number }> {
  const type = settings.format

  if (type === "image/png") {
    // PNG is lossless; quality is not a parameter.
    return { blob: await canvas.convertToBlob({ type }), quality: 1 }
  }

  let quality = settings.quality
  let blob = await canvas.convertToBlob({ type, quality })

  const maxBytes = settings.maxFileSizeKb * 1024

  if (maxBytes <= 0 || blob.size <= maxBytes) {
    return { blob, quality }
  }

  // Step down in fixed increments. Bounded to keep worst-case work small.
  const MIN_QUALITY = 0.2
  const STEP = 0.1

  while (blob.size > maxBytes && quality - STEP >= MIN_QUALITY) {
    quality = Number((quality - STEP).toFixed(2))
    blob = await canvas.convertToBlob({ type, quality })
  }

  if (blob.size > maxBytes) {
    debug(
      `Could not reach ${settings.maxFileSizeKb}KB target; smallest was ${Math.round(
        blob.size / 1024
      )}KB at quality ${quality}.`
    )
  }

  return { blob, quality }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min

  return Math.min(max, Math.max(min, value))
}

/* -------------------------------------------------------------------------- */
/*                                  capture                                   */
/* -------------------------------------------------------------------------- */

/** Converts a blob to a data URL without blowing the call stack on big files. */
async function blobToDataUrl(blob: Blob, mimeType: string): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer())
  const CHUNK_SIZE = 8192
  let binary = ""

  for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK_SIZE))
  }

  return `data:${mimeType};base64,${btoa(binary)}`
}

async function handleCapture(
  message: CaptureMessage,
  tab: chrome.tabs.Tab
): Promise<CaptureResponse> {
  const settings = await getSettings()

  const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png"
  })

  if (!screenshot) {
    throw new Error("Chrome returned an empty screenshot.")
  }

  const { canvas, width, height } = await cropAndResize(
    screenshot,
    message.bounds,
    message.viewport,
    settings
  )

  const { blob: finalBlob, quality } = await encode(canvas, settings)

  const extension = extensionFor(settings.format)

  let domain = ""

  try {
    domain = tab.url ? new URL(tab.url).hostname : ""
  } catch {
    domain = ""
  }

  const filename = `${buildFilename(settings.filenameTemplate, {
    name: message.name,
    domain,
    title: message.pageTitle || tab.title || "",
    width,
    height,
    now: new Date()
  })}.${extension}`

  const imageDataUrl = await blobToDataUrl(finalBlob, settings.format)

  let afterCapture = settings.afterCapture

  if (afterCapture === "download") {
    const saved = await saveToDisk(imageDataUrl, filename)

    // If the download was blocked, fall back to the preview dialog so the
    // user still has a way to get their image.
    if (!saved) {
      afterCapture = "preview"
    }
  }

  return {
    success: true,
    filename,
    imageDataUrl,
    afterCapture,
    stats: {
      width,
      height,
      bytes: finalBlob.size,
      quality,
      format: settings.format
    }
  }
}

/** Saves via chrome.downloads. Returns false if the download was rejected. */
async function saveToDisk(dataUrl: string, filename: string): Promise<boolean> {
  try {
    await chrome.downloads.download({ url: dataUrl, filename, saveAs: false })

    return true
  } catch (error) {
    debug("Download failed:", error)

    return false
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== "captureScreenshot") {
    return false
  }

  const tab = sender.tab

  if (!tab?.id) {
    sendResponse({ success: false, error: "Could not identify the tab." })

    return false
  }

  handleCapture(message as CaptureMessage, tab)
    .then(sendResponse)
    .catch((error) => {
      console.error("[Snap Ratio] Capture failed", error)
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Capture failed."
      })
    })

  // Keep the message channel open for the async response.
  return true
})

/* -------------------------------------------------------------------------- */
/*                             keyboard shortcut                              */
/* -------------------------------------------------------------------------- */

chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== "start-capture") return

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.id) return

  try {
    await chrome.tabs.sendMessage(tab.id, { action: "commandStartCapture" })
  } catch {
    // No content script on this tab (e.g. chrome:// page) - nothing to do.
    debug("Keyboard shortcut ignored: no content script on this tab.")
  }
})
