# Fairway V2 Roadmap

## Main idea

Version 2 should let a player stand on a new course, scan a physical scorecard on their phone, review the extracted details, and save that course for future rounds.

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

## Technical notes

- Camera capture could use Expo camera support in a future version.
- OCR could be done on-device or via a service, depending on speed and accuracy.
- The scan result should never be trusted blindly; always include a confirmation step.
- Some scorecards have unusual layouts, so the importer should allow partial/manual completion.
- A clean fallback is important: users should still be able to create a course by hand.

## V1 decisions to keep compatible with V2

- Avoid hardcoding the app around one course only.
- Keep scoring logic separate from course-definition logic.
- Keep tee selection flexible per player.
- Prefer reusable helpers around holes, tees, and rounds so imported courses can slot in later.

## Nice-to-have V2 ideas

- Save a photo of the original scorecard with the course record.
- Share courses between devices.
- Export and import course libraries.
- Detect whether the card is front/back nine or full 18.
- Suggest hole names and structure from previous scans of the same club.
