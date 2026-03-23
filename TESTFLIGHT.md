# TestFlight Setup

This project is now prepared for an Expo EAS iOS build and TestFlight submission flow.

## Important first edit

Before the first real iOS build, replace the placeholder bundle identifier in `app.json`:

- Current placeholder: `com.example.fairway`
- Change it to your final iPhone app id, for example `com.yourname.fairway`

That identifier becomes the iOS app identity in App Store Connect, so it should be chosen carefully.

## What is already configured

- `eas.json` with a production iOS build profile
- iOS `buildNumber` in `app.json`
- iOS non-exempt encryption flag set to `false`
- npm scripts for build and submission

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

- TestFlight does not publish the app to the App Store.
- Apple can take a little while to process a new uploaded build.
- The current app can be prepared from Windows because EAS handles the iOS build remotely.
