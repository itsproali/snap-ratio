# Publishing Snap Ratio

End-to-end guide for shipping this extension to the Chrome Web Store from
GitHub. Part 1 is a one-time setup; after that, releasing is a merge to `main`.

- [Branching model](#branching-model)
- [Part 1 — one-time setup](#part-1--one-time-setup)
  - [1. Developer account](#1-developer-account)
  - [2. First upload (manual)](#2-first-upload-manual)
  - [3. Store listing](#3-store-listing)
  - [4. Privacy and permission disclosures](#4-privacy-and-permission-disclosures)
  - [5. Submit for review](#5-submit-for-review)
  - [6. API credentials for automation](#6-api-credentials-for-automation)
  - [7. Add the GitHub secret](#7-add-the-github-secret)
- [Part 2 — every release after that](#part-2--every-release-after-that)
- [Troubleshooting](#troubleshooting)

---

## Branching model

```bash
dev   ──o──o──o──────o──o──o───────>   day-to-day work; CI on every push
          \         /        \
main   ────o───────o──────────o────>   merge here = release
           v1.0.0             v1.1.0
```

- **`dev`** — where you work. Push freely; `ci.yml` runs typecheck, a Prettier
  check and a build on every push and PR.
- **`main`** — release branch. **Merging here publishes.**

You never edit the version by hand. On every push to `main`, `release.yml` runs
[semantic-release](https://semantic-release.gitbook.io/), which:

1. reads the conventional-commit messages since the last tag,
2. works out the next version and writes it to `package.json` — which is where
   Plasmo reads the manifest version from,
3. updates `CHANGELOG.md`, commits both, and tags `vX.Y.Z`,
4. creates the GitHub release,
5. then builds, packages and uploads to the Chrome Web Store.

If there are no releasable commits, the workflow exits green and publishes
nothing.

> Versioning and publishing live in **one** job on purpose. Tags pushed using
> the built-in `GITHUB_TOKEN` do not trigger other workflows, so a separate
> tag-triggered publish job would silently never run.

### Commit messages drive the version

| Prefix | Bump | Appears in changelog |
| --- | --- | --- |
| `feat:` | minor — 1.0.0 → 1.1.0 | Features |
| `fix:` | patch — 1.0.0 → 1.0.1 | Bug Fixes |
| `perf:` | patch | Performance |
| `refactor:` | patch | Refactoring |
| `style:` | patch | UI & Styling |
| `build:` | patch | Build |
| `docs:` `test:` `ci:` `chore:` | none | hidden |
| `feat!:` or a `BREAKING CHANGE:` footer | major — 1.0.0 → 2.0.0 | Breaking |

A branch of only `chore:`/`docs:` commits merges to `main` without releasing,
which is usually what you want.

> Never use a prerelease suffix (`1.2.0-beta.1`). Chrome manifest versions must
> be 1–4 dot-separated integers, and the store rejects anything else. The
> config has no prerelease branches, so this only matters if you add one.

### Branch protection

If you protect `main` with "require a pull request before merging", you must
also let the release job push its version-bump commit back, or every release
fails at the git step. In **Settings → Rules → Rulesets**, add
`repository-actions` / the **github-actions[bot]** actor to the **bypass list**.

The release commit is `chore(release): x.y.z [skip ci]`; the `[skip ci]` marker
stops it from re-triggering the workflow.

Other settings worth enabling: require status checks on `main` (select
**Typecheck & build**), and set the default branch to `dev`
(**Settings → General → Default branch**) so new PRs target it automatically.

---

## Part 1 — one-time setup

### 1. Developer account

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with the Google account that should **own** the extension. This is
   hard to change later — if this is a product rather than a personal project,
   consider a dedicated account or a Google group.
3. Pay the one-time **$5 USD** registration fee. You cannot publish until this
   clears.
4. Fill in your publisher contact email and **verify it**. Unverified publishers
   cannot submit.

### 2. First upload (manual)

The API can only *update* an existing item, so the first upload has to be done
by hand to create the item and mint its ID.

```bash
git checkout main
pnpm install --frozen-lockfile
pnpm build
pnpm package
# -> build/chrome-mv3-prod.zip
```

In the dashboard: **Items → Add new item** → upload `build/chrome-mv3-prod.zip`.

Once it uploads, copy the **Item ID** from the URL or the item header — a
32-character string like `abcdefghijklmnopabcdefghijklmnop`. That is your
`extId`; you need it in step 6.

> Do not click Publish yet. Fill in the listing first.

**Why this one is manual:** the Chrome Web Store API can only *update* an item
that already exists and has been published at least once. Automation cannot
create it, so release 1.0.0 by hand; every version after that is automated.

**Set the semantic-release baseline afterwards.** `package.json` is at `1.0.0`,
and a `v1.0.0` tag already exists from earlier development — it points at an old
commit, so semantic-release would see every commit since as unreleased and jump
straight to `1.1.0`. Once the manual 1.0.0 upload is **approved and live**, move
the tag onto the commit you actually shipped:

```bash
git checkout main && git pull
git tag -f v1.0.0            # re-point it at the released commit
git push -f origin v1.0.0
```

That is safe here precisely because nothing has been published under the old
tag. From then on, merging to `main` computes 1.0.1 / 1.1.0 / 2.0.0 from your
commit messages and publishes automatically — and you never force-push a tag
again.

### 3. Store listing

Under **Store listing**:

| Field | What to use |
| --- | --- |
| Name | Snap Ratio — Fixed-Ratio Screenshot Capture |
| Summary | 132 chars max. The `description` from `package.json` fits. |
| Description | Longer copy; the README feature list is a good starting point. |
| Category | Productivity → Workflow & Planning |
| Language | English |

**Graphics you must supply** (the manifest icons do *not* cover these):

| Asset | Size | Required |
| --- | --- | --- |
| Store icon | 128×128 PNG | Yes |
| Screenshot | 1280×800 or 640×400 PNG/JPEG | Yes — at least 1, up to 5 |
| Small promo tile | 440×280 PNG | Only if you want to be featured |
| Marquee promo tile | 1400×560 PNG | Only if you want to be featured |

For the store icon, upload the pre-generated `store/icon-128.png`.

Good screenshots to take (1280×800):

1. The popup's **Capture** tab over a real page.
2. The selection overlay mid-drag, showing the ratio lock and dimensions.
3. The popup's **Settings** tab.
4. The result dialog with a captured thumbnail.

### 4. Privacy and permission disclosures

This is where most first submissions get rejected. Under **Privacy practices**:

**Single purpose** — one sentence, must be genuinely singular:

> Capture a fixed-aspect-ratio region of the current page and save it as an
> image file.

**Permission justifications** — paste these:

| Permission | Justification |
| --- | --- |
| `activeTab` | Required to call `chrome.tabs.captureVisibleTab` on the tab the user explicitly invoked the extension on, in order to produce the screenshot they requested. |
| `storage` | Stores the user's own capture preferences (aspect ratio, output size, format, quality, filename template) so they persist between captures. No user content is stored. |
| `downloads` | Saves the finished image to the user's Downloads folder when they choose "Download" as the post-capture action. |
| Host permission (`http://*/*`, `https://*/*`) | The selection overlay is a content script that must render on whichever page the user wants to capture. It only draws the selection UI and reads the viewport dimensions needed to map the selection onto the screenshot; it does not read or transmit page content. |

**Remote code** — answer **No**. Everything is bundled; there are no remote
scripts, no `eval`, and the web font import was removed for exactly this reason.

**Data usage** — tick nothing, and confirm all three certifications. Snap Ratio
collects nothing and makes no network requests, so every category is a genuine
"no". This is the single biggest reason the first review should go smoothly.

**Privacy policy URL** — required. Publish [`PRIVACY.md`](./PRIVACY.md) at a
stable public URL. Simplest option, no extra hosting:

```
https://github.com/itsproali/snap-ratio/blob/main/PRIVACY.md
```

Or enable GitHub Pages (**Settings → Pages → Deploy from branch → main /root**)
and use `https://itsproali.github.io/snap-ratio/`.

### 5. Submit for review

Click **Submit for review**. Notes:

- First review typically takes **a few hours to a few days**; extensions with
  broad host permissions sit at the slower end.
- You will get an email on approval or rejection. Rejections name the specific
  policy section — fix and resubmit; there is no penalty.
- Choose **Public** visibility, or **Unlisted** if you want to test the store
  install flow before announcing.

**Wait until the item is approved and live before setting up automation** — the
API cannot update an item that has never been published.

### 6. API credentials for automation

You need three values so GitHub Actions can upload on your behalf: a
`clientId`, a `clientSecret`, and a `refreshToken`.

**a. Enable the API**

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create
   a project (e.g. `snap-ratio-release`).
2. **APIs & Services → Library** → search **Chrome Web Store API** → **Enable**.

**b. Configure the consent screen**

1. **APIs & Services → OAuth consent screen**.
2. User type **External**, then fill in app name and your email.
3. Add the scope `https://www.googleapis.com/auth/chromewebstore`.
4. Add your own Google account under **Test users**.
5. **Publish the app** so its status reads **In production**.

   > This step is not optional. While the consent screen is in **Testing**,
   > Google expires refresh tokens after **7 days**, and your release workflow
   > will start failing with `invalid_grant` about a week later. Publishing an
   > app that only you use does not trigger verification, because the
   > `chromewebstore` scope is not a sensitive scope.

**c. Create the OAuth client**

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Desktop app**. (Not "Web application" — desktop clients
   are what allow the loopback redirect the helper script uses.)
3. Copy the **Client ID** and **Client secret**.

**d. Mint the refresh token**

```bash
pnpm cws:token
```

It asks for the client ID, client secret and extension ID, opens the Google
consent screen, catches the redirect on `http://localhost:8818`, exchanges the
code, and prints the finished `SUBMIT_KEYS` JSON.

<details>
<summary>Manual equivalent, if you prefer not to run the script</summary>

Open this in a browser (substituting your client ID):

```
https://accounts.google.com/o/oauth2/auth?client_id=CLIENT_ID&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fchromewebstore&redirect_uri=http%3A%2F%2Flocalhost%3A8818&access_type=offline&prompt=consent
```

Approve, then copy the `code=` value out of the address bar — the page itself
will fail to load, which is expected. The code is single-use and expires in a
few minutes. Exchange it:

```bash
curl -s -X POST https://oauth2.googleapis.com/token \
  -d client_id=CLIENT_ID \
  -d client_secret=CLIENT_SECRET \
  -d code=AUTH_CODE \
  -d grant_type=authorization_code \
  -d redirect_uri=http://localhost:8818
```

Take `refresh_token` from the response. `access_type=offline` and
`prompt=consent` are what make Google return one at all.

</details>

### 7. Add the GitHub secret

**Settings → Secrets and variables → Actions → New repository secret**, named
exactly `SUBMIT_KEYS`:

```json
{
  "$schema": "https://raw.githubusercontent.com/PlasmoHQ/bpp/v3/keys.schema.json",
  "chrome": {
    "clientId": "...apps.googleusercontent.com",
    "clientSecret": "...",
    "refreshToken": "1//...",
    "extId": "abcdefghijklmnopabcdefghijklmnop"
  }
}
```

Or from the CLI:

```bash
gh secret set SUBMIT_KEYS < submit-keys.json
rm submit-keys.json   # do not commit this
```

**Verify before trusting it.** Run **Actions → Release → Run workflow** with
**dry run** ticked. It computes the next version, builds, and uploads the zip as
a workflow artifact without tagging or publishing — which confirms the pipeline
works end to end before any of it is irreversible.

---

## Part 2 — every release after that

You never touch the version number. Write conventional commits, merge to
`main`, and the pipeline does the rest.

```bash
# 1. Work on dev
git checkout dev
git commit -m "feat: add a rounded-corner option to captures"
git commit -m "fix: clamp the selection when the window is resized"
git push origin dev                       # CI runs

# 2. Merge to main -- this is the release
gh pr create --base main --head dev --title "Release" --fill
gh pr merge --merge
```

That merge triggers `release.yml`, which typechecks, format-checks, computes
`1.2.0` from the `feat:` above, writes it to `package.json`, updates
`CHANGELOG.md`, tags `v1.2.0`, creates the GitHub release, builds, and uploads
to the store.

Afterwards, pull the version-bump commit back down so `dev` does not drift:

```bash
git checkout dev
git merge main          # brings back chore(release): 1.2.0
git push origin dev
```

### Checking what would happen first

Run **Actions → Release → Run workflow** with **dry run** ticked. It computes
the next version, prints the release notes, builds, and uploads the zip as a
workflow artifact — without tagging, committing or publishing.

Locally:

```bash
GITHUB_TOKEN=$(gh auth token) pnpm exec semantic-release --dry-run --no-ci
```

Each published update is reviewed again, though later reviews are usually much
faster than the first.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `invalid_grant` in the workflow | Refresh token expired. Almost always because the OAuth consent screen is still in **Testing** — publish it (step 6b) and mint a new token with `pnpm cws:token`. |
| `Requested entity was not found` | `extId` is wrong, or the item has never been published. The API cannot touch a draft-only item. |
| `PERMISSION_DENIED` / 403 | Chrome Web Store API not enabled on the Cloud project, or you authorised with a Google account that is not the item's owner. |
| `Version number is invalid or too low` | The computed version is not greater than what is live. Usually the baseline tag is missing — see step 2. |
| Workflow exits green but publishes nothing | Either you ran it with **dry run** ticked, or there were no releasable commits (only `chore:`/`docs:`). Check the "No releasable commits" notice in the log. |
| Release fails at `@semantic-release/git` with a 403 | Branch protection is blocking the version-bump commit. Add **github-actions[bot]** to the ruleset bypass list. |
| `ENOTINHISTORY` / unexpected version computed | `fetch-depth: 0` is required so semantic-release can see the full history and tags. It is already set in `release.yml`; do not change it. |
| Released, but the store still shows the old version | Publishing succeeded and the item is in **Pending review**. The new version goes live on approval. |
| `google did not return a refresh_token` | You have already authorised this client. Revoke it at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and re-run. |
| Review rejected: "excessive permissions" | Reply with the justification table in step 4; the host permission is genuinely needed for the content-script overlay. |
| Review rejected: "does not match single purpose" | Keep the listing description focused on capturing fixed-ratio screenshots. |

### Rotating credentials

If the secret ever leaks: delete the OAuth client in Google Cloud, create a new
one, run `pnpm cws:token` again, and update `SUBMIT_KEYS`. The extension itself
is unaffected — these credentials only authorise store uploads.
