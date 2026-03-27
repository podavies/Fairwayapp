# Missfits Rollup Golf Calculator

Cross-platform golf mobile app starter for iOS and Android using Expo and React Native.

## Version 1.5.2

- Added stronger live score entry flows for both `By group` and `By player`.
- Restored one-tap single-digit score entry in both scoring modes.
- Improved score correction while the keyboard is open so earlier holes are easier to revisit.
- Reduced scroll conflicts during player score entry.

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for the current release notes.

## Branch Strategy

- `1.0.0` is the live maintenance branch and should receive bug fixes for the shipped app.
- `2.0.0` is reserved for future V2 development work.
- Keep release fixes and V2 feature work separate so the live app can ship independently.

## MVP included

- Hero dashboard with golfer profile summary
- Live round score tracking preview
- Trend cards for handicap and performance
- Recent rounds list

## Run locally

```powershell
npm install
npm run start
```

Then open the Expo app on iOS or Android, or run:

```powershell
npm run ios
npm run android
```

For a fresh iPhone test session that clears stale Expo listeners and starts a new tunnel on port `8082`, run:

```powershell
npm run test:iphone
```

## Next build steps

- Add navigation and separate screens
- Persist rounds and golfer profile locally
- Add shot tracking, GPS distances, and club stats
- Connect authentication and cloud sync
