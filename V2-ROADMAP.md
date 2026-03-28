# Fairway V2 Roadmap

## Main idea

Version 2 should let a player stand on a new course, scan a physical scorecard on their phone, review the extracted details, and save that course for future rounds.

Version 2 should also introduce a true shared scorecard flow so multiple players can follow scoring during the round instead of only logging results afterwards.

## Release split

- V1 is now in maintenance mode and should only take bug fixes and security fixes.
- All new feature work should target the V2 branch and V2 storage model.
- Any V1 bug fix that affects scoring, score entry, navigation, or layout should be reviewed and carried into V2 before the V2 release is considered ready.

## UK-first assumptions

- V2 should launch around GB&I course and handicap expectations first.
- Manual course creation and scorecard review must work even if no external database is connected.
- Tee data should be rich enough to support UK use of par, course rating, slope rating, stroke indexes, and named tees.
- Handicap entry should move toward `Handicap Index in, Course/Playing Handicap out` with manual override kept for edge cases.

## Core V2 bets

- Build a reusable course library as a first-class feature.
- Add a scorecard import flow with photo capture, OCR assist, and a mandatory review step.
- Keep a blank/manual course flow as a permanent fallback.
- Treat Fairway's stored course record as the final source of truth, even when data comes from scan or lookup.

## Scorecard scanning flow

1. Open a new "Add course" flow.
2. Take a photo of the scorecard with the phone camera.
3. Run OCR on the image to detect:
   - course name
   - tee names
   - hole numbers
   - par
   - stroke index
   - yardages by tee
4. Show a review screen so the user can correct anything the scan got wrong.
5. Save the course and tee sets locally.
6. Reuse that saved course when creating later rounds.

## Product goals

- Make new courses quick to add on the phone.
- Keep manual editing simple when the scan is imperfect.
- Let one course contain multiple tee sets.
- Preserve saved courses separately from saved rounds.
- Keep imported course data reusable across future competitions.

## Planned milestone markers

### 2.5.0 - Proper handicaps

- [ ] Define the handicap model as `Handicap Index in, Course Handicap out, Playing Handicap out`.
- [ ] Convert from the selected tee using tee-specific course rating and slope rating.
- [ ] Store the tee context on each player and round so handicap output stays stable for the whole round.
- [ ] Keep a manual override for society rules, casual formats, and other edge cases.
- [ ] Show both the raw Handicap Index and the derived handicap output in setup and live scoring.
- [ ] Keep legacy direct handicap entry as a fallback until the new flow is proven.
- [ ] Make the scan/review flow capture course rating and slope rating alongside hole data.
- [ ] Review and confirm calculated handicaps before saving the round.
- [ ] Test mixed tee setups, manual overrides, and round reloads to make sure the same player gets the same result after reopen.
- [ ] Add post-round leaderboard sharing for WhatsApp so the group leaderboard and individual leaderboard can be sent straight from the app.
- [ ] Support a clean share format that works for players in the competition and for the wider rollup chat after the round.
- [ ] Let the user choose whether to share group results, individual results, or both together.
- [ ] Make the shared result readable as plain text and as a styled share card/screenshot so it still looks good inside WhatsApp.

## Suggested data model changes

- Split `Course`, `TeeSet`, and `Round` into separate concepts.
- Let rounds reference a saved course instead of always embedding one fixed default course.
- Store tee-specific yardages, ratings, and slope values independently.
- Keep a per-hole structure that supports imported names, pars, and stroke indexes.
- Leave room for tee-specific rating profiles so a tee can support multiple handicap-calculation contexts later.
- Version the storage schema separately from V1 so migration can happen once and V1 data can stay untouched as backup.

## Likely V2 screens

- Course library
- Add course
- Camera scan
- OCR review and correction
- Tee setup
- Start round from saved course
- Shared scorecard
- Live round view

## Shared scorecard flow

1. Create a round from a saved course.
2. Open a shared scorecard that shows every player across all holes.
3. Let scores be entered hole by hole while the round is in progress.
4. Recalculate player and group totals as each score is added.
5. Keep the current ghost-player rule visible for mixed 3-ball and 4-ball fields.
6. Save the finished round back into the round history when play ends.

## Shared scorecard goals

- Make V2 feel clearly different from V1's post-round score logging.
- Show one shared card instead of switching between separate views to understand the state of the round.
- Let the scorer move quickly across players on the same hole.
- Keep group totals, individual totals, and ghost-player context visible during play.
- Preserve the same rollup scoring rules already validated in V1.

## Technical notes

- Camera capture could use Expo camera support in a future version.
- OCR could be done on-device or via a service, depending on speed and accuracy.
- The scan result should never be trusted blindly; always include a confirmation step.
- Some scorecards have unusual layouts, so the importer should allow partial/manual completion.
- A clean fallback is important: users should still be able to create a course by hand.
- The shared scorecard should probably be built around a grid or matrix layout with sticky player and hole labels.
- V2 should decide whether shared scoring is single-device only first, or whether multi-device sync is in scope.
- Live entry should avoid copying the V1 screen structure too closely so the two versions feel intentionally different.
- A separate V2 local storage file should coexist with the V1 storage file so migration can be tested safely.

## V1 decisions to keep compatible with V2

- Avoid hardcoding the app around one course only.
- Keep scoring logic separate from course-definition logic.
- Keep tee selection flexible per player.
- Prefer reusable helpers around holes, tees, and rounds so imported courses can slot in later.
- Keep the V1 ghost-player logic reusable so V2 can show the same mixed-field scoring rule inside the shared scorecard.

## Nice-to-have V2 ideas

- Save a photo of the original scorecard with the course record.
- Share courses between devices.
- Export and import course libraries.
- Detect whether the card is front/back nine or full 18.
- Suggest hole names and structure from previous scans of the same club.
