#!/usr/bin/env node
/**
 * Mints the Chrome Web Store API refresh token needed by the release workflow
 * and prints the ready-to-paste SUBMIT_KEYS secret.
 *
 * Usage:
 *   node scripts/cws-token.mjs
 *
 * You will be prompted for the OAuth client ID/secret and the extension ID.
 * The script starts a loopback listener, opens the Google consent screen, and
 * exchanges the returned authorization code for a refresh token. Nothing is
 * written to disk and nothing is sent anywhere except Google.
 *
 * Prerequisites are described in PUBLISHING.md. The two that bite people:
 *   - the OAuth client must be of type "Desktop app"
 *   - the consent screen must be **published** ("In production"), otherwise
 *     Google expires the refresh token after 7 days
 */

import { exec } from "node:child_process"
import { createServer } from "node:http"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"

const PORT = 8818
const REDIRECT_URI = `http://localhost:${PORT}`
const SCOPE = "https://www.googleapis.com/auth/chromewebstore"

const rl = createInterface({ input: stdin, output: stdout })

async function askRequired(question) {
  for (;;) {
    const answer = (await rl.question(question)).trim()

    if (answer) return answer

    console.log("  ...required.")
  }
}

/** Opens a URL in the default browser, best-effort across platforms. */
function openBrowser(url) {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start \"\""
        : "xdg-open"

  exec(`${cmd} "${url}"`, () => {
    /* If this fails the user can paste the URL manually. */
  })
}

/** Waits for Google to redirect back with ?code=... and returns the code. */
function waitForCode() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI)
      const code = url.searchParams.get("code")
      const error = url.searchParams.get("error")

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(
        `<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:40px">
         <h2>${code ? "Authorized." : "Authorization failed"}</h2>
         <p>${code ? "You can close this tab and return to the terminal." : error ?? "No code returned."}</p>
         </body>`
      )

      server.close()
      code ? resolve(code) : reject(new Error(error ?? "No authorization code"))
    })

    server.on("error", reject)
    server.listen(PORT)

    setTimeout(
      () => {
        server.close()
        reject(new Error("Timed out waiting for the browser redirect."))
      },
      5 * 60 * 1000
    ).unref()
  })
}

console.log("\nChrome Web Store — refresh token setup\n")

const clientId = await askRequired("OAuth client ID:      ")
const clientSecret = await askRequired("OAuth client secret:  ")
const extId = await askRequired("Extension ID:         ")

const authUrl =
  "https://accounts.google.com/o/oauth2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    // Both are required for Google to return a refresh_token at all.
    access_type: "offline",
    prompt: "consent"
  })

console.log("\nOpening the consent screen. If it does not open, visit:\n")
console.log(authUrl + "\n")
console.log("Waiting for the redirect back to localhost...\n")

openBrowser(authUrl)

let refreshToken

try {
  const code = await waitForCode()

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI
    })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      `Token exchange failed (${response.status}): ${data.error_description ?? data.error ?? "unknown"}`
    )
  }

  if (!data.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token. Revoke the app at " +
        "https://myaccount.google.com/permissions and run this again."
    )
  }

  refreshToken = data.refresh_token
} catch (error) {
  console.error("\n" + error.message + "\n")
  rl.close()
  process.exit(1)
}

rl.close()

const secret = {
  $schema:
    "https://raw.githubusercontent.com/PlasmoHQ/bpp/v3/keys.schema.json",
  chrome: { clientId, clientSecret, refreshToken, extId }
}

console.log("Done. Add this as the repository secret SUBMIT_KEYS:\n")
console.log("-".repeat(64))
console.log(JSON.stringify(secret, null, 2))
console.log("-".repeat(64))
console.log(
  "\n  gh secret set SUBMIT_KEYS < the-json-above.json\n" +
    "  (or paste it at Settings -> Secrets and variables -> Actions)\n"
)
