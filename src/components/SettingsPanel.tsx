/**
 * The full settings surface rendered inside the popup.
 *
 * Every change is written straight to `chrome.storage.sync` by the parent, so
 * there is no explicit save step - the next capture always uses the latest
 * values.
 */

import {
  ASPECT_RATIO_PRESETS,
  buildFilename,
  extensionFor,
  FILENAME_TOKENS,
  OUTPUT_WIDTH_PRESETS,
  type AnchorId,
  type AspectRatioId,
  type OutputFormat,
  type Settings
} from "@/lib/settings"

import {
  Field,
  NumberInput,
  Section,
  SegmentedControl,
  Slider,
  TextInput,
  Toggle
} from "./controls"
import {
  IconCloudUp,
  IconCrop,
  IconImage,
  IconPalette,
  IconRotateCcw,
  IconSliders
} from "./icons"

/** 3x3 anchor grid in reading order; `null` cells are inert spacers. */
const ANCHOR_CELLS: Array<{ id: AnchorId | null; label: string }> = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: null, label: "" },
  { id: "center", label: "Center" },
  { id: null, label: "" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" }
]

/** Brand violet first — it is the default and matches the popup chrome. */
const ACCENT_SWATCHES = [
  "#6d28d9",
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#111827"
]

export function SettingsPanel({
  settings,
  onChange,
  onReset
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onReset: () => void
}) {
  const isLossless = settings.format === "image/png"
  const usesCustomRatio = settings.aspectRatio === "custom"

  const filenamePreview = `${buildFilename(settings.filenameTemplate, {
    name: "my-thumbnail",
    domain: "example.com",
    title: "Example Page",
    width: settings.outputWidth,
    height: Math.round(settings.outputWidth / (16 / 9)),
    now: new Date()
  })}.${extensionFor(settings.format)}`

  return (
    <div className="space-y-3 p-3">
      {/* ---------------------------------------------------- capture area */}
      <Section
        icon={<IconCrop />}
        title="Capture area"
        description="The shape and starting size of the selection box.">
        <Field label="Aspect ratio">
          <SegmentedControl<AspectRatioId>
            columns={4}
            value={settings.aspectRatio}
            onChange={(aspectRatio) => onChange({ aspectRatio })}
            options={ASPECT_RATIO_PRESETS.map((preset) => ({
              value: preset.id,
              label: preset.label,
              title: preset.hint
            }))}
          />
        </Field>

        {usesCustomRatio && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Width">
                <NumberInput
                  value={settings.customRatioWidth}
                  min={1}
                  max={100}
                  onChange={(customRatioWidth) =>
                    onChange({ customRatioWidth })
                  }
                />
              </Field>
            </div>
            <span className="pb-1.5 text-xs font-medium text-gray-400">:</span>
            <div className="flex-1">
              <Field label="Height">
                <NumberInput
                  value={settings.customRatioHeight}
                  min={1}
                  max={100}
                  onChange={(customRatioHeight) =>
                    onChange({ customRatioHeight })
                  }
                />
              </Field>
            </div>
          </div>
        )}

        <Field
          label="Default size"
          hint={`Selection starts at ${settings.defaultWidthPercent}% of the viewport width, capped at ${settings.maxDefaultWidth}px.`}>
          <Slider
            value={settings.defaultWidthPercent}
            min={10}
            max={100}
            step={5}
            displayValue={`${settings.defaultWidthPercent}%`}
            onChange={(defaultWidthPercent) =>
              onChange({ defaultWidthPercent })
            }
          />
        </Field>

        <Field label="Maximum starting width">
          <NumberInput
            value={settings.maxDefaultWidth}
            min={120}
            max={4096}
            step={20}
            suffix="px"
            onChange={(maxDefaultWidth) => onChange({ maxDefaultWidth })}
          />
        </Field>

        <Field
          label="Default position"
          hint="Where the selection box appears when the overlay opens.">
          <div className="grid w-[108px] grid-cols-3 gap-1">
            {ANCHOR_CELLS.map((cell, index) => {
              if (!cell.id) {
                return <span key={index} aria-hidden="true" />
              }

              const active = settings.defaultAnchor === cell.id

              return (
                <button
                  key={index}
                  type="button"
                  title={cell.label}
                  aria-label={cell.label}
                  aria-pressed={active}
                  onClick={() =>
                    onChange({ defaultAnchor: cell.id as AnchorId })
                  }
                  className={`h-8 rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    active
                      ? "border-brand-600 bg-brand-500"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                  }`}
                />
              )
            })}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              aria-pressed={settings.defaultAnchor === "remember"}
              onClick={() => onChange({ defaultAnchor: "remember" })}
              className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                settings.defaultAnchor === "remember"
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}>
              Remember last
            </button>
            <button
              type="button"
              aria-pressed={settings.defaultAnchor === "custom"}
              onClick={() => onChange({ defaultAnchor: "custom" })}
              className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                settings.defaultAnchor === "custom"
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}>
              Exact X / Y
            </button>
          </div>
        </Field>

        {settings.defaultAnchor === "custom" && (
          <div className="flex gap-2">
            <div className="flex-1">
              <Field label="X">
                <NumberInput
                  value={settings.customX}
                  min={0}
                  max={10000}
                  suffix="px"
                  onChange={(customX) => onChange({ customX })}
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Y">
                <NumberInput
                  value={settings.customY}
                  min={0}
                  max={10000}
                  suffix="px"
                  onChange={(customY) => onChange({ customY })}
                />
              </Field>
            </div>
          </div>
        )}
      </Section>

      {/* ----------------------------------------------------- output quality */}
      <Section
        icon={<IconImage />}
        title="Output & quality"
        description="How the captured region is scaled and encoded.">
        <Field label="Resize">
          <SegmentedControl
            columns={2}
            value={settings.resizeMode}
            onChange={(resizeMode) => onChange({ resizeMode })}
            options={[
              {
                value: "preset",
                label: "Scale to width",
                title: "Resize the crop to a fixed output width"
              },
              {
                value: "native",
                label: "Native size",
                title: "Keep the captured pixel size"
              }
            ]}
          />
        </Field>

        {settings.resizeMode === "preset" && (
          <Field
            label="Output width"
            hint="Height is derived from the aspect ratio of your selection.">
            <div className="mb-2 grid grid-cols-6 gap-1">
              {OUTPUT_WIDTH_PRESETS.map((width) => (
                <button
                  key={width}
                  type="button"
                  aria-pressed={settings.outputWidth === width}
                  onClick={() => onChange({ outputWidth: width })}
                  className={`rounded border px-1 py-1 text-[10px] font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    settings.outputWidth === width
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}>
                  {width}
                </button>
              ))}
            </div>
            <NumberInput
              value={settings.outputWidth}
              min={64}
              max={7680}
              step={10}
              suffix="px"
              onChange={(outputWidth) => onChange({ outputWidth })}
            />
          </Field>
        )}

        <Field label="Format">
          <SegmentedControl<OutputFormat>
            columns={3}
            value={settings.format}
            onChange={(format) => onChange({ format })}
            options={[
              { value: "image/jpeg", label: "JPEG", title: "Smallest, lossy" },
              {
                value: "image/webp",
                label: "WebP",
                title: "Smaller than JPEG at the same quality"
              },
              { value: "image/png", label: "PNG", title: "Lossless, largest" }
            ]}
          />
        </Field>

        <Field
          label="Quality"
          hint={
            isLossless
              ? "PNG is lossless, so quality does not apply."
              : "Lower quality means a smaller file."
          }>
          <div className={isLossless ? "pointer-events-none opacity-40" : ""}>
            <Slider
              value={Math.round(settings.quality * 100)}
              min={10}
              max={100}
              step={5}
              displayValue={`${Math.round(settings.quality * 100)}%`}
              onChange={(percent) => onChange({ quality: percent / 100 })}
            />
          </div>
        </Field>

        <Field
          label="Maximum file size"
          hint="Set to 0 to disable. When set, quality is reduced automatically until the image fits.">
          <div className={isLossless ? "pointer-events-none opacity-40" : ""}>
            <NumberInput
              value={settings.maxFileSizeKb}
              min={0}
              max={20480}
              step={50}
              suffix="KB"
              placeholder="0"
              onChange={(maxFileSizeKb) => onChange({ maxFileSizeKb })}
            />
          </div>
        </Field>
      </Section>

      {/* --------------------------------------------------------- behaviour */}
      <Section
        icon={<IconSliders />}
        title="After capture"
        description="What happens once the image is ready.">
        <Field label="Action">
          <SegmentedControl
            columns={3}
            value={settings.afterCapture}
            onChange={(afterCapture) => onChange({ afterCapture })}
            options={[
              {
                value: "preview",
                label: "Preview",
                title: "Show a dialog with a preview and a download button"
              },
              {
                value: "download",
                label: "Download",
                title: "Save straight to your downloads folder"
              },
              {
                value: "clipboard",
                label: "Copy",
                title: "Copy the image to the clipboard"
              }
            ]}
          />
        </Field>

        <Field
          label="Filename template"
          hint={`Preview: ${filenamePreview}`}
          htmlFor="filenameTemplate">
          <TextInput
            id="filenameTemplate"
            value={settings.filenameTemplate}
            placeholder="{name}"
            onChange={(filenameTemplate) => onChange({ filenameTemplate })}
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {FILENAME_TOKENS.map(({ token, description }) => (
              <button
                key={token}
                type="button"
                title={description}
                onClick={() =>
                  onChange({
                    filenameTemplate: `${settings.filenameTemplate}${token}`
                  })
                }
                className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 transition-colors hover:bg-brand-50 hover:text-brand-700">
                {token}
              </button>
            ))}
          </div>
        </Field>

        <Toggle
          label="Prefill name from page URL"
          description="Use the last path segment of the current page as the default name."
          checked={settings.prefillNameFromUrl}
          onChange={(prefillNameFromUrl) => onChange({ prefillNameFromUrl })}
        />

        <Toggle
          label="Require a name before capturing"
          description="Blocks the capture button until the name field is filled in."
          checked={settings.requireName}
          onChange={(requireName) => onChange({ requireName })}
        />
      </Section>

      {/* ----------------------------------------------------------- overlay */}
      <Section
        icon={<IconPalette />}
        title="Overlay appearance"
        description="How the selection UI looks on the page.">
        <Field label="Accent colour">
          <div className="flex items-center gap-1.5">
            {ACCENT_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Accent ${color}`}
                aria-pressed={settings.accentColor === color}
                onClick={() => onChange({ accentColor: color })}
                style={{ backgroundColor: color }}
                className={`h-6 w-6 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
                  settings.accentColor === color
                    ? "ring-2 ring-gray-900 ring-offset-2"
                    : ""
                }`}
              />
            ))}
          </div>
        </Field>

        <Field
          label="Backdrop dim"
          hint="How much the rest of the page is dimmed while selecting.">
          <Slider
            value={settings.backdropOpacity}
            min={0}
            max={90}
            step={5}
            displayValue={`${settings.backdropOpacity}%`}
            onChange={(backdropOpacity) => onChange({ backdropOpacity })}
          />
        </Field>

        <Toggle
          label="Show live dimensions"
          description="Display the pixel size inside the selection box."
          checked={settings.showDimensions}
          onChange={(showDimensions) => onChange({ showDimensions })}
        />

        <Toggle
          label="Show rule-of-thirds grid"
          description="Overlay composition guides inside the selection box."
          checked={settings.showGrid}
          onChange={(showGrid) => onChange({ showGrid })}
        />
      </Section>

      {/* ------------------------------------------------ remote compression */}
      <Section
        icon={<IconCloudUp />}
        title="Extra compression"
        description="Optional. Everything above happens on your device.">
        <Toggle
          label="Compress via iLoveIMG"
          description="Uploads each capture to iloveimg.com for extra compression. Requires your own API key."
          checked={settings.remoteCompression}
          onChange={(remoteCompression) => onChange({ remoteCompression })}
        />

        {settings.remoteCompression && (
          <>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
              <p className="text-[11px] leading-snug text-amber-800">
                <span className="font-semibold">Heads up:</span> with this on,
                your screenshots leave your device and are uploaded to a
                third-party service. Leave it off to keep every capture local.
              </p>
            </div>

            <Field
              label="iLoveIMG public key"
              htmlFor="iLoveImgPublicKey"
              hint="Create a free key at developer.ilovepdf.com and paste it here.">
              <TextInput
                id="iLoveImgPublicKey"
                type="password"
                value={settings.iLoveImgPublicKey}
                placeholder="project_public_..."
                onChange={(iLoveImgPublicKey) =>
                  onChange({ iLoveImgPublicKey })
                }
              />
            </Field>
          </>
        )}
      </Section>

      {/* ------------------------------------------------------------- reset */}
      <button
        type="button"
        onClick={onReset}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-xs font-medium text-gray-500 shadow-card ring-1 ring-gray-900/5 transition-colors hover:bg-red-50 hover:text-red-600 hover:ring-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
        <IconRotateCcw className="h-3.5 w-3.5" />
        Reset all settings to defaults
      </button>

      <p className="pb-1 text-center text-[11px] text-gray-400">
        Changes save automatically
      </p>
    </div>
  )
}
