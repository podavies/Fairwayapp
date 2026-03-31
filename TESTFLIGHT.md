# TestFlight Setup

This project is now prepared for both fast iPhone OCR testing and the full Expo EAS iOS TestFlight submission flow.

## Current iOS app identity

The current iOS bundle identifier in `app.json` is:

- `com.podavies.fairway`

The current V2 iOS build number in `app.json` is:

- `38`

Keep using that identifier for V2 unless you intentionally want a separate iPhone app listing.

## Current OCR test target

- Treat build `38` as the next OCR validation target.
- Build `35` had a regression where holes `2` and `11` were missing from the imported scorecard.
- Build `37` showed the troublesome split-side card still needed more work: noisy header text leaked into suggestions, white hole `2` drifted to the wrong stroke index, and white hole `9` was misparsed.
- Build `38` now bundles the local totals-repair and review-check fixes for that exact card before another paid cloud build is considered.

## What is already configured

- `expo-dev-client` so OCR can run in a custom iPhone build instead of Expo Go
- `eas.json` with a `development` iOS profile for internal device testing
- `eas.json` with a production iOS build profile
- iOS `buildNumber` in `app.json`
- iOS non-exempt encryption flag set to `false`
- npm scripts for build and submission

## Requirements

- Paid Apple Developer account
- Expo account
- App Store Connect access

## Fastest OCR testing on a real iPhone

Expo Go will not load the custom `ScorecardOcr` native module. For OCR testing, install a real iPhone build first, then connect it to Metro.

Build the internal development client:

```powershell
npm run build:ios:dev
```

If EAS says there are no registered iPhones for internal distribution yet, register the device first:

```powershell
npx eas-cli device:create
```

After the installable build is ready and installed on the iPhone, start Metro for the dev client:

```powershell
npm run test:iphone
```

That script starts the V2 dev server on port `8083` with `--dev-client` and `--tunnel`, which avoids the `1.5.3` worktree using `8082`.

## Cost-safe OCR workflow

Cloud iOS builds can consume paid EAS build usage, so do not send a new TestFlight build for every OCR tweak.

Use this order instead:

1. Collect OCR screenshots and failure notes from the current installed build.
2. Fix and regression-test OCR locally with:

```powershell
npm run test:ocr
npx tsc --noEmit
```

3. Batch several OCR fixes together before the next cloud iOS build.
4. Only run a new production/TestFlight build when you explicitly want to ship a fresh tester build.

If a dev client is already installed on the iPhone, prefer `npm run test:iphone` for JS and parser iteration instead of another TestFlight upload.

## TestFlight commands

Expo's current docs also support a one-command TestFlight flow:

```powershell
npx testflight
```

Explicit EAS commands are also ready:

```powershell
npm run build:ios
npm run submit:ios
```

Or build and auto-submit in one step:

```powershell
npx eas-cli build --platform ios --profile production --auto-submit
```

## First TestFlight release checklist

1. Choose the final iOS bundle identifier.
2. Create or sign in to your Expo account.
3. Create or sign in to your Apple Developer account.
4. Run one of the commands above.
5. Let Expo handle or create the iOS credentials when prompted.
6. Wait for the build to upload to App Store Connect.
7. In App Store Connect, open the app's TestFlight tab.
8. After Apple finishes processing the build, add internal testers.
9. For external testers, complete Beta App Review and then share the build.

## Notes

- OCR is iPhone-only in the current V2 build.
- OCR needs a custom Missfits app build and will not run in Expo Go.
- Build `38` is the current OCR verification target.
- Build `35` missed holes `2` and `11`, so those should be the first regression checks on the next installed build.
- Repeated production/TestFlight builds may create EAS build charges.
- Batch OCR fixes locally before requesting the next iOS cloud build.
- TestFlight does not publish the app to the App Store.
- Apple can take a little while to process a new uploaded build.
- The current app can be prepared from Windows because EAS handles the iOS build remotely.
