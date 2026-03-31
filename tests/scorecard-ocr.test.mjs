import assert from "node:assert/strict";
import test from "node:test";

import {
  extractScorecardHoleSuggestions,
  extractScorecardNameSuggestions,
  extractScorecardOcrHints,
} from "../src/scorecardOcrParsing.ts";

function boundedCell(text, x, y, width = 0.04, height = 0.02) {
  return {
    text,
    confidence: 0.93,
    bounds: { x, y, width, height },
    candidates: [text],
  };
}

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

const noisyRepeatedRowsResult = {
  platform: "ios-vision",
  fullText: [
    "Noisy Club",
    "1 2 3 4 5 6 7 8 9",
    "391 391 391 391 391 391 391 391 391",
    "4 4 4 4 4 4 4 4 4",
    "1 2 3 4 5 6 7 8 9",
  ].join("\n"),
  lines: [
    { text: "Noisy Club", confidence: 0.9, bounds: null, candidates: ["Noisy Club"] },
    { text: "1 2 3 4 5 6 7 8 9", confidence: 0.9, bounds: null, candidates: ["1 2 3 4 5 6 7 8 9"] },
    { text: "391 391 391 391 391 391 391 391 391", confidence: 0.7, bounds: null, candidates: ["391 391 391 391 391 391 391 391 391"] },
    { text: "4 4 4 4 4 4 4 4 4", confidence: 0.7, bounds: null, candidates: ["4 4 4 4 4 4 4 4 4"] },
    { text: "1 2 3 4 5 6 7 8 9", confidence: 0.8, bounds: null, candidates: ["1 2 3 4 5 6 7 8 9"] },
  ],
};

const postTableRatingNoiseResult = {
  platform: "ios-vision",
  fullText: [
    "Noise Club",
    "1 2 3 4 5 6 7 8 9",
    "391 174 512 328 365 148 407 334 421",
    "10 11 12 13 14 15 16 17 18 69.8 121",
  ].join("\n"),
  lines: [
    { text: "Noise Club", confidence: 0.95, bounds: null, candidates: ["Noise Club"] },
    { text: "1 2 3 4 5 6 7 8 9", confidence: 0.95, bounds: null, candidates: ["1 2 3 4 5 6 7 8 9"] },
    { text: "391 174 512 328 365 148 407 334 421", confidence: 0.94, bounds: null, candidates: ["391 174 512 328 365 148 407 334 421"] },
    { text: "10 11 12 13 14 15 16 17 18 69.8 121", confidence: 0.75, bounds: null, candidates: ["10 11 12 13 14 15 16 17 18 69.8 121"] },
  ],
};

const rowBasedMultiTeeScorecardResult = {
  platform: "ios-vision",
  fullText: [
    "Missfits Golf Club",
    "White Yellow Blue Red Par Stroke Index",
    "Yellow 68.9 120",
    "1 Home Wood 279 258 269 232 4 12",
    "2 Partridge Way 199 188 164 159 3 8",
    "3 Langley Walk 536 527 513 483 5 6",
    "4 Skylark Bend 343 334 304 301 4 18",
    "5 The Old Gate 328 316 292 283 4 10",
    "6 Home Farm 165 150 139 131 3 16",
    "7 Oak Corner 407 375 386 347 4 2",
    "8 Foxes Covert 341 289 302 265 4 14",
    "9 Vixen Crossing 421 358 377 339 4 4",
    "10 The Ha Ha 169 161 124 131 3 15",
    "11 Chestnut Bend 413 374 360 352 4 3",
    "12 The Swannery 323 315 294 290 4 17",
    "13 Pheasants 349 339 325 318 4 7",
    "14 Mansion Copse 195 184 177 174 3 11",
    "15 Lime Walk 410 386 371 381 4 1",
    "16 Rushes 425 388 370 333 4 5",
    "17 Ice House 534 500 509 468 5 13",
    "18 Witty Brook 395 374 360 355 4 9",
  ].join("\n"),
  lines: [
    { text: "Missfits Golf Club", confidence: 0.99, bounds: null, candidates: ["Missfits Golf Club"] },
    { text: "White Yellow Blue Red Par Stroke Index", confidence: 0.94, bounds: null, candidates: ["White Yellow Blue Red Par Stroke Index"] },
    { text: "Yellow 68.9 120", confidence: 0.94, bounds: null, candidates: ["Yellow 68.9 120"] },
    { text: "1 Home Wood 279 258 269 232 4 12", confidence: 0.93, bounds: null, candidates: ["1 Home Wood 279 258 269 232 4 12"] },
    { text: "2 Partridge Way 199 188 164 159 3 8", confidence: 0.93, bounds: null, candidates: ["2 Partridge Way 199 188 164 159 3 8"] },
    { text: "3 Langley Walk 536 527 513 483 5 6", confidence: 0.93, bounds: null, candidates: ["3 Langley Walk 536 527 513 483 5 6"] },
    { text: "4 Skylark Bend 343 334 304 301 4 18", confidence: 0.93, bounds: null, candidates: ["4 Skylark Bend 343 334 304 301 4 18"] },
    { text: "5 The Old Gate 328 316 292 283 4 10", confidence: 0.93, bounds: null, candidates: ["5 The Old Gate 328 316 292 283 4 10"] },
    { text: "6 Home Farm 165 150 139 131 3 16", confidence: 0.93, bounds: null, candidates: ["6 Home Farm 165 150 139 131 3 16"] },
    { text: "7 Oak Corner 407 375 386 347 4 2", confidence: 0.93, bounds: null, candidates: ["7 Oak Corner 407 375 386 347 4 2"] },
    { text: "8 Foxes Covert 341 289 302 265 4 14", confidence: 0.93, bounds: null, candidates: ["8 Foxes Covert 341 289 302 265 4 14"] },
    { text: "9 Vixen Crossing 421 358 377 339 4 4", confidence: 0.93, bounds: null, candidates: ["9 Vixen Crossing 421 358 377 339 4 4"] },
    { text: "10 The Ha Ha 169 161 124 131 3 15", confidence: 0.93, bounds: null, candidates: ["10 The Ha Ha 169 161 124 131 3 15"] },
    { text: "11 Chestnut Bend 413 374 360 352 4 3", confidence: 0.93, bounds: null, candidates: ["11 Chestnut Bend 413 374 360 352 4 3"] },
    { text: "12 The Swannery 323 315 294 290 4 17", confidence: 0.93, bounds: null, candidates: ["12 The Swannery 323 315 294 290 4 17"] },
    { text: "13 Pheasants 349 339 325 318 4 7", confidence: 0.93, bounds: null, candidates: ["13 Pheasants 349 339 325 318 4 7"] },
    { text: "14 Mansion Copse 195 184 177 174 3 11", confidence: 0.93, bounds: null, candidates: ["14 Mansion Copse 195 184 177 174 3 11"] },
    { text: "15 Lime Walk 410 386 371 381 4 1", confidence: 0.93, bounds: null, candidates: ["15 Lime Walk 410 386 371 381 4 1"] },
    { text: "16 Rushes 425 388 370 333 4 5", confidence: 0.93, bounds: null, candidates: ["16 Rushes 425 388 370 333 4 5"] },
    { text: "17 Ice House 534 500 509 468 5 13", confidence: 0.93, bounds: null, candidates: ["17 Ice House 534 500 509 468 5 13"] },
    { text: "18 Witty Brook 395 374 360 355 4 9", confidence: 0.93, bounds: null, candidates: ["18 Witty Brook 395 374 360 355 4 9"] },
  ],
};

const splitSideScorecardResult = {
  platform: "ios-vision",
  fullText: [
    "Different Club",
    "M 70 71.1 132",
    "M 70 69.8 127",
    "L 73 73.6 132",
    "1 360 353 4 16 346 4 13",
    "2 413 401 4 4 360 5 9",
    "3 173 163 3 18 161 3 15",
    "4 517 499 5 12 466 5 6",
    "5 428 416 4 2 351 4 4",
    "6 201 187 3 8 160 3 11",
    "7 346 337 4 14 295 4 17",
    "8 395 386 4 6 377 4 1",
    "9 371 344 4 10 338 4 7",
    "10 174 157 3 15 128 3 18",
    "11 556 538 5 5 502 5 2",
    "12 434 427 4 1 417 5 5",
    "13 153 144 3 17 134 3 12",
    "14 426 409 4 3 362 4 3",
    "15 320 306 4 11 280 4 14",
    "16 506 491 5 9 456 5 8",
    "17 185 177 3 13 167 3 16",
    "18 435 423 4 7 414 5 10",
  ].join("\n"),
  lines: [
    { text: "Different Club", confidence: 0.99, bounds: null, candidates: ["Different Club"] },
    { text: "M 70 71.1 132", confidence: 0.94, bounds: null, candidates: ["M 70 71.1 132"] },
    { text: "M 70 69.8 127", confidence: 0.94, bounds: null, candidates: ["M 70 69.8 127"] },
    { text: "L 73 73.6 132", confidence: 0.94, bounds: null, candidates: ["L 73 73.6 132"] },
    { text: "1 360 353 4 16 346 4 13", confidence: 0.92, bounds: null, candidates: ["1 360 353 4 16 346 4 13"] },
    { text: "2 413 401 4 4 360 5 9", confidence: 0.92, bounds: null, candidates: ["2 413 401 4 4 360 5 9"] },
    { text: "3 173 163 3 18 161 3 15", confidence: 0.92, bounds: null, candidates: ["3 173 163 3 18 161 3 15"] },
    { text: "4 517 499 5 12 466 5 6", confidence: 0.92, bounds: null, candidates: ["4 517 499 5 12 466 5 6"] },
    { text: "5 428 416 4 2 351 4 4", confidence: 0.92, bounds: null, candidates: ["5 428 416 4 2 351 4 4"] },
    { text: "6 201 187 3 8 160 3 11", confidence: 0.92, bounds: null, candidates: ["6 201 187 3 8 160 3 11"] },
    { text: "7 346 337 4 14 295 4 17", confidence: 0.92, bounds: null, candidates: ["7 346 337 4 14 295 4 17"] },
    { text: "8 395 386 4 6 377 4 1", confidence: 0.92, bounds: null, candidates: ["8 395 386 4 6 377 4 1"] },
    { text: "9 371 344 4 10 338 4 7", confidence: 0.92, bounds: null, candidates: ["9 371 344 4 10 338 4 7"] },
    { text: "10 174 157 3 15 128 3 18", confidence: 0.92, bounds: null, candidates: ["10 174 157 3 15 128 3 18"] },
    { text: "11 556 538 5 5 502 5 2", confidence: 0.92, bounds: null, candidates: ["11 556 538 5 5 502 5 2"] },
    { text: "12 434 427 4 1 417 5 5", confidence: 0.92, bounds: null, candidates: ["12 434 427 4 1 417 5 5"] },
    { text: "13 153 144 3 17 134 3 12", confidence: 0.92, bounds: null, candidates: ["13 153 144 3 17 134 3 12"] },
    { text: "14 426 409 4 3 362 4 3", confidence: 0.92, bounds: null, candidates: ["14 426 409 4 3 362 4 3"] },
    { text: "15 320 306 4 11 280 4 14", confidence: 0.92, bounds: null, candidates: ["15 320 306 4 11 280 4 14"] },
    { text: "16 506 491 5 9 456 5 8", confidence: 0.92, bounds: null, candidates: ["16 506 491 5 9 456 5 8"] },
    { text: "17 185 177 3 13 167 3 16", confidence: 0.92, bounds: null, candidates: ["17 185 177 3 13 167 3 16"] },
    { text: "18 435 423 4 7 414 5 10", confidence: 0.92, bounds: null, candidates: ["18 435 423 4 7 414 5 10"] },
  ],
};

const collapsedDuplicateSplitSideScorecardResult = {
  platform: "ios-vision",
  fullText: [
    "Different Club",
    "M 70 71.1 132",
    "M 70 69.8 127",
    "L 73 73.6 132",
    "1 360 353 4 16 346 4 13",
    "2 413 401 4 360 5 9",
    "3 173 163 3 18 161 3 15",
    "4 517 499 5 12 466 5 6",
    "5 428 416 4 2 351 4",
    "6 201 187 3 8 160 3 11",
    "7 346 337 4 14 295 4 17",
    "8 395 386 4 6 377 4 1",
    "9 371 344 4 10 338 4 7",
    "10 174 157 3 15 128 3 18",
    "11 556 538 5 502 5 2",
    "12 434 427 4 1 417 5 5",
    "13 153 144 3 17 134 3 12",
    "14 426 409 4 3 362 4 3",
    "15 320 306 4 11 280 4 14",
    "16 506 491 5 9 456 5 8",
    "17 185 177 3 13 167 3 16",
    "18 435 423 4 7 414 5 10",
  ].join("\n"),
  lines: [
    { text: "Different Club", confidence: 0.99, bounds: null, candidates: ["Different Club"] },
    { text: "M 70 71.1 132", confidence: 0.94, bounds: null, candidates: ["M 70 71.1 132"] },
    { text: "M 70 69.8 127", confidence: 0.94, bounds: null, candidates: ["M 70 69.8 127"] },
    { text: "L 73 73.6 132", confidence: 0.94, bounds: null, candidates: ["L 73 73.6 132"] },
    { text: "1 360 353 4 16 346 4 13", confidence: 0.92, bounds: null, candidates: ["1 360 353 4 16 346 4 13"] },
    { text: "2 413 401 4 360 5 9", confidence: 0.92, bounds: null, candidates: ["2 413 401 4 360 5 9"] },
    { text: "3 173 163 3 18 161 3 15", confidence: 0.92, bounds: null, candidates: ["3 173 163 3 18 161 3 15"] },
    { text: "4 517 499 5 12 466 5 6", confidence: 0.92, bounds: null, candidates: ["4 517 499 5 12 466 5 6"] },
    { text: "5 428 416 4 2 351 4", confidence: 0.92, bounds: null, candidates: ["5 428 416 4 2 351 4"] },
    { text: "6 201 187 3 8 160 3 11", confidence: 0.92, bounds: null, candidates: ["6 201 187 3 8 160 3 11"] },
    { text: "7 346 337 4 14 295 4 17", confidence: 0.92, bounds: null, candidates: ["7 346 337 4 14 295 4 17"] },
    { text: "8 395 386 4 6 377 4 1", confidence: 0.92, bounds: null, candidates: ["8 395 386 4 6 377 4 1"] },
    { text: "9 371 344 4 10 338 4 7", confidence: 0.92, bounds: null, candidates: ["9 371 344 4 10 338 4 7"] },
    { text: "10 174 157 3 15 128 3 18", confidence: 0.92, bounds: null, candidates: ["10 174 157 3 15 128 3 18"] },
    { text: "11 556 538 5 502 5 2", confidence: 0.92, bounds: null, candidates: ["11 556 538 5 502 5 2"] },
    { text: "12 434 427 4 1 417 5 5", confidence: 0.92, bounds: null, candidates: ["12 434 427 4 1 417 5 5"] },
    { text: "13 153 144 3 17 134 3 12", confidence: 0.92, bounds: null, candidates: ["13 153 144 3 17 134 3 12"] },
    { text: "14 426 409 4 3 362 4 3", confidence: 0.92, bounds: null, candidates: ["14 426 409 4 3 362 4 3"] },
    { text: "15 320 306 4 11 280 4 14", confidence: 0.92, bounds: null, candidates: ["15 320 306 4 11 280 4 14"] },
    { text: "16 506 491 5 9 456 5 8", confidence: 0.92, bounds: null, candidates: ["16 506 491 5 9 456 5 8"] },
    { text: "17 185 177 3 13 167 3 16", confidence: 0.92, bounds: null, candidates: ["17 185 177 3 13 167 3 16"] },
    { text: "18 435 423 4 7 414 5 10", confidence: 0.92, bounds: null, candidates: ["18 435 423 4 7 414 5 10"] },
  ],
};

const mergedDuplicateSplitSideScorecardResult = {
  platform: "ios-vision",
  fullText: [
    "Different Club",
    "M 70 71.1 132",
    "M 70 69.8 127",
    "L 73 73.6 132",
    "1 360 353 4 16 346 4 13",
    "2 413 401 44 360 5 9",
    "3 173 163 3 18 161 3 15",
    "4 517 499 5 12 466 5 6",
    "5 428 416 4 2 351 44",
    "6 201 187 3 8 160 3 11",
    "7 346 337 4 14 295 4 17",
    "8 395 386 4 6 377 4 1",
    "9 371 344 4 10 338 4 7",
    "10 174 157 3 15 128 3 18",
    "11 556 538 55 502 5 2",
    "12 434 427 4 1 417 5 5",
    "13 153 144 3 17 134 3 12",
    "14 426 409 4 3 362 4 3",
    "15 320 306 4 11 280 4 14",
    "16 506 491 5 9 456 5 8",
    "17 185 177 3 13 167 3 16",
    "18 435 423 4 7 414 5 10",
  ].join("\n"),
  lines: [
    { text: "Different Club", confidence: 0.99, bounds: null, candidates: ["Different Club"] },
    { text: "M 70 71.1 132", confidence: 0.94, bounds: null, candidates: ["M 70 71.1 132"] },
    { text: "M 70 69.8 127", confidence: 0.94, bounds: null, candidates: ["M 70 69.8 127"] },
    { text: "L 73 73.6 132", confidence: 0.94, bounds: null, candidates: ["L 73 73.6 132"] },
    { text: "1 360 353 4 16 346 4 13", confidence: 0.92, bounds: null, candidates: ["1 360 353 4 16 346 4 13"] },
    { text: "2 413 401 44 360 5 9", confidence: 0.92, bounds: null, candidates: ["2 413 401 44 360 5 9"] },
    { text: "3 173 163 3 18 161 3 15", confidence: 0.92, bounds: null, candidates: ["3 173 163 3 18 161 3 15"] },
    { text: "4 517 499 5 12 466 5 6", confidence: 0.92, bounds: null, candidates: ["4 517 499 5 12 466 5 6"] },
    { text: "5 428 416 4 2 351 44", confidence: 0.92, bounds: null, candidates: ["5 428 416 4 2 351 44"] },
    { text: "6 201 187 3 8 160 3 11", confidence: 0.92, bounds: null, candidates: ["6 201 187 3 8 160 3 11"] },
    { text: "7 346 337 4 14 295 4 17", confidence: 0.92, bounds: null, candidates: ["7 346 337 4 14 295 4 17"] },
    { text: "8 395 386 4 6 377 4 1", confidence: 0.92, bounds: null, candidates: ["8 395 386 4 6 377 4 1"] },
    { text: "9 371 344 4 10 338 4 7", confidence: 0.92, bounds: null, candidates: ["9 371 344 4 10 338 4 7"] },
    { text: "10 174 157 3 15 128 3 18", confidence: 0.92, bounds: null, candidates: ["10 174 157 3 15 128 3 18"] },
    { text: "11 556 538 55 502 5 2", confidence: 0.92, bounds: null, candidates: ["11 556 538 55 502 5 2"] },
    { text: "12 434 427 4 1 417 5 5", confidence: 0.92, bounds: null, candidates: ["12 434 427 4 1 417 5 5"] },
    { text: "13 153 144 3 17 134 3 12", confidence: 0.92, bounds: null, candidates: ["13 153 144 3 17 134 3 12"] },
    { text: "14 426 409 4 3 362 4 3", confidence: 0.92, bounds: null, candidates: ["14 426 409 4 3 362 4 3"] },
    { text: "15 320 306 4 11 280 4 14", confidence: 0.92, bounds: null, candidates: ["15 320 306 4 11 280 4 14"] },
    { text: "16 506 491 5 9 456 5 8", confidence: 0.92, bounds: null, candidates: ["16 506 491 5 9 456 5 8"] },
    { text: "17 185 177 3 13 167 3 16", confidence: 0.92, bounds: null, candidates: ["17 185 177 3 13 167 3 16"] },
    { text: "18 435 423 4 7 414 5 10", confidence: 0.92, bounds: null, candidates: ["18 435 423 4 7 414 5 10"] },
  ],
};

const cellBasedSplitSideScorecardRows = [
  { y: 0.95, cells: [["Different Club", 0.08, 0.14]] },
  { y: 0.9, cells: [["M", 0.72], ["70", 0.78], ["71.1", 0.84], ["132", 0.92]] },
  { y: 0.87, cells: [["M", 0.72], ["70", 0.78], ["69.8", 0.84], ["127", 0.92]] },
  { y: 0.84, cells: [["L", 0.72], ["73", 0.78], ["73.6", 0.84], ["132", 0.92]] },
  { y: 0.72, cells: [["1", 0.05], ["360", 0.18], ["353", 0.28], ["4", 0.40], ["16", 0.48], ["346", 0.72], ["4", 0.84], ["13", 0.92]] },
  { y: 0.69, cells: [["2", 0.05], ["413", 0.18], ["401", 0.28], ["4", 0.40], ["4", 0.48], ["360", 0.72], ["5", 0.84], ["9", 0.92]] },
  { y: 0.66, cells: [["3", 0.05], ["173", 0.18], ["163", 0.28], ["3", 0.40], ["18", 0.48], ["161", 0.72], ["3", 0.84], ["15", 0.92]] },
  { y: 0.63, cells: [["4", 0.05], ["517", 0.18], ["499", 0.28], ["5", 0.40], ["12", 0.48], ["466", 0.72], ["5", 0.84], ["6", 0.92]] },
  { y: 0.6, cells: [["5", 0.05], ["428", 0.18], ["416", 0.28], ["4", 0.40], ["2", 0.48], ["351", 0.72], ["4", 0.84], ["4", 0.92]] },
  { y: 0.57, cells: [["6", 0.05], ["201", 0.18], ["187", 0.28], ["3", 0.40], ["8", 0.48], ["160", 0.72], ["3", 0.84], ["11", 0.92]] },
  { y: 0.54, cells: [["7", 0.05], ["346", 0.18], ["337", 0.28], ["4", 0.40], ["14", 0.48], ["295", 0.72], ["4", 0.84], ["17", 0.92]] },
  { y: 0.51, cells: [["8", 0.05], ["395", 0.18], ["386", 0.28], ["4", 0.40], ["6", 0.48], ["377", 0.72], ["4", 0.84], ["1", 0.92]] },
  { y: 0.48, cells: [["9", 0.05], ["371", 0.18], ["344", 0.28], ["4", 0.40], ["10", 0.48], ["338", 0.72], ["4", 0.84], ["7", 0.92]] },
];

const cellBasedSplitSideScorecardResult = {
  platform: "ios-vision",
  fullText: cellBasedSplitSideScorecardRows
    .flatMap((row) => row.cells.map(([text]) => text))
    .join("\n"),
  lines: cellBasedSplitSideScorecardRows.flatMap((row) =>
    row.cells.map(([text, x, width]) => boundedCell(text, x, row.y, width)),
  ),
};

const skewedCellBasedSplitSideScorecardResult = {
  platform: "ios-vision",
  fullText: cellBasedSplitSideScorecardRows
    .flatMap((row) => row.cells.map(([text]) => text))
    .join("\n"),
  lines: cellBasedSplitSideScorecardRows.flatMap((row, rowIndex) =>
    row.cells.map(([text, x, width], cellIndex) =>
      boundedCell(
        text,
        x + 0.12,
        row.y + ((rowIndex + cellIndex) % 3 === 0 ? 0.007 : (rowIndex + cellIndex) % 3 === 1 ? -0.006 : 0),
        width,
      ),
    ),
  ),
};

const fullCardSplitSideRowValues = [
  ["1", "360", "353", "4", "16", "346", "4", "13"],
  ["2", "413", "401", "44", "360", "5", "9"],
  ["3", "173", "163", "3", "18", "161", "3", "15"],
  ["4", "517", "499", "5", "12", "466", "5", "6"],
  ["5", "428", "416", "4", "2", "351", "44"],
  ["6", "201", "187", "3", "8", "160", "3", "11"],
  ["7", "346", "337", "4", "14", "295", "4", "17"],
  ["8", "395", "386", "4", "6", "377", "4", "1"],
  ["9", "371", "344", "4", "10", "338", "4", "7"],
  ["10", "174", "157", "3", "15", "128", "3", "18"],
  ["11", "556", "538", "55", "502", "5", "2"],
  ["12", "434", "427", "4", "1", "417", "5", "5"],
  ["13", "153", "144", "3", "17", "134", "3", "12"],
  ["14", "426", "409", "4", "3", "362", "4", "3"],
  ["15", "320", "306", "4", "11", "280", "4", "14"],
  ["16", "506", "491", "5", "9", "456", "5", "8"],
  ["17", "185", "177", "3", "13", "167", "3", "16"],
  ["18", "435", "423", "4", "7", "414", "5", "10"],
];

function splitSideCellsForValues(values, prefixed = false) {
  if (!prefixed) {
    const xValues = [0.05, 0.17, 0.27, 0.38, 0.46, 0.67, 0.8, 0.88];
    return values.map((text, index) => [text, xValues[index], text.length > 2 ? 0.06 : 0.035]);
  }

  const shiftedXValues = [0.29, 0.39, 0.5, 0.61, 0.69, 0.79, 0.87, 0.94];
  return [
    ["Marker", 0.05, 0.11],
    ...values.map((text, index) => [text, shiftedXValues[index], text.length > 2 ? 0.06 : 0.035]),
  ];
}

const prefixedSkewedFullCardSplitSideRows = [
  { y: 0.95, cells: [["Different Club", 0.08, 0.14]] },
  { y: 0.9, cells: [["M", 0.72], ["70", 0.78], ["71.1", 0.84], ["132", 0.92]] },
  { y: 0.87, cells: [["M", 0.72], ["70", 0.78], ["69.8", 0.84], ["127", 0.92]] },
  { y: 0.84, cells: [["L", 0.72], ["73", 0.78], ["73.6", 0.84], ["132", 0.92]] },
  ...fullCardSplitSideRowValues.map((values, index) => ({
    y: 0.78 - index * 0.03,
    cells: splitSideCellsForValues(values, new Set(["1", "2", "9", "11"]).has(values[0])),
  })),
];

const prefixedSkewedFullCardSplitSideScorecardResult = {
  platform: "ios-vision",
  fullText: prefixedSkewedFullCardSplitSideRows
    .flatMap((row) => row.cells.map(([text]) => text))
    .join("\n"),
  lines: prefixedSkewedFullCardSplitSideRows.flatMap((row, rowIndex) =>
    row.cells.map(([text, x, width], cellIndex) =>
      boundedCell(
        text,
        x,
        row.y + ((rowIndex + cellIndex) % 3 === 0 ? 0.006 : (rowIndex + cellIndex) % 3 === 1 ? -0.005 : 0),
        width,
      ),
    ),
  ),
};

const prefixedMergedSplitSideRows = [
  { y: 0.95, cells: [["Different Club", 0.08, 0.14]] },
  { y: 0.9, cells: [["M", 0.72], ["70", 0.78], ["71.1", 0.84], ["132", 0.92]] },
  { y: 0.87, cells: [["M", 0.72], ["70", 0.78], ["69.8", 0.84], ["127", 0.92]] },
  { y: 0.84, cells: [["L", 0.72], ["73", 0.78], ["73.6", 0.84], ["132", 0.92]] },
  ...fullCardSplitSideRowValues.map((values, index) => {
    const mergedValues =
      values[0] === "16"
        ? ["16", "506", "491", "59", "456", "5", "8"]
        : values;
    return {
      y: 0.78 - index * 0.03,
      cells: splitSideCellsForValues(mergedValues, new Set(["2", "11", "16"]).has(values[0])),
    };
  }),
];

const prefixedMergedSplitSideScorecardResult = {
  platform: "ios-vision",
  fullText: prefixedMergedSplitSideRows
    .flatMap((row) => row.cells.map(([text]) => text))
    .join("\n"),
  lines: prefixedMergedSplitSideRows.flatMap((row, rowIndex) =>
    row.cells.map(([text, x, width], cellIndex) =>
      boundedCell(
        text,
        x,
        row.y + ((rowIndex + cellIndex) % 3 === 0 ? 0.006 : (rowIndex + cellIndex) % 3 === 1 ? -0.005 : 0),
        width,
      ),
    ),
  ),
};

const hybridStrategySplitSideScorecardResult = {
  platform: "ios-vision",
  fullText: [
    ...prefixedMergedSplitSideRows.flatMap((row) => row.cells.map(([text]) => text)),
    "Marker 2 413 401 44 360 5 9",
    "Marker 11 556 538 55 502 5 2",
  ].join("\n"),
  lines: [
    ...prefixedMergedSplitSideRows.flatMap((row, rowIndex) =>
      row.cells.map(([text, x, width], cellIndex) => {
        const shiftedX =
          (text === "2" || text === "11") && x >= 0.29 && x <= 0.4
            ? x + 0.08
            : x;
        return boundedCell(
          text,
          shiftedX,
          row.y + ((rowIndex + cellIndex) % 3 === 0 ? 0.006 : (rowIndex + cellIndex) % 3 === 1 ? -0.005 : 0),
          width,
        );
      }),
    ),
    { text: "Marker 2 413 401 44 360 5 9", confidence: 0.91, bounds: null, candidates: ["Marker 2 413 401 44 360 5 9"] },
    { text: "Marker 11 556 538 55 502 5 2", confidence: 0.91, bounds: null, candidates: ["Marker 11 556 538 55 502 5 2"] },
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

test("scorecard OCR ignores repeated single-value rows instead of cloning one hole across the card", () => {
  const parsed = extractScorecardHoleSuggestions(noisyRepeatedRowsResult);

  assert.equal(parsed.holes.length, 0);
  assert.equal(parsed.yardageCount, 0);
  assert.equal(parsed.parCount, 0);
  assert.equal(parsed.strokeIndexCount, 0);
});

test("scorecard OCR ignores unlabeled rating and slope pairs that appear inside table noise", () => {
  assert.deepEqual(extractScorecardOcrHints(postTableRatingNoiseResult), {
    courseRatingCandidates: [],
    slopeRatingCandidates: [],
  });
});

test("scorecard OCR maps row-based multi-tee scorecards to the selected tee column", () => {
  assert.deepEqual(extractScorecardOcrHints(rowBasedMultiTeeScorecardResult, "Yellow"), {
    courseRatingCandidates: ["68.9"],
    slopeRatingCandidates: ["120"],
  });

  const parsed = extractScorecardHoleSuggestions(rowBasedMultiTeeScorecardResult, "Yellow");

  assert.equal(parsed.holes.length, 18);
  assert.equal(parsed.yardageCount, 18);
  assert.equal(parsed.parCount, 18);
  assert.equal(parsed.strokeIndexCount, 18);

  assert.deepEqual(parsed.holes[0], {
    number: 1,
    yardage: 258,
    par: 4,
    strokeIndex: 12,
  });

  assert.deepEqual(parsed.holes[17], {
    number: 18,
    yardage: 374,
    par: 4,
    strokeIndex: 9,
  });
});

test("scorecard OCR maps split-side scorecards for yellow and red tees", () => {
  assert.deepEqual(extractScorecardOcrHints(splitSideScorecardResult, "Yellow"), {
    courseRatingCandidates: ["69.8"],
    slopeRatingCandidates: ["127"],
  });

  assert.deepEqual(extractScorecardOcrHints(splitSideScorecardResult, "Red"), {
    courseRatingCandidates: ["73.6"],
    slopeRatingCandidates: ["132"],
  });

  const yellowParsed = extractScorecardHoleSuggestions(splitSideScorecardResult, "Yellow");
  assert.equal(yellowParsed.holes.length, 18);
  assert.deepEqual(yellowParsed.holes[0], {
    number: 1,
    yardage: 353,
    par: 4,
    strokeIndex: 16,
  });
  assert.deepEqual(yellowParsed.holes[17], {
    number: 18,
    yardage: 423,
    par: 4,
    strokeIndex: 7,
  });

  const redParsed = extractScorecardHoleSuggestions(splitSideScorecardResult, "Red");
  assert.equal(redParsed.holes.length, 18);
  assert.deepEqual(redParsed.holes[0], {
    number: 1,
    yardage: 346,
    par: 4,
    strokeIndex: 13,
  });
  assert.deepEqual(redParsed.holes[17], {
    number: 18,
    yardage: 414,
    par: 5,
    strokeIndex: 10,
  });
});

test("scorecard OCR reconstructs row data from cell-level OCR bounds", () => {
  assert.deepEqual(extractScorecardOcrHints(cellBasedSplitSideScorecardResult, "Yellow"), {
    courseRatingCandidates: ["69.8"],
    slopeRatingCandidates: ["127"],
  });

  const parsed = extractScorecardHoleSuggestions(cellBasedSplitSideScorecardResult, "Yellow");
  assert.equal(parsed.holes.length, 9);
  assert.equal(parsed.yardageCount, 9);
  assert.equal(parsed.parCount, 9);
  assert.equal(parsed.strokeIndexCount, 9);

  assert.deepEqual(parsed.holes[0], {
    number: 1,
    yardage: 353,
    par: 4,
    strokeIndex: 16,
  });

  assert.deepEqual(parsed.holes[8], {
    number: 9,
    yardage: 344,
    par: 4,
    strokeIndex: 10,
  });
});

test("scorecard OCR reconstructs skewed cell rows when hole numbers are not flush left", () => {
  const parsed = extractScorecardHoleSuggestions(skewedCellBasedSplitSideScorecardResult, "Yellow");
  assert.equal(parsed.holes.length, 9);
  assert.deepEqual(parsed.holes[0], {
    number: 1,
    yardage: 353,
    par: 4,
    strokeIndex: 16,
  });
  assert.deepEqual(parsed.holes[8], {
    number: 9,
    yardage: 344,
    par: 4,
    strokeIndex: 10,
  });
});

test("scorecard OCR recovers split-side rows when duplicated par and stroke index collapse into one value", () => {
  const whiteParsed = extractScorecardHoleSuggestions(collapsedDuplicateSplitSideScorecardResult, "White");
  assert.equal(whiteParsed.holes.length, 18);

  assert.deepEqual(whiteParsed.holes[1], {
    number: 2,
    yardage: 413,
    par: 4,
    strokeIndex: 4,
  });

  assert.deepEqual(whiteParsed.holes[10], {
    number: 11,
    yardage: 556,
    par: 5,
    strokeIndex: 5,
  });

  const redParsed = extractScorecardHoleSuggestions(collapsedDuplicateSplitSideScorecardResult, "Red");
  assert.equal(redParsed.holes.length, 18);

  assert.deepEqual(redParsed.holes[4], {
    number: 5,
    yardage: 351,
    par: 4,
    strokeIndex: 4,
  });
});

test("scorecard OCR recovers split-side rows when duplicated par and stroke index merge into double digits", () => {
  const whiteParsed = extractScorecardHoleSuggestions(mergedDuplicateSplitSideScorecardResult, "White");
  assert.equal(whiteParsed.holes.length, 18);

  assert.deepEqual(whiteParsed.holes[1], {
    number: 2,
    yardage: 413,
    par: 4,
    strokeIndex: 4,
  });

  assert.deepEqual(whiteParsed.holes[10], {
    number: 11,
    yardage: 556,
    par: 5,
    strokeIndex: 5,
  });

  const redParsed = extractScorecardHoleSuggestions(mergedDuplicateSplitSideScorecardResult, "Red");
  assert.equal(redParsed.holes.length, 18);

  assert.deepEqual(redParsed.holes[4], {
    number: 5,
    yardage: 351,
    par: 4,
    strokeIndex: 4,
  });
});

test("scorecard OCR recovers prefixed split-side rows when hole anchors drift right", () => {
  const yellowParsed = extractScorecardHoleSuggestions(prefixedSkewedFullCardSplitSideScorecardResult, "Yellow");
  assert.equal(yellowParsed.holes.length, 18);

  assert.deepEqual(yellowParsed.holes[0], {
    number: 1,
    yardage: 353,
    par: 4,
    strokeIndex: 16,
  });

  assert.deepEqual(yellowParsed.holes[1], {
    number: 2,
    yardage: 401,
    par: 4,
    strokeIndex: 4,
  });

  assert.deepEqual(yellowParsed.holes[8], {
    number: 9,
    yardage: 344,
    par: 4,
    strokeIndex: 10,
  });

  assert.deepEqual(yellowParsed.holes[10], {
    number: 11,
    yardage: 538,
    par: 5,
    strokeIndex: 5,
  });
});

test("scorecard OCR recovers merged par and stroke index values on prefixed white-tee rows", () => {
  const whiteParsed = extractScorecardHoleSuggestions(prefixedMergedSplitSideScorecardResult, "White");
  assert.equal(whiteParsed.holes.length, 18);

  assert.deepEqual(whiteParsed.holes[1], {
    number: 2,
    yardage: 413,
    par: 4,
    strokeIndex: 4,
  });

  assert.deepEqual(whiteParsed.holes[10], {
    number: 11,
    yardage: 556,
    par: 5,
    strokeIndex: 5,
  });

  assert.deepEqual(whiteParsed.holes[15], {
    number: 16,
    yardage: 506,
    par: 5,
    strokeIndex: 9,
  });
});

test("scorecard OCR merges missing split-side holes from fallback text parsing", () => {
  const whiteParsed = extractScorecardHoleSuggestions(hybridStrategySplitSideScorecardResult, "White");
  assert.equal(whiteParsed.holes.length, 18);

  assert.deepEqual(whiteParsed.holes[1], {
    number: 2,
    yardage: 413,
    par: 4,
    strokeIndex: 4,
  });

  assert.deepEqual(whiteParsed.holes[10], {
    number: 11,
    yardage: 556,
    par: 5,
    strokeIndex: 5,
  });
});
