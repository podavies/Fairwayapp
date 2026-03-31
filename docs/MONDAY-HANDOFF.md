# Monday Handoff

Last updated: 31 March 2026

## Current state

- `1.5.3` is live on the iOS App Store.
- `1.5.3` is now maintenance-only and should receive bug fixes only.
- V2 is `2.0.0`.
- `app.json` is now set to iOS build `38` for the next bundled OCR validation pass.
- Build `35` exposed an OCR regression where holes `2` and `11` were missing from the imported card.
- Build `37` exposed the remaining split-side OCR problems on the troublesome shared white/yellow/red card before the final local fixes below.
- V2 branch: `codex/2.0-carryover-fixes`
- Latest GitHub-pushed V2 commit before this OCR batch: `37f15ff` (`chore: prepare v2 ios device testing`)

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
- Bumped the V2 iOS build number to `38`.
- Hardened scorecard OCR parsing for row-based, split-side, and bounded-cell OCR output.
- Tightened the OCR review flow so incomplete imports do not silently keep scaffold defaults.
- Added card-specific OCR handling for the shared white/yellow/red layout that also carries separate ladies ratings and ladies par overrides.
- Added totals-based split-side repair so white hole `2`, white hole `9`, and the ladies overlays recover correctly on the troublesome card.
- Added review-screen checks that flag missing holes, duplicate stroke indexes, and aggregate total mismatches before applying OCR.
- Filtered scorecard header/form noise so labels like `Please indicate which tee used` no longer become course or tee suggestions.

## TestFlight status

- Last confirmed processed/uploaded TestFlight submission in these notes was build `21`.
- Build ID for that earlier upload: `fc18a1df-5859-4e28-aa6b-ecb1afd0f7e2`
- Submission ID for that earlier upload: `38ae1825-02a3-4199-882b-7b6fe10351fe`
- Apple accepted that upload and began processing on 28 March 2026.
- Current OCR regression-testing target is build `38`, bundling the local fixes discovered after checking build `37`.

## Important rules from here

- Keep `1.5.3` for bug fixes only.
- Put all new feature work into V2.
- OCR testing must use a real iPhone build. Expo Go does not support the custom OCR module.
- Do not send repeated paid TestFlight builds for single OCR tweaks. Batch OCR fixes locally first and only ship a new cloud iOS build when explicitly requested.

## Best next steps on Monday

1. Install and test V2 build `2.0.0 (38)` on a real iPhone.
2. Verify both scorecard photo import and live camera capture.
3. Specifically confirm holes `2` and `11` now appear in the OCR import and review flow.
4. Confirm the split-side card can distinguish `Yellow Men`, `Yellow Ladies`, and `Red Ladies`, including ladies par overrides on holes `5` and `14`.
5. Re-check the troublesome white tee path so hole `2` stays `413 / Par 4 / SI 4` and hole `9` stays `371 / Par 4 / SI 10`.
6. Batch any further OCR fixes locally before requesting another cloud iOS build.
7. Touch `1.5.3` only if a genuine production bug appears.

## Useful commands

```powershell
git status
npm run test:iphone
npm run test:ocr
npx tsc --noEmit
npm run build:ios:dev
npm run build:ios
npm run submit:ios
```

## If internal iPhone builds are needed

If EAS says there are no registered iPhones for internal distribution:

```powershell
npx eas-cli device:create
```
