# Privacy Policy — Snap Ratio

_Last updated: 31 July 2026_

Snap Ratio is a browser extension that captures a fixed-ratio region of the
page you are viewing and turns it into an image file.

## What we collect

**Nothing.** Snap Ratio has no analytics, no telemetry, no crash reporting, no
accounts, and no server of its own. We cannot see what you capture, which sites
you visit, or how often you use the extension.

## What stays on your device

| Data                                | Where it lives                    | Why                                                  |
| ----------------------------------- | --------------------------------- | ---------------------------------------------------- |
| Your settings (ratio, size, format, quality, filename template, and so on) | `chrome.storage.sync` | So you do not have to reconfigure on every capture. Chrome may sync this to your other signed-in Chrome profiles. It is never sent to us. |
| The last selection rectangle        | `chrome.storage.sync`             | Only stored when you choose "Remember last" as the default position. |
| The captured image                  | In-memory, then your Downloads folder or clipboard | Cropping, resizing and encoding all happen locally in the extension's service worker. |

Captured images are **not** written to storage, and are discarded as soon as
the preview dialog closes.

## Network activity

Snap Ratio makes **no network requests at all**. There is no server, no
third-party service, and no telemetry. Cropping, resizing and encoding all
happen locally in the extension's service worker using `OffscreenCanvas`.

## Permissions and why they are needed

| Permission                     | Why                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `activeTab`                    | Lets the extension read the current tab so it can take the screenshot you asked for.             |
| `storage`                      | Saves your settings so they persist between captures.                                            |
| `downloads`                    | Saves the finished image when you pick "Download" as the post-capture action.                    |
| Host access to `http`/`https`  | The selection overlay is drawn by a content script, which must be able to run on the page you want to capture. It only draws UI and measures the viewport; it does not read page content. |

## Data sale and transfer

We do not sell, rent, or transfer your data to anyone, for any purpose. There is
no data to transfer.

## Changes

Material changes to this policy will be published in this file and reflected in
the extension's Chrome Web Store listing.

## Contact

Questions or concerns: [itsproali@gmail.com](mailto:itsproali@gmail.com), or
open an issue at <https://github.com/itsproali/snap-ratio/issues>.
