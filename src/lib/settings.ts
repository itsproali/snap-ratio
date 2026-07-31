/**
 * Central definition of every user-configurable setting.
 *
 * Everything the user could previously only tweak by editing source (aspect
 * ratio, output size, quality, format, default overlay position/size) now
 * lives here, is persisted in `chrome.storage.sync`, and is read by both the
 * popup and the content script overlay.
 */

import { Storage } from "@plasmohq/storage"

/** Key under which the whole settings object is stored. */
export const SETTINGS_KEY = "snap-ratio:settings"

/** Key under which the last-used selection rect is remembered. */
export const LAST_BOUNDS_KEY = "snap-ratio:last-bounds"

export type AspectRatioId =
  "16:9" | "4:3" | "3:2" | "1:1" | "9:16" | "21:9" | "custom" | "free"

export type AnchorId =
  | "center"
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "custom"
  | "remember"

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp"

export type ResizeMode = "preset" | "native"

export type AfterCaptureAction = "preview" | "download" | "clipboard"

export interface Settings {
  /* ---------------------------------------------------------------- area */

  /** Locked aspect ratio for the selection box. */
  aspectRatio: AspectRatioId
  /** Numerator/denominator used when `aspectRatio` is "custom". */
  customRatioWidth: number
  customRatioHeight: number

  /** Default selection width, as a percentage of the viewport width (10-100). */
  defaultWidthPercent: number
  /** Upper bound in CSS px for the default selection width. */
  maxDefaultWidth: number

  /** Where the selection box starts. */
  defaultAnchor: AnchorId
  /** Start coordinates used when `defaultAnchor` is "custom". */
  customX: number
  customY: number

  /* -------------------------------------------------------------- output */

  /**
   * How the cropped region is scaled before encoding.
   * - "preset": scale to `outputWidth` (height follows the aspect ratio)
   * - "native": keep the captured pixel size, no rescale
   */
  resizeMode: ResizeMode
  /** Target width in px when `resizeMode` is "preset". */
  outputWidth: number

  /** Encoder used for the final image. */
  format: OutputFormat
  /** Encoder quality 0.1-1.0. Ignored for PNG (lossless). */
  quality: number

  /**
   * Optional cap on the final file size in KB. When set, the encoder retries
   * at progressively lower quality until it fits. 0 disables the cap.
   */
  maxFileSizeKb: number

  /* ------------------------------------------------------------ behaviour */

  /** What happens once the image has been produced. */
  afterCapture: AfterCaptureAction

  /** Filename template. Supports the tokens listed in `FILENAME_TOKENS`. */
  filenameTemplate: string

  /** Prefill the name field from the active tab's URL path. */
  prefillNameFromUrl: boolean
  /** Require a non-empty name before the capture button is enabled. */
  requireName: boolean

  /* -------------------------------------------------------------- overlay */

  /** Dim level of the backdrop behind the selection, 0-90 (%). */
  backdropOpacity: number
  /** Show the live pixel dimensions inside the selection box. */
  showDimensions: boolean
  /** Show the rule-of-thirds grid inside the selection box. */
  showGrid: boolean
  /** Accent colour of the selection border/handles. */
  accentColor: string

  /* ------------------------------------------------- optional compression */

  /** Send the image to the iLoveIMG API for extra compression. Off by default. */
  remoteCompression: boolean
  /** User-supplied iLoveIMG public key. Required when `remoteCompression` is on. */
  iLoveImgPublicKey: string
}

/** Tokens understood by `filenameTemplate`. */
export const FILENAME_TOKENS = [
  { token: "{name}", description: "The name typed in the popup" },
  { token: "{domain}", description: "Hostname of the captured page" },
  { token: "{title}", description: "Title of the captured page" },
  { token: "{date}", description: "Capture date, YYYY-MM-DD" },
  { token: "{time}", description: "Capture time, HH-MM-SS" },
  { token: "{timestamp}", description: "Unix epoch in milliseconds" },
  { token: "{width}", description: "Output width in px" },
  { token: "{height}", description: "Output height in px" }
] as const

export const DEFAULT_SETTINGS: Settings = {
  aspectRatio: "16:9",
  customRatioWidth: 16,
  customRatioHeight: 9,

  defaultWidthPercent: 60,
  maxDefaultWidth: 800,

  defaultAnchor: "center",
  customX: 325,
  customY: 78,

  resizeMode: "preset",
  outputWidth: 1280,

  format: "image/jpeg",
  quality: 0.85,
  maxFileSizeKb: 0,

  afterCapture: "preview",
  filenameTemplate: "{name}",
  prefillNameFromUrl: true,
  requireName: false,

  backdropOpacity: 50,
  showDimensions: true,
  showGrid: false,
  // The extension's own violet, so the overlay matches the popup.
  accentColor: "#6d28d9",

  remoteCompression: false,
  iLoveImgPublicKey: ""
}

/** Selectable aspect ratios, in the order shown in the popup. */
export const ASPECT_RATIO_PRESETS: Array<{
  id: AspectRatioId
  label: string
  hint: string
  value: number | null
}> = [
  { id: "16:9", label: "16:9", hint: "YouTube / widescreen", value: 16 / 9 },
  { id: "4:3", label: "4:3", hint: "Classic", value: 4 / 3 },
  { id: "3:2", label: "3:2", hint: "Photography", value: 3 / 2 },
  { id: "1:1", label: "1:1", hint: "Square / social", value: 1 },
  { id: "9:16", label: "9:16", hint: "Stories / Shorts", value: 9 / 16 },
  { id: "21:9", label: "21:9", hint: "Ultrawide", value: 21 / 9 },
  { id: "custom", label: "Custom", hint: "Your own ratio", value: null },
  { id: "free", label: "Free", hint: "No ratio lock", value: null }
]

/** Common output widths offered as one-tap presets. */
export const OUTPUT_WIDTH_PRESETS = [640, 854, 1280, 1600, 1920, 2560]

/**
 * Resolves the numeric aspect ratio (width / height) for the given settings.
 * Returns `null` when the selection should be freely resizable.
 */
export function resolveAspectRatio(settings: Settings): number | null {
  if (settings.aspectRatio === "free") {
    return null
  }

  if (settings.aspectRatio === "custom") {
    const w = Number(settings.customRatioWidth)
    const h = Number(settings.customRatioHeight)

    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      return 16 / 9
    }

    return w / h
  }

  const preset = ASPECT_RATIO_PRESETS.find((p) => p.id === settings.aspectRatio)

  return preset?.value ?? 16 / 9
}

/** Human-readable label for the active ratio, e.g. "16:9". */
export function formatAspectRatioLabel(settings: Settings): string {
  if (settings.aspectRatio === "custom") {
    return `${settings.customRatioWidth}:${settings.customRatioHeight}`
  }

  if (settings.aspectRatio === "free") {
    return "Free"
  }

  return settings.aspectRatio
}

/** File extension matching the configured encoder. */
export function extensionFor(format: OutputFormat): string {
  if (format === "image/png") return "png"
  if (format === "image/webp") return "webp"

  return "jpg"
}

/** True for characters that are unsafe or unreadable inside a filename. */
function isUnsafeFilenameChar(char: string): boolean {
  // Control characters (below 0x20) plus the set reserved by Windows/POSIX.
  return char.charCodeAt(0) < 32 || `<>:"/\\|?*`.includes(char)
}

/**
 * Strips characters that are illegal in filenames on Windows/macOS/Linux and
 * collapses the leftovers, so a template can safely interpolate page titles.
 * Returns an empty string when nothing usable survives.
 */
export function sanitizeFilename(value: string): string {
  const replaced = Array.from(value)
    .map((char) => (isUnsafeFilenameChar(char) ? "-" : char))
    .join("")

  return replaced
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120)
}

/**
 * Expands a filename template into a real filename (without extension).
 * Falls back to a timestamped name when the template resolves to nothing
 * usable, so we never emit a dotfile or an empty name.
 */
export function buildFilename(
  template: string,
  context: {
    name: string
    domain: string
    title: string
    width: number
    height: number
    now: Date
  }
): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const { now } = context

  const replacements: Record<string, string> = {
    "{name}": context.name,
    "{domain}": context.domain,
    "{title}": context.title,
    "{date}": `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    "{time}": `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`,
    "{timestamp}": String(now.getTime()),
    "{width}": String(context.width),
    "{height}": String(context.height)
  }

  const expanded = template.replace(
    /\{(name|domain|title|date|time|timestamp|width|height)\}/g,
    (match) => replacements[match] ?? match
  )

  const sanitized = sanitizeFilename(expanded)

  return sanitized.length > 0 ? sanitized : `snap-${now.getTime()}`
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min

  return Math.min(max, Math.max(min, value))
}

/**
 * Merges stored settings over the defaults so that settings added in a later
 * version are always present, even for users upgrading from an older build.
 */
export function withDefaults(
  stored: Partial<Settings> | null | undefined
): Settings {
  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_SETTINGS }
  }

  const merged = { ...DEFAULT_SETTINGS, ...stored }

  // Clamp anything a hand-edited storage value could put out of range.
  merged.defaultWidthPercent = clamp(merged.defaultWidthPercent, 10, 100)
  merged.maxDefaultWidth = clamp(merged.maxDefaultWidth, 120, 4096)
  merged.outputWidth = clamp(merged.outputWidth, 64, 7680)
  merged.quality = clamp(merged.quality, 0.1, 1)
  merged.backdropOpacity = clamp(merged.backdropOpacity, 0, 90)
  merged.maxFileSizeKb = clamp(merged.maxFileSizeKb, 0, 20480)
  merged.customRatioWidth = clamp(merged.customRatioWidth, 1, 100)
  merged.customRatioHeight = clamp(merged.customRatioHeight, 1, 100)

  return merged
}

/**
 * Shared storage instance. `sync` keeps settings with the user's Chrome
 * profile so they follow the user across devices; Chrome stores them locally
 * and syncs later when the user is signed out.
 */
export const settingsStorage = new Storage({ area: "sync" })

/** Reads the persisted settings, merged over the defaults. */
export async function getSettings(): Promise<Settings> {
  try {
    const stored = await settingsStorage.get<Partial<Settings>>(SETTINGS_KEY)

    return withDefaults(stored)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Persists a partial update, leaving untouched keys as they were. */
export async function updateSettings(
  patch: Partial<Settings>
): Promise<Settings> {
  const current = await getSettings()
  const next = withDefaults({ ...current, ...patch })

  await settingsStorage.set(SETTINGS_KEY, next)

  return next
}

/** Restores every setting to its shipped default. */
export async function resetSettings(): Promise<Settings> {
  await settingsStorage.set(SETTINGS_KEY, DEFAULT_SETTINGS)

  return { ...DEFAULT_SETTINGS }
}

export interface SelectionBounds {
  x: number
  y: number
  width: number
  height: number
}

/** Reads the remembered selection rect, if the user opted into "remember". */
export async function getLastBounds(): Promise<SelectionBounds | null> {
  try {
    const stored = await settingsStorage.get<SelectionBounds>(LAST_BOUNDS_KEY)

    if (
      stored &&
      Number.isFinite(stored.width) &&
      Number.isFinite(stored.height) &&
      stored.width > 0 &&
      stored.height > 0
    ) {
      return stored
    }

    return null
  } catch {
    return null
  }
}

/** Stores the selection rect so the next capture can reuse it. */
export async function setLastBounds(bounds: SelectionBounds): Promise<void> {
  try {
    await settingsStorage.set(LAST_BOUNDS_KEY, bounds)
  } catch {
    // Storage quota / unavailable - remembering bounds is best-effort.
  }
}
