import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react"

import { Card } from "@/components/controls"
import {
  IconAlert,
  IconCrop,
  IconKeyboard,
  IconSliders,
  IconType,
  IconZap
} from "@/components/icons"
import { SettingsPanel } from "@/components/SettingsPanel"
import type { ShowOverlayMessage } from "@/lib/messages"
import {
  ASPECT_RATIO_PRESETS,
  buildFilename,
  DEFAULT_SETTINGS,
  extensionFor,
  formatAspectRatioLabel,
  getSettings,
  resetSettings,
  updateSettings,
  type AspectRatioId,
  type Settings
} from "@/lib/settings"

import "@/style.css"

type Tab = "capture" | "settings"

/** URL schemes where content scripts can never run. */
const BLOCKED_PROTOCOLS = [
  "chrome:",
  "chrome-extension:",
  "moz-extension:",
  "edge:",
  "about:",
  "devtools:",
  "view-source:"
]

/** Chrome also blocks content scripts on its own web store. */
const BLOCKED_HOSTS = ["chromewebstore.google.com", "chrome.google.com"]

function isRestrictedUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)

    if (BLOCKED_PROTOCOLS.includes(url.protocol)) {
      return true
    }

    return (
      BLOCKED_HOSTS.includes(url.hostname) &&
      url.pathname.startsWith("/webstore")
    )
  } catch {
    return true
  }
}

/** Derives a sensible default name from the active tab's URL path. */
function nameFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    const segments = url.pathname.split("/").filter(Boolean)

    if (segments.length === 0) {
      return url.hostname.replace(/^www\./, "")
    }

    return decodeURIComponent(segments[segments.length - 1])
  } catch {
    return ""
  }
}

function IndexPopup() {
  const [tab, setTab] = useState<Tab>("capture")
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const [name, setName] = useState("")
  /** True once the user edits the field, so we stop auto-filling over them. */
  const nameTouched = useRef(false)

  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  /* ---------------------------------------------------------- load state */

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [loadedSettings, tabs] = await Promise.all([
        getSettings(),
        chrome.tabs.query({ active: true, currentWindow: true })
      ])

      if (cancelled) return

      const currentTab = tabs[0] ?? null

      setSettings(loadedSettings)
      setSettingsLoaded(true)
      setActiveTab(currentTab)

      if (
        loadedSettings.prefillNameFromUrl &&
        !nameTouched.current &&
        currentTab?.url
      ) {
        setName(nameFromUrl(currentTab.url))
      }
    }

    load().catch((err) => {
      console.error("[Snap Ratio] Failed to load popup state", err)
      setSettingsLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  /* ------------------------------------------------------- settings sync */

  const applyPatch = useCallback((patch: Partial<Settings>) => {
    // Optimistic update keeps the UI responsive; storage catches up after.
    setSettings((prev) => ({ ...prev, ...patch }))

    updateSettings(patch)
      .then((next) => {
        setSettings(next)
        setSavedFlash(true)
      })
      .catch((err) => {
        console.error("[Snap Ratio] Failed to save settings", err)
        setError("Could not save settings. Check your browser storage quota.")
      })
  }, [])

  const handleReset = useCallback(() => {
    resetSettings()
      .then((next) => {
        setSettings(next)
        setSavedFlash(true)
      })
      .catch((err) => console.error("[Snap Ratio] Failed to reset", err))
  }, [])

  // Auto-hide the "Saved" indicator.
  useEffect(() => {
    if (!savedFlash) return

    const timer = setTimeout(() => setSavedFlash(false), 1400)

    return () => clearTimeout(timer)
  }, [savedFlash])

  /* -------------------------------------------------------------- capture */

  const restricted = activeTab?.url ? isRestrictedUrl(activeTab.url) : false
  const needsName = settings.requireName && name.trim().length === 0
  const canCapture = !isCapturing && !restricted && !needsName && settingsLoaded

  const previewFilename = useMemo(() => {
    let domain = ""

    try {
      domain = activeTab?.url ? new URL(activeTab.url).hostname : "example.com"
    } catch {
      domain = "example.com"
    }

    return `${buildFilename(settings.filenameTemplate, {
      name: name.trim(),
      domain,
      title: activeTab?.title ?? "",
      width: settings.outputWidth,
      height: Math.round(settings.outputWidth / (16 / 9)),
      now: new Date()
    })}.${extensionFor(settings.format)}`
  }, [
    settings.filenameTemplate,
    settings.outputWidth,
    settings.format,
    name,
    activeTab
  ])

  const handleCapture = async () => {
    setError(null)
    setIsCapturing(true)

    try {
      const tab =
        activeTab ??
        (await chrome.tabs.query({ active: true, currentWindow: true }))[0]

      if (!tab?.id || !tab.url) {
        throw new Error("No active tab found.")
      }

      if (isRestrictedUrl(tab.url)) {
        throw new Error(
          "Chrome blocks extensions on this page. Open a regular website and try again."
        )
      }

      const message: ShowOverlayMessage = {
        action: "showSelectionOverlay",
        name: name.trim()
      }

      await sendToContentScript(tab.id, message)

      // The overlay is now on the page; the popup has done its job.
      window.close()
    } catch (err) {
      console.error("[Snap Ratio] Error starting capture", err)
      setError(err instanceof Error ? err.message : "Failed to start capture.")
      setIsCapturing(false)
    }
  }

  /* ------------------------------------------------------------ rendering */

  return (
    <div className="flex h-[600px] w-[400px] flex-col bg-brand-50 font-sans">
      <AppHeader tab={tab} onTabChange={setTab} saved={savedFlash} />

      <main className="snap-scroll flex-1 overflow-y-auto overflow-x-hidden">
        {tab === "capture" ? (
          <CaptureTab
            name={name}
            onNameChange={(value) => {
              nameTouched.current = true
              setName(value)
            }}
            settings={settings}
            previewFilename={previewFilename}
            restricted={restricted}
            onChange={applyPatch}
            onOpenSettings={() => setTab("settings")}
          />
        ) : (
          <SettingsPanel
            settings={settings}
            onChange={applyPatch}
            onReset={handleReset}
          />
        )}
      </main>

      {tab === "capture" && (
        <Footer
          error={error}
          canCapture={canCapture}
          isCapturing={isCapturing}
          needsName={needsName}
          onCapture={handleCapture}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------- subviews */

/** Deep indigo brand bar with the wordmark, version and tab switcher. */
function AppHeader({
  tab,
  onTabChange,
  saved
}: {
  tab: Tab
  onTabChange: (next: Tab) => void
  saved: boolean
}) {
  // Reading the version from the manifest keeps it in step with package.json.
  const version = chrome.runtime.getManifest().version

  const tabs: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: "capture", label: "Capture", icon: <IconCrop /> },
    { id: "settings", label: "Settings", icon: <IconSliders /> }
  ]

  return (
    <header className="flex-shrink-0 bg-brand-800 px-4 pb-3 pt-3.5 text-white">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-brand-700">
          <IconCrop className="h-4 w-4" strokeWidth={2.5} />
        </span>

        <h1 className="text-[15px] font-bold leading-none tracking-tight">
          Snap Ratio
        </h1>
        <span className="text-[11px] font-medium leading-none text-white/50">
          v{version}
        </span>

        <span
          aria-live="polite"
          className={`ml-auto rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold leading-none transition-opacity ${
            saved ? "opacity-100" : "opacity-0"
          }`}>
          Saved
        </span>
      </div>

      <nav
        className="mt-3 flex gap-1 rounded-xl bg-black/15 p-1"
        role="tablist">
        {tabs.map((item) => {
          const active = tab === item.id

          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                active
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}>
              <span className="h-3.5 w-3.5">{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}

function CaptureTab({
  name,
  onNameChange,
  settings,
  previewFilename,
  restricted,
  onChange,
  onOpenSettings
}: {
  name: string
  onNameChange: (value: string) => void
  settings: Settings
  previewFilename: string
  restricted: boolean
  onChange: (patch: Partial<Settings>) => void
  onOpenSettings: () => void
}) {
  const afterCaptureLabel = {
    preview: "Show preview",
    download: "Download immediately",
    clipboard: "Copy to clipboard"
  }[settings.afterCapture]

  const sizeLabel =
    settings.resizeMode === "native"
      ? "Native size"
      : `${settings.outputWidth}px wide`

  return (
    <div className="space-y-3 p-3">
      {restricted && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-200">
          <IconAlert className="mt-px h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-[11px] leading-snug text-amber-800">
            Chrome does not allow extensions to run on this page. Switch to a
            regular website to capture.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- name */}
      <Card icon={<IconType />} title="Name" bodyClassName="mt-3">
        <input
          id="capture-name"
          type="text"
          value={name}
          autoFocus
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={settings.requireName ? "Required" : "Optional"}
          className="w-full rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2 text-sm text-gray-800 transition-colors placeholder:text-gray-300 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="mt-2 truncate text-[11px] text-gray-400">
          Saves as{" "}
          <span className="font-mono text-gray-600">{previewFilename}</span>
        </p>
      </Card>

      {/* ------------------------------------------------------ quick ratio */}
      <Card
        icon={<IconZap />}
        title="Quick ratio"
        description="Switch the locked aspect ratio for this capture."
        bodyClassName="mt-3">
        <div className="grid grid-cols-4 gap-1.5">
          {ASPECT_RATIO_PRESETS.map((preset) => {
            const active = settings.aspectRatio === preset.id
            // Only spell out the custom ratio while it is selected; otherwise
            // it reads as a duplicate of whichever preset it happens to match.
            const label =
              preset.id === "custom" && active
                ? `${settings.customRatioWidth}:${settings.customRatioHeight}`
                : preset.label

            return (
              <button
                key={preset.id}
                type="button"
                title={preset.hint}
                aria-pressed={active}
                onClick={() =>
                  onChange({ aspectRatio: preset.id as AspectRatioId })
                }
                className={`rounded-lg py-2 text-[11px] font-semibold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  active
                    ? "bg-brand-700 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {label}
              </button>
            )
          })}
        </div>
      </Card>

      {/* ----------------------------------------------------- preset recap */}
      <Card
        icon={<IconSliders />}
        title="Current preset"
        action={
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex-shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            Edit
          </button>
        }
        bodyClassName="mt-3">
        <dl className="divide-y divide-gray-100">
          <SummaryRow label="Ratio" value={formatAspectRatioLabel(settings)} />
          <SummaryRow label="Output" value={sizeLabel} />
          <SummaryRow
            label="Format"
            value={`${extensionFor(settings.format).toUpperCase()}${
              settings.format === "image/png"
                ? ""
                : ` · ${Math.round(settings.quality * 100)}%`
            }`}
          />
          {settings.maxFileSizeKb > 0 && settings.format !== "image/png" && (
            <SummaryRow
              label="Size cap"
              value={`${settings.maxFileSizeKb} KB`}
            />
          )}
          <SummaryRow label="After capture" value={afterCaptureLabel} />
          {settings.remoteCompression && (
            <SummaryRow label="Compression" value="iLoveIMG (uploads image)" />
          )}
        </dl>
      </Card>

      {/* ------------------------------------------------------------ hints */}
      <div className="flex items-start gap-2.5 rounded-2xl bg-brand-100/70 p-3.5">
        <IconKeyboard className="mt-px h-4 w-4 flex-shrink-0 text-brand-700" />
        <p className="text-[11px] leading-relaxed text-brand-900">
          Drag to position the frame, then <Kbd>Enter</Kbd> to capture or{" "}
          <Kbd>Esc</Kbd> to cancel. Arrow keys nudge; hold <Kbd>Shift</Kbd> for
          10px steps.
        </p>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5 first:pt-0 last:pb-0">
      <dt className="text-[11px] text-gray-400">{label}</dt>
      <dd className="truncate text-[11px] font-semibold text-gray-700">
        {value}
      </dd>
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-brand-300 bg-white px-1 py-px font-sans text-[10px] font-bold text-brand-700">
      {children}
    </kbd>
  )
}

function Footer({
  error,
  canCapture,
  isCapturing,
  needsName,
  onCapture
}: {
  error: string | null
  canCapture: boolean
  isCapturing: boolean
  needsName: boolean
  onCapture: () => void
}) {
  return (
    <footer className="flex-shrink-0 border-t border-gray-900/5 bg-white px-3 py-3">
      {error && (
        <div
          role="alert"
          className="mb-2.5 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 ring-1 ring-red-200">
          <IconAlert className="mt-px h-3.5 w-3.5 flex-shrink-0 text-red-600" />
          <p className="text-[11px] leading-snug text-red-700">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={onCapture}
        disabled={!canCapture}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none">
        <IconCrop className="h-4 w-4" />
        {isCapturing ? "Opening selection..." : "Select area to capture"}
      </button>

      {needsName && (
        <p className="mt-1.5 text-center text-[11px] text-gray-400">
          Enter a name to continue.
        </p>
      )}
    </footer>
  )
}

/* -------------------------------------------------------------- helpers */

/**
 * Sends a message to the tab's content script, retrying once after a short
 * delay. Plasmo injects the script at `document_idle`, so a message fired
 * immediately after a navigation can land before the listener is registered.
 */
async function sendToContentScript(
  tabId: number,
  message: ShowOverlayMessage
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message)

    return
  } catch {
    // Fall through to the retry below.
  }

  await new Promise((resolve) => setTimeout(resolve, 400))

  try {
    await chrome.tabs.sendMessage(tabId, message)
  } catch {
    throw new Error(
      "Snap Ratio is not loaded on this tab yet. Reload the page and try again."
    )
  }
}

export default IndexPopup
