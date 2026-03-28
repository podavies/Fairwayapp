# Monday Handoff

Last updated: 28 March 2026

## Current state

- `1.5.3` is live on the iOS App Store.
- `1.5.3` is now maintenance-only and should receive bug fixes only.
- V2 is `2.0.0` and has been submitted to TestFlight as build `21`.
- V2 branch: `codex/2.0-carryover-fixes`
- V2 Git commit pushed to GitHub: `37f15ff` (`chore: prepare v2 ios device testing`)

## Project folders

- V2 repo: `C:\Users\podav\Documents\missfits-rollup-golf-calculator`
- `1.5.3` worktree: `C:\Users\podav\Documents\missfits-rollup-golf-calculator-1.5.3`
- `C:\Users\podav\Documents\New project` is a junction to the V2 repo so Codex restarts land in the right place.

## What changed for V2

- Added `expo-dev-client` so OCR can run in a custom iPhone build instead of Expo Go.
- Added an EAS `development` profile for internal iPhone testing.
- Added `start:dev-client`, `build:ios:dev`, and `build:ios:preview` scripts.
- Updated the iPhone test script to use `--dev-client` on port `8083`.
- Updated TestFlight/device-testing notes.
- Bumped V2 iOS build number to `21`.

## TestFlight status

- Build ID: `fc18a1df-5859-4e28-aa6b-ecb1afd0f7e2`
- Submission ID: `38ae1825-02a3-4199-882b-7b6fe10351fe`
- Apple accepted the upload and began processing on 28 March 2026.

## Important rules from here

- Keep `1.5.3` for bug fixes only.
- Put all new feature work into V2.
- OCR testing must use a real iPhone build. Expo Go does not support the custom OCR module.

## Best next steps on Monday

1. Check whether TestFlight build `2.0.0 (21)` has finished Apple processing.
2. Install V2 on a real iPhone and test the OCR flow.
3. Test both scorecard photo import and live camera capture.
4. Fix any OCR or review-flow issues on V2 only.
5. Touch `1.5.3` only if a genuine production bug appears.

## Useful commands

```powershell
git status
npm run test:iphone
npm run build:ios:dev
npm run build:ios
npm run submit:ios
```

## If internal iPhone builds are needed

If EAS says there are no registered iPhones for internal distribution:

```powershell
npx eas-cli device:create
```
