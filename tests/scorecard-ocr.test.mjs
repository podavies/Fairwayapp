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
