/**
 * Background service worker entry point
 * Handles messages from content scripts and popup
 */

import { iLoveIMGConfig } from "~config/api"
import { imageConfig } from "~config/image"

// Log configuration status on startup
console.log("[iLoveIMG] Configuration Status:", {
  hasPublicKey: !!iLoveIMGConfig.publicKey,
  hasSecretKey: !!iLoveIMGConfig.secretKey,
  tool: iLoveIMGConfig.tool,
  baseUrl: iLoveIMGConfig.baseUrl
})

if (!iLoveIMGConfig.publicKey) {
  console.warn(
    "[iLoveIMG] ⚠ Public Key not configured. Compression will fail.\n" +
      "To fix this:\n" +
      "1. Create a .env file in the project root\n" +
      "2. Add: PLASMO_PUBLIC_ILOVEIMG_PUBLIC_KEY=your_public_key_here\n" +
      "3. Get your keys from: https://developer.ilovepdf.com/\n" +
      "4. Restart the development server"
  )
}

/**
 * Processes image using OffscreenCanvas (available in service workers)
 * Crops, resizes, and converts to blob
 */
async function processImage(
  imageData: string,
  cropBounds: { x: number; y: number; width: number; height: number },
  targetWidth: number,
  targetHeight: number,
  tabInfo?: chrome.tabs.Tab
): Promise<Blob> {
  // Load the image as ImageBitmap
  const response = await fetch(imageData)
  const blob = await response.blob()
  const imageBitmap = await createImageBitmap(blob)

  // Get the actual screenshot dimensions
  const screenshotWidth = imageBitmap.width
  const screenshotHeight = imageBitmap.height

  // Get viewport dimensions from the tab
  let viewportWidth = screenshotWidth
  let viewportHeight = screenshotHeight

  // Try to get actual viewport size from tab
  if (tabInfo) {
    try {
      // Inject a script to get viewport dimensions
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabInfo.id },
        func: () => ({
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1
        })
      })

      if (results && results[0]?.result) {
        const { width, height } = results[0].result
        viewportWidth = width
        viewportHeight = height
      }
    } catch (error) {
      console.warn("Could not get viewport dimensions, using defaults", error)
    }
  }

  // Calculate scale factors
  const scaleX = screenshotWidth / viewportWidth
  const scaleY = screenshotHeight / viewportHeight

  // Scale the crop bounds to match screenshot coordinates
  const scaledX = Math.round(cropBounds.x * scaleX)
  const scaledY = Math.round(cropBounds.y * scaleY)
  const scaledWidth = Math.round(cropBounds.width * scaleX)
  const scaledHeight = Math.round(cropBounds.height * scaleY)

  // Ensure bounds are within image
  const finalX = Math.max(0, Math.min(scaledX, screenshotWidth - 1))
  const finalY = Math.max(0, Math.min(scaledY, screenshotHeight - 1))
  const finalWidth = Math.min(scaledWidth, screenshotWidth - finalX)
  const finalHeight = Math.min(scaledHeight, screenshotHeight - finalY)

  // Create a temporary canvas for cropping
  const cropCanvas = new OffscreenCanvas(finalWidth, finalHeight)
  const cropCtx = cropCanvas.getContext("2d")

  if (!cropCtx) {
    throw new Error("Failed to get crop canvas context")
  }

  // Crop the image
  cropCtx.drawImage(
    imageBitmap,
    finalX,
    finalY,
    finalWidth,
    finalHeight,
    0,
    0,
    finalWidth,
    finalHeight
  )

  // Create target canvas for resizing
  const targetCanvas = new OffscreenCanvas(targetWidth, targetHeight)
  const targetCtx = targetCanvas.getContext("2d")

  if (!targetCtx) {
    throw new Error("Failed to get target canvas context")
  }

  // Resize to target dimensions with high quality
  targetCtx.imageSmoothingEnabled = true
  targetCtx.imageSmoothingQuality = "high"
  targetCtx.drawImage(cropCanvas, 0, 0, targetWidth, targetHeight)

  // Convert to blob using configured format and quality
  return await targetCanvas.convertToBlob({
    type: imageConfig.format,
    quality: imageConfig.quality
  })
}

/**
 * Cached authentication token with expiration
 */
let cachedToken: {
  token: string
  expiresAt: number
} | null = null

/**
 * Token validity period: 2 hours in milliseconds
 */
const TOKEN_VALIDITY_MS = 2 * 60 * 60 * 1000 // 2 hours

/**
 * Gets authentication token from iLoveIMG API
 * Caches the token for 2 hours to avoid unnecessary API calls
 */
async function getAuthToken(): Promise<string> {
  if (!iLoveIMGConfig.publicKey) {
    const errorMessage =
      "iLoveIMG Public Key not configured. " +
      "Please create a .env file in the project root and add: " +
      "PLASMO_PUBLIC_ILOVEIMG_PUBLIC_KEY=your_public_key_here"
    console.error("[iLoveIMG] Configuration Error:", errorMessage)
    console.error(
      "[iLoveIMG] Get your API keys from: https://developer.ilovepdf.com/"
    )
    throw new Error(errorMessage)
  }

  // Check if we have a valid cached token
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now) {
    console.log("[iLoveIMG] Using cached authentication token")
    return cachedToken.token
  }

  // Token expired or doesn't exist, request a new one
  console.log("[iLoveIMG] Requesting new authentication token...")
  const response = await fetch(iLoveIMGConfig.authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      public_key: iLoveIMGConfig.publicKey
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("[iLoveIMG] ✗ Authentication failed:", {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    })
    throw new Error(
      `Authentication failed: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()
  const token = data.token

  if (!token) {
    throw new Error("No token received from authentication endpoint")
  }

  // Cache the token with expiration time (2 hours from now)
  cachedToken = {
    token,
    expiresAt: now + TOKEN_VALIDITY_MS
  }

  const expiresInMinutes = Math.floor(TOKEN_VALIDITY_MS / (60 * 1000))
  console.log(`[iLoveIMG] ✓ Token cached for ${expiresInMinutes} minutes`)

  return token
}

/**
 * Compresses image using iLoveIMG API (4-step workflow)
 * Based on: https://www.iloveapi.com/docs/api-reference#request-workflow
 * Returns both the blob and compression status/error info
 */
async function compressImage(imageBlob: Blob): Promise<{
  blob: Blob
  compressed: boolean
  error?: string
  details?: any
}> {
  try {
    console.log("[iLoveIMG] Starting compression workflow...")

    // Step 1: Get authentication token
    console.log("[iLoveIMG] Step 1: Getting authentication token...")
    const token = await getAuthToken()
    console.log("[iLoveIMG] ✓ Authentication successful")

    // Step 2: Start task - Get server and task ID
    console.log("[iLoveIMG] Step 2: Starting task...")
    const startUrl = `${iLoveIMGConfig.baseUrl}/v1/start/${iLoveIMGConfig.tool}`
    console.log("[iLoveIMG] Start URL:", startUrl)

    const startResponse = await fetch(startUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!startResponse.ok) {
      const errorText = await startResponse.text()
      let errorJson = null
      try {
        errorJson = JSON.parse(errorText)
      } catch (e) {
        // If parsing fails, use the text as-is
      }

      const errorDetails = {
        status: startResponse.status,
        statusText: startResponse.statusText,
        url: startUrl,
        body: errorJson || errorText,
        headers: Object.fromEntries(startResponse.headers.entries())
      }

      console.error("[iLoveIMG] ✗ Start task failed:")
      console.error(JSON.stringify(errorDetails, null, 2))

      // Extract error message from response
      const errorMessage =
        errorJson?.error?.message ||
        errorJson?.message ||
        errorText ||
        startResponse.statusText
      const errorParam = errorJson?.error?.param
        ? JSON.stringify(errorJson.error.param, null, 2)
        : ""

      throw new Error(
        `Start task failed (${startResponse.status}): ${errorMessage}${
          errorParam ? `\nDetails: ${errorParam}` : ""
        }`
      )
    }

    const startData = await startResponse.json()
    const { server, task } = startData
    console.log("[iLoveIMG] ✓ Task started:", { server, task })

    if (!server || !task) {
      console.error(
        "[iLoveIMG] ✗ Invalid response from start endpoint:",
        startData
      )
      throw new Error("Invalid response from start endpoint")
    }

    // Step 3: Upload file
    console.log("[iLoveIMG] Step 3: Uploading file...")
    const uploadUrl = `https://${server}/v1/upload`
    const uploadFormData = new FormData()
    uploadFormData.append("task", task)
    uploadFormData.append("file", imageBlob, "image.jpg")

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: uploadFormData
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error("[iLoveIMG] ✗ Upload failed:", {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        body: errorText
      })
      throw new Error(
        `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`
      )
    }

    const uploadData = await uploadResponse.json()
    const serverFilename = uploadData.server_filename
    console.log("[iLoveIMG] ✓ File uploaded:", { serverFilename })

    if (!serverFilename) {
      console.error(
        "[iLoveIMG] ✗ Invalid response from upload endpoint:",
        uploadData
      )
      throw new Error("Invalid response from upload endpoint")
    }

    // Step 4: Process file
    console.log("[iLoveIMG] Step 4: Processing file...")
    const processUrl = `https://${server}/v1/process`
    const processResponse = await fetch(processUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        task: task,
        tool: iLoveIMGConfig.tool,
        files: [
          {
            server_filename: serverFilename,
            filename: serverFilename
          }
        ]
      })
    })

    if (!processResponse.ok) {
      const errorText = await processResponse.text()
      console.error("[iLoveIMG] ✗ Process failed:", {
        status: processResponse.status,
        statusText: processResponse.statusText,
        body: errorText
      })
      throw new Error(
        `Process failed: ${processResponse.status} ${processResponse.statusText}`
      )
    }

    const processData = await processResponse.json()
    console.log("[iLoveIMG] Process response:", processData)

    if (processData.status !== "TaskSuccess") {
      console.error("[iLoveIMG] ✗ Processing failed:", {
        status: processData.status,
        message: processData.status_message,
        fullResponse: processData
      })
      throw new Error(
        `Processing failed: ${processData.status_message || "Unknown error"}`
      )
    }

    // Step 5: Download processed file
    console.log("[iLoveIMG] Step 5: Downloading compressed file...")
    const downloadUrl = `https://${server}/v1/download/${task}`
    const downloadResponse = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text()
      console.error("[iLoveIMG] ✗ Download failed:", {
        status: downloadResponse.status,
        statusText: downloadResponse.statusText,
        body: errorText
      })
      throw new Error(
        `Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`
      )
    }

    const compressedBlob = await downloadResponse.blob()
    console.log("[iLoveIMG] ✓ Compression successful!", {
      originalSize: imageBlob.size,
      compressedSize: compressedBlob.size,
      reduction: `${((1 - compressedBlob.size / imageBlob.size) * 100).toFixed(1)}%`
    })

    return {
      blob: compressedBlob,
      compressed: true,
      details: {
        originalSize: imageBlob.size,
        compressedSize: compressedBlob.size,
        reduction:
          ((1 - compressedBlob.size / imageBlob.size) * 100).toFixed(1) + "%"
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    const errorDetails = error instanceof Error ? error.stack : String(error)

    console.error("[iLoveIMG] ✗ Compression failed:")
    console.error("Error message:", errorMessage)
    console.error("Error details:", errorDetails)
    console.error(
      "Configuration:",
      JSON.stringify(
        {
          hasPublicKey: !!iLoveIMGConfig.publicKey,
          tool: iLoveIMGConfig.tool,
          baseUrl: iLoveIMGConfig.baseUrl
        },
        null,
        2
      )
    )

    // Fallback: return original image if compression fails
    console.warn("[iLoveIMG] Falling back to original image (no compression)")
    return {
      blob: imageBlob,
      compressed: false,
      error: errorMessage,
      details: { fallback: true }
    }
  }
}

/**
 * Listens for direct messages and processes screenshot capture
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "captureScreenshot") {
    // Get tab ID from sender (content script's tab)
    const tabId = sender.tab?.id
    if (!tabId) {
      sendResponse({ error: "No tab ID found" })
      return false
    }

    // Process the screenshot capture asynchronously
    handleScreenshotCapture({
      tabId,
      bounds: message.bounds,
      templateId: message.templateId
    })
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ error: error.message }))
    return true // Keep channel open for async response
  }
  return false
})

/**
 * Handles the screenshot capture process
 */
async function handleScreenshotCapture(message: {
  tabId: number
  bounds: { x: number; y: number; width: number; height: number }
  templateId: string | null
}) {
  try {
    // Step 1: Capture screenshot of the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
      format: "png"
    })

    if (!dataUrl) {
      throw new Error("Failed to capture screenshot")
    }

    // Step 2 & 3: Crop and resize to configured dimensions (16:9 ratio)
    // Get tab info to calculate proper scaling
    const tab = await chrome.tabs.get(message.tabId)
    const resizedBlob = await processImage(
      dataUrl,
      message.bounds,
      imageConfig.width,
      imageConfig.height,
      tab
    )

    // Step 4: Compress using iLoveIMG API
    const compressionResult = await compressImage(resizedBlob)
    const finalBlob = compressionResult.blob

    // Log compression result
    if (!compressionResult.compressed) {
      console.warn(
        "[Screenshot] Compression failed, using uncompressed image:",
        compressionResult.error
      )
    } else {
      console.log(
        "[Screenshot] Compression successful:",
        compressionResult.details
      )
    }

    // Step 5: Convert blob to data URL for download
    // Convert blob to base64 data URL
    const filename = message.templateId
      ? `${message.templateId}.${imageConfig.extension}`
      : `thumbnail-${Date.now()}.${imageConfig.extension}`

    // Convert blob to base64 data URL
    // Use a more robust method that handles large files
    const arrayBuffer = await finalBlob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    let binaryString = ""
    const chunkSize = 8192 // Process in chunks to avoid stack overflow

    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize)
      binaryString += String.fromCharCode(...chunk)
    }

    const base64 = btoa(binaryString)
    const imageDataUrl = `data:${imageConfig.format};base64,${base64}`

    // Return image data URL instead of auto-downloading
    return { success: true, filename, imageDataUrl }
  } catch (error) {
    console.error("Screenshot processing error:", error)
    throw error
  }
}
