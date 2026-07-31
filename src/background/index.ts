/**
 * Background service worker.
 *
 * Responsibilities:
 * - crop / resize / encode the visible tab into the user's configured output
 * - optionally hand the result to iLoveIMG for extra compression
 * - save the file when the user chose "download" as the post-capture action
 * - relay the keyboard command to the content script
 *
 * All image work happens on-device via OffscreenCanvas. Nothing leaves the
 * browser unless the user explicitly enables remote compression and supplies
 * their own API key.
 */

import type {
  CaptureMessage,
  CaptureResponse,
  CaptureResult
} from "~lib/messages"
import {
  buildFilename,
  extensionFor,
  getSettings,
  type SelectionBounds,
  type Settings
} from "~lib/settings"

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
/*                          optional remote compression                       */
/* -------------------------------------------------------------------------- */

const ILOVEIMG_BASE_URL = "https://api.iloveimg.com"
const ILOVEIMG_TOOL = "compressimage"
const TOKEN_VALIDITY_MS = 2 * 60 * 60 * 1000

let cachedToken: { token: string; key: string; expiresAt: number } | null = null

async function getAuthToken(publicKey: string): Promise<string> {
  const now = Date.now()

  // Re-authenticate if the key changed, not just when the token expired.
  if (
    cachedToken &&
    cachedToken.key === publicKey &&
    cachedToken.expiresAt > now
  ) {
    return cachedToken.token
  }

  const response = await fetch(`${ILOVEIMG_BASE_URL}/v1/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_key: publicKey })
  })

  if (!response.ok) {
    throw new Error(
      `Authentication failed (${response.status}). Check your iLoveIMG public key.`
    )
  }

  const data = await response.json()

  if (!data?.token) {
    throw new Error("iLoveIMG did not return a token.")
  }

  cachedToken = {
    token: data.token,
    key: publicKey,
    expiresAt: now + TOKEN_VALIDITY_MS
  }

  return data.token
}

/**
 * Runs the iLoveIMG compress workflow (auth -> start -> upload -> process ->
 * download). Never throws: on failure it returns the original blob so a
 * capture is never lost to a third-party outage.
 */
async function compressRemotely(
  imageBlob: Blob,
  publicKey: string,
  extension: string
): Promise<NonNullable<CaptureResult["stats"]["remote"]> & { blob: Blob }> {
  try {
    if (!publicKey.trim()) {
      throw new Error("No API key configured")
    }

    const token = await getAuthToken(publicKey.trim())
    const authHeader = { Authorization: `Bearer ${token}` }

    const startResponse = await fetch(
      `${ILOVEIMG_BASE_URL}/v1/start/${ILOVEIMG_TOOL}`,
      { headers: authHeader }
    )

    if (!startResponse.ok) {
      throw new Error(`Could not start task (${startResponse.status})`)
    }

    const { server, task } = await startResponse.json()

    if (!server || !task) {
      throw new Error("Malformed response from iLoveIMG")
    }

    const uploadForm = new FormData()

    uploadForm.append("task", task)
    uploadForm.append("file", imageBlob, `image.${extension}`)

    const uploadResponse = await fetch(`https://${server}/v1/upload`, {
      method: "POST",
      headers: authHeader,
      body: uploadForm
    })

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed (${uploadResponse.status})`)
    }

    const { server_filename: serverFilename } = await uploadResponse.json()

    if (!serverFilename) {
      throw new Error("Upload did not return a filename")
    }

    const processResponse = await fetch(`https://${server}/v1/process`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        task,
        tool: ILOVEIMG_TOOL,
        files: [{ server_filename: serverFilename, filename: serverFilename }]
      })
    })

    if (!processResponse.ok) {
      throw new Error(`Processing failed (${processResponse.status})`)
    }

    const processData = await processResponse.json()

    if (processData.status !== "TaskSuccess") {
      throw new Error(processData.status_message || "Processing failed")
    }

    const downloadResponse = await fetch(
      `https://${server}/v1/download/${task}`,
      {
        headers: authHeader
      }
    )

    if (!downloadResponse.ok) {
      throw new Error(`Download failed (${downloadResponse.status})`)
    }

    const compressedBlob = await downloadResponse.blob()

    // A "compressed" file that grew is not worth keeping.
    if (compressedBlob.size >= imageBlob.size) {
      return {
        blob: imageBlob,
        compressed: false,
        error: "Remote result was not smaller",
        originalBytes: imageBlob.size
      }
    }

    return {
      blob: compressedBlob,
      compressed: true,
      originalBytes: imageBlob.size,
      compressedBytes: compressedBlob.size,
      reduction: `${((1 - compressedBlob.size / imageBlob.size) * 100).toFixed(1)}%`
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    debug("Remote compression failed:", message)

    return {
      blob: imageBlob,
      compressed: false,
      error: message,
      originalBytes: imageBlob.size
    }
  }
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

  const { blob: encodedBlob, quality } = await encode(canvas, settings)

  const extension = extensionFor(settings.format)

  let finalBlob = encodedBlob
  let remote: CaptureResult["stats"]["remote"]

  if (settings.remoteCompression) {
    const outcome = await compressRemotely(
      encodedBlob,
      settings.iLoveImgPublicKey,
      extension
    )

    finalBlob = outcome.blob
    remote = {
      compressed: outcome.compressed,
      error: outcome.error,
      originalBytes: outcome.originalBytes,
      compressedBytes: outcome.compressedBytes,
      reduction: outcome.reduction
    }
  }

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
      format: settings.format,
      remote
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
