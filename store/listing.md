# Chrome Web Store listing copy

Copy-paste source for the dashboard fields. The detailed description is written
as **plain text** because the store does not render Markdown — it only preserves
line breaks.

---

## Name (45 char limit)

```
Snap Ratio — Fixed-Ratio Screenshot Capture
```

43 characters.

---

## Summary / short description (132 char limit)

```
Screenshot any page region locked to 16:9, 1:1, 9:16 or your own ratio. Set size, format and quality once. Fully offline.
```

120 characters.

Alternates, if you want to A/B the listing later:

```
Capture perfectly proportioned screenshots. Lock the frame to any aspect ratio, save your preset once, reuse it every time.
```

122 characters.

```
Fixed-ratio screenshot tool for thumbnails and mockups. Pick a ratio, drag, capture. No account, no uploads, fully offline.
```

122 characters.

---

## Category

Productivity → Workflow & Planning

---

## Detailed description

```
Snap Ratio takes screenshots that are already the right shape.

Instead of cropping a rough capture afterwards, you drag a frame that is locked
to the aspect ratio you need — 16:9 for a YouTube thumbnail, 1:1 for a social
post, 9:16 for a Story — and the extension scales and encodes it to the exact
output you configured.

Set your preferences once. Every capture after that is: click, drag, Enter.


────────────────────────────────
SET IT ONCE, NOT EVERY TIME
────────────────────────────────

Everything below lives in the popup and is remembered between captures. Because
settings sync with your Chrome profile, they follow you to your other signed-in
computers.

• Aspect ratio — 16:9, 4:3, 3:2, 1:1, 9:16, 21:9, a custom ratio of your own, or
  free-form with no lock at all.

• Starting size and position — how large the frame opens (as a percentage of the
  window, with a maximum width), and where it appears: a nine-point anchor grid,
  exact X/Y coordinates, or "remember where I left it last time".

• Output size — scale every capture to a fixed width (640, 854, 1280, 1600,
  1920, 2560 or anything you type), or keep the captured pixels untouched.

• Format and quality — JPEG, WebP or PNG, with a quality slider.

• Maximum file size — set a ceiling in KB and Snap Ratio steps quality down
  automatically until the image fits. Useful when a platform enforces an upload
  limit.

• What happens next — show a preview, download straight away, or copy the image
  to your clipboard.

• Filenames — build them from a template using {name}, {domain}, {title},
  {date}, {time}, {timestamp}, {width} and {height}. The name field can be
  pre-filled from the page URL so a whole batch stays consistent.


────────────────────────────────
A SELECTION OVERLAY THAT GETS OUT OF THE WAY
────────────────────────────────

• The frame stays locked to your ratio while you drag and resize it.
• Live pixel dimensions shown as you size it.
• Optional rule-of-thirds grid for composing the shot.
• Adjustable accent colour and background dimming.

Keyboard throughout:

• Alt+Shift+S  — start a capture without opening the popup
• Enter        — capture
• Esc          — cancel
• Arrow keys   — nudge the frame one pixel (hold Shift for ten)


────────────────────────────────
NOTHING LEAVES YOUR COMPUTER
────────────────────────────────

Snap Ratio makes no network requests. None.

Cropping, resizing and encoding all happen locally inside the extension. There
is no server, no third-party image service, no analytics, no telemetry, no
account and no sign-in. Captured images are never stored by the extension —
they go to your Downloads folder or your clipboard and are then discarded.

The only thing saved is your own settings, and that stays in your browser.


────────────────────────────────
PERMISSIONS, AND WHY
────────────────────────────────

• activeTab — to take the screenshot of the tab you invoked the extension on.
• storage — to remember your settings between captures.
• downloads — to save the image when you choose "Download".
• Access to websites — the selection frame is drawn on the page you want to
  capture, so it has to be able to run there. It only draws that UI and measures
  the window size; it does not read, collect or transmit page content.


────────────────────────────────
GOOD FOR
────────────────────────────────

• YouTube thumbnails at a consistent 16:9
• App Store and Play Store screenshots
• Social posts that need a square or vertical crop
• Documentation and tutorial images at one uniform width
• Design references and mood boards
• Bug reports where the framing needs to be repeatable


Snap Ratio is open source: https://github.com/itsproali/snap-ratio
Privacy policy: https://github.com/itsproali/snap-ratio/blob/main/PRIVACY.md
```

---

## Privacy practices answers

**Single purpose**

```
Capture a fixed-aspect-ratio region of the current page and save it as an image file.
```

**Data usage** — tick nothing. Snap Ratio collects no user data and makes no
network requests, so every category is a genuine "no". Confirm all three
certifications.

**Remote code** — No. Everything is bundled; there is no `eval`, no remote
script, and no remote font.

Permission justifications are in [`PUBLISHING.md`](../PUBLISHING.md#4-privacy-and-permission-disclosures).

> If [PR #3](https://github.com/itsproali/snap-ratio/pull/3) (optional iLoveIMG
> compression) is ever merged, the Data usage answers change — you must then
> declare **Website content**. Update this file in the same pass.
