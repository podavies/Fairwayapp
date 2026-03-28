# TestFlight Setup

This project is now prepared for both fast iPhone OCR testing and the full Expo EAS iOS TestFlight submission flow.

## Current iOS app identity

The current iOS bundle identifier in `app.json` is:

- `com.podavies.fairway`

Keep using that identifier for V2 unless you intentionally want a separate iPhone app listing.

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
- TestFlight does not publish the app to the App Store.
- Apple can take a little while to process a new uploaded build.
- The current app can be prepared from Windows because EAS handles the iOS build remotely.
