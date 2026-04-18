# Fairway

Cross-platform golf mobile app starter for iOS and Android using Expo and React Native.

## Version 1.5.4

- Fixed mixed-field ghost scoring so a 3-ball cannot double-count one of its own players.
- Restored two-digit gross score entry in both score-entry modes while keeping quick single-digit advance.
- Fixed round dates so saved and displayed dates stay on the local calendar day.
- Reduced local save churn while editing rounds and course setup.

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
