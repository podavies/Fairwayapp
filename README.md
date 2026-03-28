# Fairway

Cross-platform golf mobile app starter for iOS and Android using Expo and React Native.

## Version 1.5.3

- Updated the app icon and colour palette to match the V2 direction.
- Fixed group score entry so the next hole starts back on the first player.
- Moved player running totals into a clearer position during score entry.
- Added a front-nine total card in player-by-player entry after hole 9.
- Restyled the Round Details actions so `Log scores` stands out as the primary action.

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

For a fresh iPhone test session that clears stale Expo listeners and starts a new Expo Go session on port `8082`, run:

```powershell
npm run test:iphone
```

If the tunnel provider is unavailable, you can fall back to LAN mode:

```powershell
npx expo start --lan --clear --port 8082
```

## Next build steps

- Add navigation and separate screens
- Persist rounds and golfer profile locally
- Add shot tracking, GPS distances, and club stats
- Connect authentication and cloud sync
