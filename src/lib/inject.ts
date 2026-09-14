/**
 * Delivering messages to the content script, re-injecting it when it is gone.
 *
 * Chrome does not re-inject declarative content scripts into tabs that were
 * already open when the extension installs or updates. Those tabs keep the
 * *previous* build's script, whose `chrome.runtime` is dead, so every message
 * to them fails until the page is reloaded. The same dead end shows up for
 * tabs opened before the extension was installed, and for users who set the
 * extension's site access to "on click".
 *
 * `sendToContentScript` recovers from all three by injecting a fresh copy of
 * the script and retrying.
 */

import type { RuntimeMessage } from "@/lib/messages"

/**
 * How long to wait before the second delivery attempt.
 *
 * Plasmo injects at `document_idle`, so a message fired straight after a
 * navigation can land before the listener is registered. That script is alive
 * and about to answer - injecting a second copy of it would mount a second
 * overlay - so the retry happens before any injection, never after.
 */
const RETRY_DELAY_MS = 400

/** The content script bundles declared in the manifest, hashed names and all. */
function contentScriptFiles(): string[] {
  const scripts = chrome.runtime.getManifest().content_scripts ?? []

  return scripts.flatMap((script) => script.js ?? [])
}

/**
 * Delivers `message` to the tab's content script.
 *
 * Attempts, in order: send, wait and send again (covers the `document_idle`
 * race), then inject and send a final time (covers an orphaned or absent
 * script). Silence across the first two attempts is what marks the script as
 * dead rather than merely slow, which is why injection is only ever the third
 * step.
 *
 * @throws if the script still cannot be reached, e.g. on a page where Chrome
 *   forbids extensions outright.
 */
export async function sendToContentScript(
  tabId: number,
  message: RuntimeMessage
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message)

    return
  } catch {
    // Fall through to the retry below.
  }

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))

  try {
    await chrome.tabs.sendMessage(tabId, message)

    return
  } catch {
    // Fall through to the injection below.
  }

  const files = contentScriptFiles()

  if (!chrome.scripting || files.length === 0) {
    throw new Error(
      "Snap Ratio is not loaded on this tab yet. Reload the page and try again."
    )
  }

  try {
    // Resolves only once the script has run, so its listener is registered by
    // the time the send below happens.
    await chrome.scripting.executeScript({ target: { tabId }, files })

    await chrome.tabs.sendMessage(tabId, message)
  } catch {
    throw new Error(
      "Snap Ratio could not start on this tab. Reload the page and try again."
    )
  }
}
