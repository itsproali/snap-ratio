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

```
Art & Design
```

Chrome's own description for it names this use case directly:

> These extensions provide tools for viewing, editing, organizing, and sharing
> images and photos. They may also offer features for **capturing screenshots**,
> image searching, and integrating with popular image hosting or editing
> services.

The old **Photos** category was folded into Art & Design, and **Productivity**
is deprecated entirely (it now maps across Education, Functionality & UI,
Household, Privacy & Security, Tools and Workflow & Planning).

Runner-up is **Workflow & Planning**, but its description is about time
trackers, to-do lists, email organisers and calendars — a worse fit. **Tools**
is explicitly the "doesn't fit anywhere else" bucket, which does not apply here.

Only one category can be selected, and it can be changed later from the
dashboard.

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

**Remote code** — select **"No, I am not using remote code."**

Everything is bundled into the package by Plasmo. There is no `eval`, no
`<script>` pointing at an external file, no remotely loaded module, and no
remote web font (the Google Fonts import was removed precisely so this answer
stays a clean "no"). Selecting "Yes" here invites an in-depth review you do not
need.

---

## Permission justifications (1,000 char limit each)

### storage justification

```
Snap Ratio stores only the user's own capture preferences: aspect ratio, default frame size and position, output width, image format, quality, maximum file size, filename template, and overlay appearance. Persisting these is the core value of the extension, since the user configures a preset once instead of re-entering it on every capture. chrome.storage.sync is used so the preferences follow the user's own signed-in Chrome profile across their computers. No captured image, page content, browsing history, analytics or personal data is ever written to storage.
```

### activeTab justification

```
activeTab is required to call chrome.tabs.captureVisibleTab on the tab the user explicitly invoked the extension on. That call is the only way to produce the screenshot the user asked for, which is the extension's single purpose. Access is granted by the user's own gesture, either clicking the toolbar icon or pressing the keyboard shortcut, and is used solely to capture the visible area of that one tab at that moment. The extension does not enumerate the user's other tabs, read tab history, or touch any tab the user has not acted on.
```

### downloads justification

```
downloads is used to save the finished image to the user's Downloads folder when they have chosen "Download" as their post-capture action in settings. It is called only in direct response to a capture the user initiated, and the filename comes from the user's own template. The extension never initiates a download the user did not ask for, never downloads from a remote URL (the image is generated locally and passed as a data URL), and never reads, searches or modifies the user's existing download history.
```

### Host permission justification

```
The selection frame users drag to choose their capture region is drawn by a content script, so it must be able to run on whichever page the user wants to capture. Since that can be any website, the match pattern must be http://*/* and https://*/*; there is no fixed set of hosts to narrow it to. The host permission is also required for chrome.tabs.captureVisibleTab to capture the tab.

On the page, the content script only renders the extension's own overlay inside a Shadow DOM and reads the window dimensions and device pixel ratio, which are needed to map the selected region onto the captured image. The single piece of page data it reads is the page title, and only to fill the optional {title} filename token; the page's hostname is likewise used only for the optional {domain} token. It does not read or transmit page text, form data, cookies or credentials, and it makes no network requests of any kind, so nothing from any site leaves the user's device.
```

The dashboard warns that a host permission may trigger an in-depth review. That
is expected for any screenshot extension and is not a rejection — the
justification above states plainly why the pattern cannot be narrowed, and what
the content script does and does not touch.

Note the deliberate honesty about the page title and hostname: they *are* read,
purely to fill the optional `{title}` and `{domain}` filename tokens. A
reviewer will see `document.title` and `tab.url` in the source, so claiming the
extension reads nothing from the page would be a mismatch worth avoiding.

> If [PR #3](https://github.com/itsproali/snap-ratio/pull/3) (optional iLoveIMG
> compression) is ever merged, the Data usage answers change — you must then
> declare **Website content**. Update this file in the same pass.
