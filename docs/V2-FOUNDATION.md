# Fairway V2 Foundation

## Purpose

This note sets the starting point for V2 work so V1 can stay stable.

## Current product split

- V1: bug fixes and security fixes only.
- V2: all new feature work, data model changes, and import/scan work.

## Git setup

- Current maintenance line grew out of `codex/1.2.1`.
- V2 foundation work now starts on `codex/v2-foundation`.
- When V2 grows beyond experiments, create a long-lived shared branch such as `codex/v2`.

## Storage strategy

- Keep the V1 storage file untouched as a safe backup:
  - `rollup-rounds.json`
- Start V2 on a separate storage file:
  - `fairway-v2.json`
- V2 storage should carry a schema version and support one-time migration from V1.
- Migration should copy data forward, never rewrite the V1 file.

## UK-first V2 direction

- Manual course creation must always exist.
- Scorecard scan/import should help build a course, not silently create one without review.
- Tee metadata should support:
  - tee name
  - hole names
  - yardages
  - par
  - stroke index
  - course rating
  - slope rating
- Player handicap flow should move toward:
  - enter Handicap Index
  - choose tee
  - calculate Course Handicap / Playing Handicap
  - keep manual override

## Initial V2 workstreams

1. Define the V2 data model for courses, tees, rounds, players, and import drafts.
2. Build migration helpers from V1 storage to V2 storage.
3. Build a proper course library UI around the V2 model.
4. Add blank course creation and tee-copy helpers.
5. Add scorecard import with review.
6. Add Handicap Index-based calculation.

## Tomorrow's starting point

1. Finalize the V2 data model in `src/v2/types.ts`.
2. Decide what the first V2 screen should be:
   - course library
   - add course
   - or migration/bootstrap
3. Wire a minimal V2 storage bootstrap into the app behind a V2 entry point or feature flag.

## Non-goals for this foundation step

- No V1 scoring behavior changes.
- No forced storage migration yet.
- No OCR implementation yet.
- No external course database dependency yet.
