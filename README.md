# Fairway

Cross-platform golf mobile app starter for iOS and Android using Expo and React Native.

## Version 1.5.2

- Added stronger live score entry flows for both `By group` and `By player`.
- Restored one-tap single-digit score entry in both scoring modes.
- Improved score correction while the keyboard is open so earlier holes are easier to revisit.
- Reduced scroll conflicts during player score entry.

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for the current release notes.

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
