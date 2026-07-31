# Snap Ratio

A Chrome (MV3) extension that captures a fixed-ratio region of any page, scales
and encodes it locally, and hands you the result as a download, a clipboard
image, or a preview.

Built with [Plasmo](https://www.plasmo.com/), React 19, TypeScript and
TailwindCSS.

## Features

- **Configurable aspect ratio** — 16:9, 4:3, 3:2, 1:1, 9:16, 21:9, a custom
  ratio of your own, or free-form with no lock.
- **Remembered defaults** — every option below lives in the popup and persists
  via `chrome.storage.sync`, so you set it once instead of on every capture.
  - starting size (% of viewport, with a max width cap)
  - starting position (nine-point anchor grid, exact X/Y, or "remember last")
  - output width, format (JPEG / WebP / PNG) and quality
  - an optional maximum file size, which steps quality down until it fits
  - what happens after a capture: preview, download, or copy to clipboard
  - filename template with `{name}`, `{domain}`, `{title}`, `{date}`, `{time}`,
    `{timestamp}`, `{width}`, `{height}` tokens
  - overlay accent colour, backdrop dim, live dimensions, rule-of-thirds grid
- **Keyboard driven** — <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> starts a
  capture, <kbd>Enter</kbd> confirms, <kbd>Esc</kbd> cancels, arrow keys nudge
  (hold <kbd>Shift</kbd> for 10px steps).
- **Fully local** — cropping, resizing and encoding all happen on-device with
  `OffscreenCanvas`. The extension makes no network requests at all.

## Tech stack

| Piece         | Version           |
| ------------- | ----------------- |
| Plasmo        | 0.90.5            |
| React         | 19.2              |
| TypeScript    | 5.9               |
| TailwindCSS   | 3.4               |
| `@plasmohq/storage` | 1.15        |

### Build gotchas

Plasmo 0.90 runs on Parcel 2.9, which is sensitive to a few things in
`package.json`. All three of these produce builds that *look* successful:

1. **Never add an `engines` field.** Parcel infers a Node/library target from
   it and marks every dependency as external. React then never lands in the
   bundle (the content script drops from ~284KB to ~44KB and the module map
   shows `"react": "react"`), and the popup entry fails to resolve. The
   extension loads but crashes the moment any UI mounts.
2. **Never override `manifest.action` wholesale.** Plasmo derives
   `action.default_popup` from `src/popup.tsx`; supplying your own `action`
   object replaces it, so `popup.html` is never generated and clicking the
   toolbar icon does nothing. This is why there is no custom `default_title` —
   Chrome falls back to the extension name, which is fine.
3. **Stay on Tailwind 3.x.** Tailwind 4's PostCSS plugin pulls in
   `@tailwindcss/node` → `jiti`, which imports `node:module`; Parcel tries to
   resolve that for a browser target and the build fails outright. Revisit once
   Plasmo ships a newer Parcel.

After any dependency or config change, sanity-check the output:

```bash
pnpm build
# popup.html must exist, and React must be inlined in both bundles:
ls build/chrome-mv3-prod/popup.html
grep -rl "Minified React error" build/chrome-mv3-prod/
```

`web_accessible_resources` lists a `content.*.css` file that is never emitted —
the content script's styles are inlined as a string via `data-text:@/style.css`.
That is long-standing Plasmo behaviour, Chrome tolerates it, and nothing
requests the file.

## Project structure

```bash
src/
├── popup.tsx                  # Popup shell: Capture and Settings tabs
├── content.tsx                # Selection overlay, result dialog, toasts
├── background/
│   └── index.ts               # Crop/resize/encode, downloads, shortcut relay
├── components/
│   ├── SettingsPanel.tsx      # Every user-facing setting
│   └── controls.tsx           # Toggle, slider, segmented control, inputs
├── lib/
│   ├── settings.ts            # Schema, defaults, storage helpers
│   └── messages.ts            # Typed message contract + type guards
└── style.css                  # Tailwind entry + Shadow DOM reset
```

## Getting started

```bash
pnpm install
pnpm dev
```

Then load the unpacked extension:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. **Load unpacked** → select `build/chrome-mv3-dev`

### Useful scripts

| Script                  | What it does                                  |
| ----------------------- | --------------------------------------------- |
| `pnpm dev`              | Dev build with hot reload                     |
| `pnpm build`            | Production build → `build/chrome-mv3-prod`    |
| `pnpm package`          | Zip the production build for the store        |
| `pnpm build:firefox`    | Firefox MV3 build                             |
| `pnpm typecheck`        | `tsc --noEmit`                                |
| `pnpm format`           | Prettier write over `src/`                    |

## Usage

1. Click the toolbar icon (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>).
2. Optionally type a name — it feeds the `{name}` filename token, and can be
   prefilled from the page URL.
3. Hit **Select area to capture**. Drag and resize the frame; the ratio stays
   locked to whatever you configured.
4. Press <kbd>Enter</kbd> or click **Capture**.

Everything else follows your saved settings. Open the **Settings** tab in the
popup to change them; changes apply to the next capture with no reload.

## Permissions

| Permission                    | Why                                                                 |
| ----------------------------- | -------------------------------------------------------------------- |
| `activeTab`                   | Read the current tab in order to screenshot it                       |
| `storage`                     | Persist your settings                                                |
| `downloads`                   | Save the image when "Download" is the post-capture action            |
| `http://*/*`, `https://*/*`   | Draw the selection overlay on the page you want to capture           |

`tabs` and `scripting` are deliberately not requested — the content script reports
its own viewport instead of the service worker injecting a script to measure it.

## Publishing to the Chrome Web Store

See **[PUBLISHING.md](./PUBLISHING.md)** for the full walkthrough: developer
account, first manual upload, store listing assets, privacy and permission
disclosures, OAuth credentials, and the release flow.

### Branching model

- **`dev`** — day-to-day work. `ci.yml` runs typecheck, a Prettier check and a
  build on every push and PR.
- **`main`** — merging here releases.

Versions are never edited by hand. On every push to `main`, `release.yml` runs
semantic-release: it reads the conventional-commit messages since the last tag,
writes the next version to `package.json` (where Plasmo reads the manifest
version from), updates `CHANGELOG.md`, tags, creates the GitHub release, then
builds and uploads to the Chrome Web Store.

| Prefix | Bump |
| --- | --- |
| `feat:` | minor |
| `fix:` `perf:` `refactor:` `style:` `build:` | patch |
| `feat!:` / `BREAKING CHANGE:` | major |
| `docs:` `test:` `ci:` `chore:` | no release |

```bash
git commit -m "feat: add a rounded-corner option"
git push origin dev
gh pr create --base main --head dev --fill && gh pr merge --merge
```

For a dry run, use **Actions → Release → Run workflow** with **dry run** ticked:
it computes the next version and builds, without tagging or publishing.

## Notes

- Selection bounds are in CSS pixels and are scaled into screenshot pixel space
  using the ratio between the captured image and the viewport the content
  script measured, so high-DPI displays and browser zoom are handled.
- The crop and the resize are a single `drawImage` call, so the image is
  resampled once rather than twice.
- The content script bundle (~284KB) loads on every `http(s)` page because the
  overlay is registered declaratively. If page-load cost matters more than the
  reduced permission surface, switch to `chrome.scripting.executeScript` on
  demand and re-add the `scripting` permission.

## License

MIT
