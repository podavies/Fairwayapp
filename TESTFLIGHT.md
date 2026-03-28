# TestFlight Setup

This project is now prepared for an Expo EAS iOS build and TestFlight submission flow.

## App identity

This patch line is already configured with the live iOS app identity in `app.json`:

- Bundle identifier: `com.podavies.fairway`
- App Store Connect app id: `6761051666`
- Planned patch build: `1.5.3 (20)`

Keep that bundle identifier unchanged for `1.5.3` builds so they continue to land in the existing Fairway TestFlight app.

## What is already configured

- `eas.json` with a production iOS build profile
- iOS `buildNumber` in `app.json`
- iOS non-exempt encryption flag set to `false`
- npm scripts for build and submission
- Existing Expo project: `@podavies/fairway-mobile`

## Requirements

- Paid Apple Developer account
- Expo account
- App Store Connect access

## Recommended commands

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

For local Expo Go testing on the same Wi-Fi before sending a store build, use:

```powershell
npx expo start --lan --clear --port 8082
```

## First TestFlight release checklist

1. Sign in to the Expo account that owns `@podavies/fairway-mobile`.
2. Sign in to the matching Apple Developer account.
3. Confirm `app.json` still points at `com.podavies.fairway` and the next build number.
4. Run one of the commands above.
5. Let Expo handle or reuse the iOS credentials when prompted.
6. Wait for the build to upload to App Store Connect.
7. In App Store Connect, open the app's TestFlight tab.
8. After Apple finishes processing the build, add internal testers.
9. For external testers, complete Beta App Review and then share the build.

## Notes

- TestFlight does not publish the app to the App Store.
- Apple can take a little while to process a new uploaded build.
- The current app can be prepared from Windows because EAS handles the iOS build remotely.
