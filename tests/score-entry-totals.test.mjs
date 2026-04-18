import assert from "node:assert/strict";
import test from "node:test";

import { BLOB_SCORE, buildScoreEntryRunningTotals } from "../src/scoring.ts";

const fallbackCourse = [
  { number: 1, name: "Home", yardage: 350, par: 4, strokeIndex: 1 },
  { number: 2, name: "Pond", yardage: 170, par: 3, strokeIndex: 10 },
  { number: 3, name: "Oaks", yardage: 510, par: 5, strokeIndex: 18 },
];

const tees = [
  {
    id: "white",
    name: "White",
    courseRating: 70.7,
    slopeRating: 125,
    course: fallbackCourse,
  },
];

const fullCourse = Array.from({ length: 18 }, (_, index) => ({
  number: index + 1,
  name: `Hole ${index + 1}`,
  yardage: 300 + index * 10,
  par: 4,
  strokeIndex: index + 1,
}));

test("running totals are derived from scores, not stale cached player totals", () => {
  const player = {
    handicap: 18,
    teeId: "white",
    scores: {
      1: "5",
      2: BLOB_SCORE,
      3: "5",
    },
    total: 99,
    done: 99,
  };

  assert.deepEqual(buildScoreEntryRunningTotals(player, tees, fallbackCourse), {
    shots: 10,
    points: 5,
    grossLogged: 2,
    holesLogged: 3,
    frontNine: null,
  });
});

test("running totals fall back to the default course and ignore blank scores", () => {
  const player = {
    handicap: 0,
    teeId: "missing",
    scores: {
      1: "4",
      2: "3",
      3: "",
    },
  };

  assert.deepEqual(buildScoreEntryRunningTotals(player, [], fallbackCourse), {
    shots: 7,
    points: 4,
    grossLogged: 2,
    holesLogged: 2,
    frontNine: null,
  });
});

test("front nine totals appear once the first nine holes are recorded", () => {
  const player = {
    handicap: 0,
    teeId: "white",
    scores: Object.fromEntries(
      fullCourse.map((hole) => [hole.number, hole.number <= 9 ? "4" : ""]),
    ),
  };

  assert.deepEqual(
    buildScoreEntryRunningTotals(
      player,
      [
        {
          id: "white",
          name: "White",
          courseRating: 70.7,
          slopeRating: 125,
          course: fullCourse,
        },
      ],
      fullCourse,
    ),
    {
      shots: 36,
      points: 18,
      grossLogged: 9,
      holesLogged: 9,
      frontNine: {
        shots: 36,
        points: 18,
        grossLogged: 9,
        holesLogged: 9,
      },
    },
  );
});
