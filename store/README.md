# Store assets

Everything the Chrome Web Store listing needs, kept next to the code so it can
be regenerated when the UI changes.

| Path | What it is |
| --- | --- |
| `listing.md` | Name, summary, category, description, privacy answers, permission justifications |
| `icon-128.png` | 128×128 store icon (separate from the manifest icons in `assets/`) |
| `screenshots/` | Five 1280×800 listing screenshots |

## Regenerating the screenshots

They are composed from the **real built bundles**, so they never drift from
what ships. Chrome removed the `--load-extension` switch, so the extension
cannot be side-loaded; instead the actual `popup.*.js` and `content.*.js` from
`build/chrome-mv3-prod` are loaded into a page with the handful of `chrome.*`
APIs they touch stubbed out. The image inside the result dialog is a genuine
crop of the demo page at the exact bounds the overlay reported.

The generator scripts live outside the repo (they were written in a scratch
directory). If you need to rebuild the screenshots, the shape is:

1. `pnpm build`
2. Serve a demo page over `http://` and inject `content.*.js` plus a stub
   exposing `chrome.runtime.onMessage` / `chrome.storage.sync`.
3. Fire `{ action: "showSelectionOverlay" }` at the registered listener, then
   screenshot at 1280×800, `deviceScaleFactor: 2`.
4. Do the same for `popup.*.js` at 400×600, clicking through the tabs.
5. Compose each capture onto a violet 1280×800 frame with a headline, render at
   2× and downsample to exactly 1280×800.

Serve the bundles as separate files rather than inlining them — they contain
`</script>` sequences inside string literals that terminate an inline tag early.
