/**
 * Small presentational building blocks shared by the settings panel.
 * Kept deliberately dependency-free so they also work inside the Shadow DOM.
 */

import type { ReactNode } from "react"

/**
 * Rounded square holding a section or row glyph, echoing the tinted icon
 * chips used throughout the popup.
 */
export function IconBadge({
  children,
  tone = "brand"
}: {
  children: ReactNode
  tone?: "brand" | "muted"
}) {
  return (
    <span
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
        tone === "brand"
          ? "bg-brand-50 text-brand-700"
          : "bg-gray-100 text-gray-500"
      }`}>
      <span className="h-4 w-4">{children}</span>
    </span>
  )
}

/** A titled white card. Sections stack vertically on the tinted page. */
export function Card({
  title,
  description,
  icon,
  action,
  children,
  bodyClassName = "mt-3.5 space-y-3.5"
}: {
  title?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  bodyClassName?: string
}) {
  return (
    <section className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-gray-900/5">
      {title && (
        <div className="flex items-start gap-2.5">
          {icon && <IconBadge>{icon}</IconBadge>}
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-semibold leading-5 text-gray-900">
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-[11px] leading-snug text-gray-400">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={title ? bodyClassName : ""}>{children}</div>
    </section>
  )
}

/** Backwards-compatible alias used by the settings panel. */
export const Section = Card

export function Field({
  label,
  hint,
  htmlFor,
  children
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

export function Toggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <span
        className={`mt-0.5 inline-flex h-[18px] w-8 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-brand-600" : "bg-gray-300"
        }`}>
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[17px]" : "translate-x-[3px]"
          }`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-gray-700">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[11px] leading-snug text-gray-400">
            {description}
          </span>
        )}
      </span>
    </button>
  )
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  columns = 3
}: {
  options: Array<{ value: T; label: string; title?: string }>
  value: T
  onChange: (next: T) => void
  columns?: number
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              active
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            }`}>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Select<T extends string>({
  id,
  value,
  onChange,
  options
}: {
  id?: string
  value: T
  onChange: (next: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  placeholder
}: {
  id?: string
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
  placeholder?: string
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const parsed = Number(e.target.value)

          // Let the field go momentarily empty while typing rather than
          // snapping the value back to `min` on every keystroke.
          onChange(e.target.value === "" ? NaN : parsed)
        }}
        onBlur={(e) => {
          const parsed = Number(e.target.value)

          onChange(
            Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min
          )
        }}
        className={`w-full rounded-md border border-gray-200 bg-white py-1.5 pl-2.5 text-xs text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
          suffix ? "pr-9" : "pr-2.5"
        }`}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] text-gray-400">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function Slider({
  id,
  value,
  onChange,
  min,
  max,
  step,
  displayValue
}: {
  id?: string
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  step: number
  displayValue: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-brand-600"
      />
      <span className="w-11 flex-shrink-0 text-right text-xs font-medium tabular-nums text-gray-600">
        {displayValue}
      </span>
    </div>
  )
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  spellCheck = false
}: {
  id?: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  type?: "text" | "password"
  spellCheck?: boolean
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      spellCheck={spellCheck}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm placeholder:text-gray-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    />
  )
}
