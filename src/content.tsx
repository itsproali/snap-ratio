import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import { Rnd } from "react-rnd"

export const config: PlasmoCSConfig = {
  matches: [
    "http://localhost/*",
  ]
}

/**
 * Generates a style element with adjusted CSS to work correctly within a Shadow DOM.
 *
 * Tailwind CSS relies on `rem` units, which are based on the root font size (typically defined on the <html>
 * or <body> element). However, in a Shadow DOM (as used by Plasmo), there is no native root element, so the
 * rem values would reference the actual page's root font size—often leading to sizing inconsistencies.
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

/**
 * Selection overlay component for capturing a 16:9 fixed-ratio area
 * Uses react-rnd for reliable drag and resize functionality
 */
const SelectionOverlay = ({
  onCapture,
  onCancel
}: {
  onCapture: (bounds: {
    x: number
    y: number
    width: number
    height: number
  }) => void
  onCancel: () => void
}) => {
  // Calculate default size and position based on viewport
  // Default to 60% of viewport width, maintaining 16:9 ratio
  const getDefaultSize = () => {
    const viewportWidth = window.innerWidth
    const defaultWidth = Math.min(viewportWidth * 0.6, 800) // Max 800px width
    const defaultHeight = defaultWidth / (16 / 9)
    return { width: defaultWidth, height: defaultHeight }
  }

  const getDefaultPosition = (width: number, height: number) => {
    // Center the selection box in the viewport
    return {
      // x: (window.innerWidth - width) / 2,
      // y: (window.innerHeight - height) / 2
      x: 325,
      y: 78
    }
  }

  const defaultSize = getDefaultSize()
  const defaultPosition = getDefaultPosition(
    defaultSize.width,
    defaultSize.height
  )

  const ASPECT_RATIO = 16 / 9
  const minWidth = 240
  const minHeight = minWidth / ASPECT_RATIO

  const [bounds, setBounds] = useState({
    x: defaultPosition.x,
    y: defaultPosition.y,
    width: defaultSize.width,
    height: defaultSize.height
  })

  /**
   * Handles resize while maintaining 16:9 aspect ratio
   */
  const handleResize = (
    _e: MouseEvent | TouchEvent,
    direction: string,
    ref: HTMLElement,
    _delta: { width: number; height: number },
    position: { x: number; y: number }
  ) => {
    const newWidth = parseInt(ref.style.width, 10)
    const newHeight = parseInt(ref.style.height, 10)

    // Calculate which dimension to use as base
    let width = newWidth
    let height = newHeight

    // Determine which edge is being resized
    if (direction.includes("right") || direction.includes("left")) {
      // Width changed, adjust height
      height = width / ASPECT_RATIO
    } else {
      // Height changed, adjust width
      width = height * ASPECT_RATIO
    }

    // Apply constraints
    width = Math.max(minWidth, Math.min(width, window.innerWidth * 0.8))
    height = Math.max(minHeight, Math.min(height, window.innerHeight * 0.8))

    // Adjust position if resizing from left or top
    let newX = position.x
    let newY = position.y

    if (direction.includes("left")) {
      newX = bounds.x + bounds.width - width
    }
    if (direction.includes("top")) {
      newY = bounds.y + bounds.height - height
    }

    // Keep within viewport
    newX = Math.max(0, Math.min(newX, window.innerWidth - width))
    newY = Math.max(0, Math.min(newY, window.innerHeight - height))

    setBounds({ x: newX, y: newY, width, height })
  }

  return (
    <div className="fixed inset-0 z-[999999] bg-black bg-opacity-50">
      {/* Selection Box using react-rnd */}
      <Rnd
        size={{ width: bounds.width, height: bounds.height }}
        position={{ x: bounds.x, y: bounds.y }}
        onDrag={(_e, d) => {
          setBounds({
            ...bounds,
            x: Math.max(0, Math.min(d.x, window.innerWidth - bounds.width)),
            y: Math.max(0, Math.min(d.y, window.innerHeight - bounds.height))
          })
        }}
        onDragStop={(_e, d) => {
          setBounds({
            ...bounds,
            x: Math.max(0, Math.min(d.x, window.innerWidth - bounds.width)),
            y: Math.max(0, Math.min(d.y, window.innerHeight - bounds.height))
          })
        }}
        onResize={handleResize}
        onResizeStop={(_e, _direction, ref, _delta, position) => {
          const width = parseInt(ref.style.width, 10)
          const height = parseInt(ref.style.height, 10)
          setBounds({
            x: position.x,
            y: position.y,
            width,
            height
          })
        }}
        minWidth={minWidth}
        minHeight={minHeight}
        maxWidth={window.innerWidth * 0.8}
        maxHeight={window.innerHeight * 0.8}
        lockAspectRatio={ASPECT_RATIO}
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
          border: "2px solid rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          boxShadow:
            "0 0 0 1px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)"
        }}
        resizeHandleStyles={{
          top: {
            top: "-4px",
            height: "8px",
            width: "8px",
            backgroundColor: "rgb(59, 130, 246)",
            border: "1px solid white",
            borderRadius: "50%"
          },
          right: {
            right: "-4px",
            width: "8px",
            height: "8px",
            backgroundColor: "rgb(59, 130, 246)",
            border: "1px solid white",
            borderRadius: "50%"
          },
          bottom: {
            bottom: "-4px",
            height: "8px",
            width: "8px",
            backgroundColor: "rgb(59, 130, 246)",
            border: "1px solid white",
            borderRadius: "50%"
          },
          left: {
            left: "-4px",
            width: "8px",
            height: "8px",
            backgroundColor: "rgb(59, 130, 246)",
            border: "1px solid white",
            borderRadius: "50%"
          },
          topLeft: {
            top: "-6px",
            left: "-6px",
            width: "12px",
            height: "12px",
            backgroundColor: "rgb(59, 130, 246)",
            border: "1px solid white",
            borderRadius: "50%"
          },
          topRight: {
            top: "-6px",
            right: "-6px",
            width: "12px",
            height: "12px",
            backgroundColor: "rgb(59, 130, 246)",
            border: "1px solid white",
            borderRadius: "50%"
          },
          bottomLeft: {
            bottom: "-6px",
            left: "-6px",
            width: "12px",
            height: "12px",
            backgroundColor: "rgb(59, 130, 246)",
            border: "1px solid white",
            borderRadius: "50%"
          },
          bottomRight: {
            bottom: "-6px",
            right: "-6px",
            width: "12px",
            height: "12px",
            backgroundColor: "rgb(59, 130, 246)",
            border: "1px solid white",
            borderRadius: "50%"
          }
        }}>
        {/* Center indicator */}
        <div className="w-full h-full flex items-center justify-center cursor-move">
          <div className="text-xs font-semibold text-blue-500 bg-white px-2 py-1 rounded shadow pointer-events-none">
            16:9
          </div>
        </div>
      </Rnd>

      {/* Control Buttons */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3 z-[1000000]">
        <button
          onClick={() => onCapture(bounds)}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg">
          Capture Frame
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 shadow-lg">
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * Global state for overlay visibility and template ID
 * This allows the message listener to work even before React mounts
 */
let overlayState = {
  show: false,
  templateId: null as string | null,
  listeners: [] as Array<() => void>
}

/**
 * Set up message listener at module level (before React mounts)
 * This ensures the listener is always ready to receive messages
 */
chrome.runtime.onMessage.addListener(
  (
    message: { action: string; templateId?: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    if (message.action === "showSelectionOverlay") {
      overlayState.templateId = message.templateId || null
      overlayState.show = true
      // Notify all listeners (React components) that state changed
      overlayState.listeners.forEach((listener) => listener())
      sendResponse({ success: true })
      return true // Keep channel open for async response
    }
    return false
  }
)

/**
 * Main content script component
 * Listens for messages from popup to show/hide selection overlay
 */
/**
 * Download UI component shown after image processing
 */
const DownloadUI = ({
  imageDataUrl,
  filename,
  compression,
  onClose
}: {
  imageDataUrl: string
  filename: string
  compression?: {
    compressed: boolean
    error?: string
    details?: any
  }
  onClose: () => void
}) => {
  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = imageDataUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[999999] bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Image Ready</h2>
        <p className="text-sm text-gray-600 mb-4">
          Your thumbnail has been processed and is ready to download.
        </p>

        {/* Compression Status */}
        {compression && (
          <div
            className={`mb-4 p-3 rounded-md text-sm ${compression.compressed
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-yellow-50 border border-yellow-200 text-yellow-800"
              }`}>
            {compression.compressed ? (
              <div>
                <span className="font-semibold">✓ Compressed successfully</span>
                {compression.details?.reduction && (
                  <span className="ml-2">
                    ({compression.details.reduction} smaller)
                  </span>
                )}
              </div>
            ) : (
              <div>
                <span className="font-semibold">⚠ Compression failed</span>
                {compression.error && (
                  <div className="mt-1 text-xs opacity-75">
                    {compression.error}
                  </div>
                )}
                <div className="mt-1 text-xs opacity-75">
                  Using uncompressed image. Check console for details.
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg">
            Download Image
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Loading UI component shown during processing
 */
const LoadingUI = () => {
  return (
    <div className="fixed inset-0 z-[999999] bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <h2 className="text-xl font-bold mb-2 text-gray-800">
            Processing Image
          </h2>
          <p className="text-sm text-gray-600 text-center">
            Cropping, resizing, and compressing your thumbnail...
          </p>
        </div>
      </div>
    </div>
  )
}

const PlasmoOverlay = () => {
  const [showOverlay, setShowOverlay] = useState(overlayState.show)
  const [templateId, setTemplateId] = useState<string | null>(
    overlayState.templateId
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadData, setDownloadData] = useState<{
    imageDataUrl: string
    filename: string
    compression?: {
      compressed: boolean
      error?: string
      details?: any
    }
  } | null>(null)

  /**
   * Sync with global state when it changes
   */
  useEffect(() => {
    const updateState = () => {
      setShowOverlay(overlayState.show)
      setTemplateId(overlayState.templateId)
    }

    // Add this component's update function to listeners
    overlayState.listeners.push(updateState)

    // Initial sync
    updateState()

    return () => {
      // Remove listener on unmount
      overlayState.listeners = overlayState.listeners.filter(
        (l) => l !== updateState
      )
    }
  }, [])

  /**
   * Handles capture frame button click
   * Sends screenshot request to background script
   */
  const handleCapture = async (bounds: {
    x: number
    y: number
    width: number
    height: number
  }) => {
    try {
      // Hide overlay first
      overlayState.show = false
      overlayState.listeners.forEach((listener) => listener())

      // Wait for overlay to be removed from DOM before capturing
      // Use requestAnimationFrame to ensure DOM update completes
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve(undefined)
          })
        })
      })

      setIsProcessing(true)

      // Send capture request to background script
      // The background script will get the active tab ID
      const response = await chrome.runtime.sendMessage({
        action: "captureScreenshot",
        bounds,
        templateId
      })

      if (response.error) {
        throw new Error(response.error)
      }

      // Show download UI with the processed image
      setIsProcessing(false)
      setDownloadData({
        imageDataUrl: response.imageDataUrl,
        filename: response.filename,
        compression: response.compression
      })
    } catch (error) {
      console.error("Error capturing screenshot:", error)
      setIsProcessing(false)
      alert(
        `Failed to capture screenshot: ${error instanceof Error ? error.message : "Unknown error"
        }`
      )
      overlayState.show = true // Show overlay again on error
      overlayState.listeners.forEach((listener) => listener())
    }
  }

  /**
   * Handles cancel button click
   */
  const handleCancel = () => {
    overlayState.show = false
    overlayState.templateId = null
    overlayState.listeners.forEach((listener) => listener())
    setIsProcessing(false)
    setDownloadData(null)
  }

  /**
   * Handles closing the download UI
   */
  const handleCloseDownload = () => {
    setDownloadData(null)
    overlayState.show = false
    overlayState.templateId = null
    overlayState.listeners.forEach((listener) => listener())
  }

  // Show download UI if image is ready
  if (downloadData) {
    return (
      <DownloadUI
        imageDataUrl={downloadData.imageDataUrl}
        filename={downloadData.filename}
        compression={downloadData.compression}
        onClose={handleCloseDownload}
      />
    )
  }

  // Show loading UI if processing
  if (isProcessing) {
    return <LoadingUI />
  }

  // Show selection overlay
  if (!showOverlay) {
    return null
  }

  return <SelectionOverlay onCapture={handleCapture} onCancel={handleCancel} />
}

export default PlasmoOverlay
