# Personal fork runbook (ChristopheAwad/opencode)

This file lives on the `insecure-combined` branch only. It documents how the
personal fork is built, installed, and run side by side with the official
release. It must never be merged into the upstream project.

## The one rule

The fork binary lives in its OWN folder and runs with a RELATIVE path.
It never goes into `~/.opencode/bin`, where the official release lives.
That is how the two can never overwrite each other.

- Fork: `~/Downloads/opencode-test/opencode`, run as `./opencode`
- Official: `~/.opencode/bin/opencode`, run as `opencode`

## Branches

| Branch | Purpose | CI build? |
| --- | --- | --- |
| `dev` | Clean base, tracks upstream. Never put fixes here directly. | No |
| `code-copy-fallback` | Single fix: code-block copy on insecure origins. Kept clean for a future upstream pull request. | No |
| `insecure-attach` | Single fix: image attachments on insecure origins. | No |
| `insecure-attach-fix` | Old single-fix line from the first session. Superseded by `insecure-combined`. | Yes (old) |
| `insecure-combined` | Personal mix: both fixes plus the CI workflow, the installer, and this file. The only branch that builds. | Yes |

## How a fix flows

1. Create a fix branch from `dev` (short hyphenated name, no slashes).
2. Commit only that fix there.
3. Merge the fix branch into `insecure-combined`.
4. Push `insecure-combined`. CI builds and uploads the new binary automatically.
5. Update with the installer command below. Never copy a binary into `~/.opencode/bin` by hand.

To add a third fix later: new clean branch from `dev`, merge it into
`insecure-combined`, push, re-run the installer. If `insecure-combined`
ever gets messy, delete it and remake it by merging the clean fix branches.

## Install / update the fork

Re-run any time to get the newest CI build:

```sh
curl -fsSL https://raw.githubusercontent.com/ChristopheAwad/opencode/insecure-combined/install-fork | bash
```

This downloads the `personal-latest` release asset into
`~/Downloads/opencode-test/opencode` and leaves `~/.opencode/bin` alone.

## Run side by side

Fork (from its own folder):

```sh
cd ~/Downloads/opencode-test && ./opencode web --hostname 0.0.0.0
```

Official (from anywhere else):

```sh
cd ~/Documents/code && opencode web --hostname 0.0.0.0
```

Check which is which:

```sh
~/Downloads/opencode-test/opencode --version  # fork, e.g. 1.18.35
~/.opencode/bin/opencode --version            # official, e.g. 1.18.34
```

If a running server's binary file shows as `(deleted)` in
`/proc/<pid>/exe`, that server is running pre-replacement code from memory.
It is safe, but restart it to pick up the current file.

## Shared history warning

The CI build sets `OPENCODE_CHANNEL=latest`, so the fork shares the main
`opencode.db` history file with the official release on purpose. Run only
ONE server at a time. Two servers writing to the same database file can
lock or corrupt it. Stop one before starting the other.

## Android APK signing

- CI signs the APK with one stable debug key stored in the repository secret
  `ANDROID_DEBUG_KEYSTORE_BASE64`. Never delete or rotate it: Android rejects
  updates when the signing key changes.
- CI sets `ANDROID_VERSION_CODE` to the workflow run number, so each build is
  newer than the last. A `Verify APK signature` step fails the job if the
  stable key was not used.
- One-time transition: APKs published before 2026-10-08 used a random key
  generated fresh on each runner. The first install of a stable-key APK needs
  a full uninstall. After that, updates install over the app.

## CI rebuilds

Pushing `insecure-combined` triggers `.github/workflows/personal-build.yml`:
runs both insecure-origin test suites, builds the Linux x64 binary, and
re-uploads it to the `personal-latest` release. A normal run takes ~2 minutes.
The workflow refuses to run anywhere except the `ChristopheAwad/opencode`
repository (job guard), so upstream is never affected.
