# Fairway

Cross-platform golf mobile app starter for iOS and Android using Expo and React Native.

## Version 1.2.3

- Added a reusable course library so course and tee setups can be saved and loaded into later rounds.
- Fixed tee editing so tee names can be cleared while typing instead of snapping back.
- Group score entry keeps each group on its own hole, with swipe navigation and automatic next-hole advance.
- Player score entry follows group order and supports swipe navigation between players.
- Score inputs now allow two-digit values for higher gross scores when needed.

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
