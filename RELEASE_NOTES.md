# Fairway Release Notes

## Version 1.5.3

Released: 28 March 2026

### What's new

- Updated the app icon and in-app colour palette to match the V2 direction.
- Fixed group score entry so moving to the next hole puts the cursor back on the first player.
- Moved player running totals out of the bottom overlay so they are easier to see while entering scores.
- Added a visible front-nine total in player-by-player score entry as soon as hole 9 is complete.
- Restyled the Round Details actions so `Log scores` and `Start new blank round` no longer look like a selected toggle.
- Prepared the patch as iOS build `20` for TestFlight.

### App Store copy

Fairway 1.5.3 refreshes the app look and smooths live scoring.

- New icon and updated in-app colours inspired by V2
- Group score entry now starts the next hole on the first player
- Player score entry shows clearer running totals, including the front nine after hole 9

### What to test

- Confirm the updated app icon appears after installing the new build.
- Enter a full group hole and check the next hole starts with the top player focused.
- Enter player-by-player scores and make sure the running totals stay visible without fighting the bottom of the screen.
- Complete hole 9 in player-by-player entry and confirm the front-nine total appears straight away.
- Open Round Details and check `Log scores` reads as the primary action while `Start new blank round` reads as a secondary action.
- Check `Blob` scoring and totals still behave normally after edits.

## Version 1.5.2

Released: 27 March 2026

### What's new

- Restored one-tap single-digit score entry in both `By group` and `By player` score entry.
- Improved the score-correction flow so earlier holes are easier to revisit while the keyboard is open.
- Reduced scroll conflicts between the main page and the player score list during live score entry.
- Shipped the release as iOS build `17` for TestFlight.

### App Store copy

Fairway 1.5.2 makes live scoring smoother.

- Single-tap single-digit score entry is back in both group and player modes
- It is easier to scroll back and correct earlier holes while the keyboard is open
- Player score entry now has smoother scrolling during live edits

### What to test

- Enter scores in both `By group` and `By player`.
- Confirm a single digit advances straight to the next score field.
- With the keyboard open, scroll back to an earlier hole and correct a score.
- Check that `Blob` scoring and points totals still behave normally after edits.
