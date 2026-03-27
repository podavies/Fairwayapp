import assert from "node:assert/strict";
import test from "node:test";

import {
  extractScorecardHoleSuggestions,
  extractScorecardNameSuggestions,
  extractScorecardOcrHints,
} from "../src/scorecardOcrParsing.ts";

const sampleResult = {
  platform: "ios-vision",
  fullText: [
    "Missfits Golf Club",
    "White CR 70.7 Slope 125",
    "1 2 3 4 5 6 7 8 9",
    "279 199 536 343 328 165 407 341 421",
    "4 3 5 4 4 3 4 4 4",
    "12 8 6 18 10 16 2 14 4",
    "10 11 12 13 14 15 16 17 18",
    "169 413 323 349 195 410 425 534 395",
    "3 4 4 4 3 4 4 5 4",
    "15 3 17 7 11 1 5 13 9",
  ].join("\n"),
  lines: [
    { text: "Missfits Golf Club", confidence: 0.99, bounds: null, candidates: ["Missfits Golf Club"] },
    { text: "White CR 70.7 Slope 125", confidence: 0.96, bounds: null, candidates: ["White CR 70.7 Slope 125"] },
    { text: "1 2 3 4 5 6 7 8 9", confidence: 0.97, bounds: null, candidates: ["1 2 3 4 5 6 7 8 9"] },
    { text: "279 199 536 343 328 165 407 341 421", confidence: 0.98, bounds: null, candidates: ["279 199 536 343 328 165 407 341 421"] },
    { text: "4 3 5 4 4 3 4 4 4", confidence: 0.98, bounds: null, candidates: ["4 3 5 4 4 3 4 4 4"] },
    { text: "12 8 6 18 10 16 2 14 4", confidence: 0.97, bounds: null, candidates: ["12 8 6 18 10 16 2 14 4"] },
    { text: "10 11 12 13 14 15 16 17 18", confidence: 0.96, bounds: null, candidates: ["10 11 12 13 14 15 16 17 18"] },
    { text: "169 413 323 349 195 410 425 534 395", confidence: 0.97, bounds: null, candidates: ["169 413 323 349 195 410 425 534 395"] },
    { text: "3 4 4 4 3 4 4 5 4", confidence: 0.97, bounds: null, candidates: ["3 4 4 4 3 4 4 5 4"] },
    { text: "15 3 17 7 11 1 5 13 9", confidence: 0.96, bounds: null, candidates: ["15 3 17 7 11 1 5 13 9"] },
  ],
};

const labelledScorecardResult = {
  platform: "ios-vision",
  fullText: [
    "Missfits Links",
    "Yellow 69.8 121",
    "Hole 1 2 3 4 5 6 7 8 9 Out",
    "Yds 391 174 512 328 365 148 407 334 421 3080",
    "Par 4 3 5 4 4 3 4 4 4 35",
    "S.I. 7 15 3 13 1 17 5 11 9",
    "Hole 10 11 12 13 14 15 16 17 18 In",
    "Yards 167 401 322 348 190 409 424 530 394 3185",
    "Par 3 4 4 4 3 4 4 5 4 35",
    "Stroke Index 16 4 18 8 12 2 6 14 10",
  ].join("\n"),
  lines: [
    { text: "Missfits Links", confidence: 0.99, bounds: null, candidates: ["Missfits Links"] },
    { text: "Yellow 69.8 121", confidence: 0.95, bounds: null, candidates: ["Yellow 69.8 121"] },
    { text: "Hole 1 2 3 4 5 6 7 8 9 Out", confidence: 0.94, bounds: null, candidates: ["Hole 1 2 3 4 5 6 7 8 9 Out"] },
    { text: "Yds 391 174 512 328 365 148 407 334 421 3080", confidence: 0.94, bounds: null, candidates: ["Yds 391 174 512 328 365 148 407 334 421 3080"] },
    { text: "Par 4 3 5 4 4 3 4 4 4 35", confidence: 0.94, bounds: null, candidates: ["Par 4 3 5 4 4 3 4 4 4 35"] },
    { text: "S.I. 7 15 3 13 1 17 5 11 9", confidence: 0.93, bounds: null, candidates: ["S.I. 7 15 3 13 1 17 5 11 9"] },
    { text: "Hole 10 11 12 13 14 15 16 17 18 In", confidence: 0.94, bounds: null, candidates: ["Hole 10 11 12 13 14 15 16 17 18 In"] },
    { text: "Yards 167 401 322 348 190 409 424 530 394 3185", confidence: 0.94, bounds: null, candidates: ["Yards 167 401 322 348 190 409 424 530 394 3185"] },
    { text: "Par 3 4 4 4 3 4 4 5 4 35", confidence: 0.94, bounds: null, candidates: ["Par 3 4 4 4 3 4 4 5 4 35"] },
    { text: "Stroke Index 16 4 18 8 12 2 6 14 10", confidence: 0.93, bounds: null, candidates: ["Stroke Index 16 4 18 8 12 2 6 14 10"] },
  ],
};

test("scorecard OCR hints pull course rating and slope candidates", () => {
  assert.deepEqual(extractScorecardOcrHints(sampleResult), {
    courseRatingCandidates: ["70.7"],
    slopeRatingCandidates: ["125"],
  });
});

test("scorecard OCR names pull course and tee candidates", () => {
  assert.deepEqual(extractScorecardNameSuggestions(sampleResult), {
    courseNameCandidates: ["Missfits Golf Club"],
    teeNameCandidates: ["White"],
  });
});

test("scorecard OCR hole suggestions map front and back nine rows", () => {
  const parsed = extractScorecardHoleSuggestions(sampleResult);

  assert.equal(parsed.holes.length, 18);
  assert.equal(parsed.yardageCount, 18);
  assert.equal(parsed.parCount, 18);
  assert.equal(parsed.strokeIndexCount, 18);

  assert.deepEqual(parsed.holes[0], {
    number: 1,
    yardage: 279,
    par: 4,
    strokeIndex: 12,
  });

  assert.deepEqual(parsed.holes[17], {
    number: 18,
    yardage: 395,
    par: 4,
    strokeIndex: 9,
  });
});

test("scorecard OCR handles labelled rows, totals, and unlabeled rating/slope pairs", () => {
  assert.deepEqual(extractScorecardOcrHints(labelledScorecardResult), {
    courseRatingCandidates: ["69.8"],
    slopeRatingCandidates: ["121"],
  });

  assert.deepEqual(extractScorecardNameSuggestions(labelledScorecardResult), {
    courseNameCandidates: ["Missfits Links"],
    teeNameCandidates: ["Yellow"],
  });

  const parsed = extractScorecardHoleSuggestions(labelledScorecardResult);

  assert.equal(parsed.holes.length, 18);
  assert.equal(parsed.yardageCount, 18);
  assert.equal(parsed.parCount, 18);
  assert.equal(parsed.strokeIndexCount, 18);

  assert.deepEqual(parsed.holes[0], {
    number: 1,
    yardage: 391,
    par: 4,
    strokeIndex: 7,
  });

  assert.deepEqual(parsed.holes[17], {
    number: 18,
    yardage: 394,
    par: 4,
    strokeIndex: 10,
  });
});
