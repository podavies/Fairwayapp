# Fairway

Cross-platform golf mobile app starter for iOS and Android using Expo and React Native.

## Version 1.2.2

- Group score entry now keeps each group on its own hole instead of jumping straight to the next group.
- Swipe left or right on a group card to move that group between holes during live entry.
- After the last player score is entered for a group, that group now advances to the next hole automatically.
- Each group card shows its own `Hole X of 18` status to make live scoring clearer.

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
