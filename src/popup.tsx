import { useEffect, useState } from "react"

import "~style.css"

/**
 * Main popup component for the thumbnail capture extension
 * Allows users to input a template ID and trigger the capture process
 */
function IndexPopup() {
  const [templateId, setTemplateId] = useState("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Handles the capture thumbnail button click
   * Validates template ID and sends message to content script to show overlay
   */
  const handleCaptureThumbnail = async () => {
    // Validate template ID
    if (!templateId.trim()) {
      setError("Please enter a Template ID")
      return
    }

    setError(null)
    setIsCapturing(true)

    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (!tab.id || !tab.url) {
        throw new Error("No active tab found")
      }

      // Check if we can inject into this tab
      // Some pages like chrome://, chrome-extension://, etc. cannot be injected
      const url = new URL(tab.url)
      if (
        url.protocol === "chrome:" ||
        url.protocol === "chrome-extension:" ||
        url.protocol === "moz-extension:"
      ) {
        throw new Error(
          "Cannot capture screenshots on this page. Please navigate to a regular webpage."
        )
      }

      // Try to send message to content script
      // If it fails, the content script might not be loaded yet
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: "showSelectionOverlay",
          templateId: templateId.trim()
        })
      } catch (messageError) {
        // If message fails, try to inject the content script manually
        // This can happen if the content script hasn't loaded yet
        console.warn(
          "Content script not ready, attempting to inject:",
          messageError
        )

        // Wait a bit and retry
        await new Promise((resolve) => setTimeout(resolve, 500))

        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: "showSelectionOverlay",
            templateId: templateId.trim()
          })
        } catch (retryError) {
          // If still failing, try using scripting API to inject code
          throw new Error(
            "Content script is not available on this page. Please refresh the page and try again."
          )
        }
      }

      // Close popup after triggering capture
      window.close()
    } catch (err) {
      console.error("Error starting capture:", err)
      setError(err instanceof Error ? err.message : "Failed to start capture")
      setIsCapturing(false)
    }
  }

  useEffect(() => {
  // On mount, try to parse templateId from URL and set as default (if found)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const tab = tabs[0]
      try {
        const urlObj = new URL(tab.url || "")
        // The template id is expected to be the pathname, removing leading '/' if present
        const pathname = urlObj.pathname
        const templateIdFromUrl = pathname.startsWith("/")
          ? pathname.slice(1)
          : pathname
        // Only set if templateId is not already set and templateIdFromUrl is non-empty
        if (!templateId && templateIdFromUrl.length > 0) {
          setTemplateId(templateIdFromUrl)
        }
      } catch (e) {
        // Ignore URL parsing errors
      }
    }
  })
  }, [])

  return (
    <div className="w-80 p-6 bg-white">
      <h1 className="text-xl font-bold mb-4 text-gray-800">
        Thumbnail Capture
      </h1>

      <div className="space-y-4">
        {/* Template ID Input */}
        <div>
          <label
            htmlFor="templateId"
            className="block text-sm font-medium text-gray-700 mb-2">
            Template ID
          </label>
          <input
            id="templateId"
            type="text"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            placeholder="Enter template ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isCapturing}
          />
          <p className="mt-1 text-xs text-gray-500">
            This will be used as the output filename
          </p>
        </div>

        {/* Info Note */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Note:</span> The selected area will
            be locked to a 16:9 ratio.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Capture Button */}
        <button
          onClick={handleCaptureThumbnail}
          disabled={isCapturing || !templateId.trim()}
          className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {isCapturing ? "Starting Capture..." : "Capture Thumbnail"}
        </button>
      </div>
    </div>
  )
}

export default IndexPopup
