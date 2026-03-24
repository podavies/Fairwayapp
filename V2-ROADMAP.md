# Fairway V2 Roadmap

## Main idea

Version 2 should let a player stand on a new course, scan a physical scorecard on their phone, review the extracted details, and save that course for future rounds.

Version 2 should also introduce a true shared scorecard flow so multiple players can follow scoring during the round instead of only logging results afterwards.

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

## Suggested data model changes

- Split `Course`, `TeeSet`, and `Round` into separate concepts.
- Let rounds reference a saved course instead of always embedding one fixed default course.
- Store tee-specific yardages, ratings, and slope values independently.
- Keep a per-hole structure that supports imported names, pars, and stroke indexes.

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
