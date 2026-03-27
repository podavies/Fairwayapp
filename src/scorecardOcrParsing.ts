import type { ScorecardOcrResult } from "../modules";

export type ScorecardOcrHints = {
  courseRatingCandidates: string[];
  slopeRatingCandidates: string[];
};

export type ScorecardNameSuggestions = {
  courseNameCandidates: string[];
  teeNameCandidates: string[];
};

export type ScorecardParsedHole = {
  number: number;
  yardage: number | null;
  par: number | null;
  strokeIndex: number | null;
};

export type ScorecardHoleSuggestions = {
  holes: ScorecardParsedHole[];
  yardageCount: number;
  parCount: number;
  strokeIndexCount: number;
};

type NumericLine = {
  index: number;
  text: string;
  values: number[];
};

type MatchedNumericWindow = {
  values: number[];
  offset: number;
};

type HoleSequenceMatch = {
  holeNumbers: number[];
  offset: number;
};

function uniqueValues(values: string[]) {
  return [...new Set(values)];
}

function normalizeCandidate(source: string) {
  return source.replace(/\s+/g, " ").replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").trim();
}

function extractIntegers(source: string) {
  return [...source.matchAll(/\d+/g)]
    .map((match) => Number.parseInt(match[0], 10))
    .filter((value) => !Number.isNaN(value));
}

function contiguousHoleSequence(values: number[]) {
  return matchHoleSequence(values)?.holeNumbers ?? null;
}

function matchHoleSequence(values: number[]): HoleSequenceMatch | null {
  if (values.length < 9) {
    return null;
  }

  for (let start = 0; start <= values.length - 18; start += 1) {
    const fullCard = values.slice(start, start + 18);
    if (fullCard.every((value, index) => value === index + 1)) {
      return {
        holeNumbers: fullCard,
        offset: start,
      };
    }
  }

  for (let start = 0; start <= values.length - 9; start += 1) {
    const nineHoleBlock = values.slice(start, start + 9);
    if (
      nineHoleBlock.every((value, index) => value === nineHoleBlock[0] + index) &&
      (nineHoleBlock[0] === 1 || nineHoleBlock[0] === 10)
    ) {
      return {
        holeNumbers: nineHoleBlock,
        offset: start,
      };
    }
  }

  return null;
}

function isParRow(values: number[], holeCount: number) {
  return values.length >= holeCount && values.slice(0, holeCount).every((value) => value >= 3 && value <= 6);
}

function isStrokeIndexRow(values: number[], holeCount: number) {
  const slice = values.slice(0, holeCount);
  return (
    slice.length >= holeCount &&
    slice.every((value) => value >= 1 && value <= 18) &&
    new Set(slice).size >= Math.max(6, holeCount - 2)
  );
}

function isYardageRow(values: number[], holeCount: number) {
  const slice = values.slice(0, holeCount);
  return slice.length >= holeCount && slice.every((value) => value >= 50 && value <= 700);
}

function hasParLabel(source: string) {
  return /\bpar\b/i.test(source);
}

function hasYardageLabel(source: string) {
  return /\b(?:yds?|yards?|metres?|meters?)\b/i.test(source);
}

function hasStrokeIndexLabel(source: string) {
  return /\b(?:s\.?\s*i\.?|stroke\s*index|index|hcp)\b/i.test(source);
}

function findMatchingWindow(values: number[], holeCount: number, matcher: (window: number[]) => boolean): MatchedNumericWindow | null {
  if (values.length < holeCount) {
    return null;
  }

  for (let start = 0; start <= values.length - holeCount; start += 1) {
    const window = values.slice(start, start + holeCount);
    if (matcher(window)) {
      return {
        values: window,
        offset: start,
      };
    }
  }

  return null;
}

function pickNearbyLine(
  numericLines: NumericLine[],
  usedLines: Set<number>,
  sourceIndex: number,
  holeCount: number,
  matcher: (values: number[]) => boolean,
  labelMatcher?: (source: string) => boolean,
) {
  const nearby = numericLines
    .filter((line) => !usedLines.has(line.index) && line.index !== sourceIndex && Math.abs(line.index - sourceIndex) <= 4)
    .map((line) => {
      const windowMatch = findMatchingWindow(line.values, holeCount, matcher);
      if (!windowMatch) {
        return null;
      }

      return {
        index: line.index,
        text: line.text,
        values: windowMatch.values,
        offset: windowMatch.offset,
        distance: Math.abs(line.index - sourceIndex),
        hasLabel: labelMatcher ? labelMatcher(line.text) : false,
      };
    })
    .filter((line): line is NumericLine & {
      offset: number;
      distance: number;
      hasLabel: boolean;
    } => line !== null)
    .sort((a, b) => Number(b.hasLabel) - Number(a.hasLabel) || a.distance - b.distance || a.offset - b.offset);

  return nearby[0] ?? null;
}

export function extractScorecardNameSuggestions(result: ScorecardOcrResult | null): ScorecardNameSuggestions {
  if (!result) {
    return {
      courseNameCandidates: [],
      teeNameCandidates: [],
    };
  }

  const knownTeeWords = ["white", "yellow", "blue", "red", "green", "black", "orange", "purple", "silver", "gold", "bronze"];
  const ignoredTeeNames = /^(?:hole|holes|yd|yds|yard|yards|par|stroke|stroke index|index|s\.?\s*i\.?|si|out|in|total)$/i;
  const lines = result.lines
    .map((line) => normalizeCandidate(line.text))
    .filter(Boolean);
  const firstHoleRowIndex = lines.findIndex((line) => contiguousHoleSequence(extractIntegers(line)));
  const preTableLines = lines.slice(0, firstHoleRowIndex >= 0 ? firstHoleRowIndex : Math.min(lines.length, 6));

  const courseNameCandidates = preTableLines
    .filter((line) => {
      const lower = line.toLowerCase();
      const digitCount = (line.match(/\d/g) ?? []).length;
      return (
        /[a-z]/i.test(line) &&
        digitCount <= 1 &&
        !/\b(?:course\s*rating|c\/?r|cr|slope|par|stroke|index|yard|yards?|holes?|out|in|total)\b/i.test(lower)
      );
    })
    .map((line) => normalizeCandidate(line))
    .filter((line) => line.length >= 4)
    .slice(0, 3);

  const teeNameCandidates = lines
    .flatMap((line) => {
      const matches: string[] = [];
      const lower = line.toLowerCase();

      const prefixMatch = line.match(/^\s*([A-Za-z][A-Za-z &/-]{1,24}?)(?=\s+(?:tee\b|c\/?r\b|cr\b|course\b|rating\b|slope\b|\d))/i);
      if (prefixMatch?.[1]) {
        matches.push(normalizeCandidate(prefixMatch[1]));
      }

      knownTeeWords.forEach((word) => {
        if (lower.includes(word) && /(course\s*rating|c\/?r|cr|slope)/i.test(lower)) {
          matches.push(normalizeCandidate(word.charAt(0).toUpperCase() + word.slice(1)));
        }
      });

      return matches;
    })
    .filter((line) => line.length >= 3 && !ignoredTeeNames.test(line));

  return {
    courseNameCandidates: uniqueValues(courseNameCandidates),
    teeNameCandidates: uniqueValues(teeNameCandidates),
  };
}

export function extractScorecardOcrHints(result: ScorecardOcrResult | null): ScorecardOcrHints {
  if (!result) {
    return {
      courseRatingCandidates: [],
      slopeRatingCandidates: [],
    };
  }

  const courseRatingCandidates: string[] = [];
  const slopeRatingCandidates: string[] = [];
  const sources = result.lines.map((line) => line.text);

  sources.forEach((source) => {
    const ratingMatches = source.matchAll(/(?:course\s*rating|c\/?r|cr|rating)\s*[:\-]?\s*(\d{2}\.\d)/gi);
    for (const match of ratingMatches) {
      const value = match[1];
      const rating = Number.parseFloat(value);
      if (!Number.isNaN(rating) && rating >= 55 && rating <= 80) {
        courseRatingCandidates.push(value);
      }
    }

    const slopeMatches = source.matchAll(/(?:slope(?:\s*rating)?|sr)\s*[:\-]?\s*(\d{2,3})/gi);
    for (const match of slopeMatches) {
      const value = match[1];
      const slope = Number.parseInt(value, 10);
      if (!Number.isNaN(slope) && slope >= 55 && slope <= 155) {
        slopeRatingCandidates.push(value);
      }
    }

    const pairedMatches = source.matchAll(/(\d{2}\.\d)\s*(?:\/|\||-|\s)\s*(\d{2,3})/g);
    for (const match of pairedMatches) {
      const ratingValue = match[1];
      const slopeValue = match[2];
      const rating = Number.parseFloat(ratingValue);
      const slope = Number.parseInt(slopeValue, 10);

      if (!Number.isNaN(rating) && rating >= 55 && rating <= 80) {
        courseRatingCandidates.push(ratingValue);
      }

      if (!Number.isNaN(slope) && slope >= 55 && slope <= 155) {
        slopeRatingCandidates.push(slopeValue);
      }
    }
  });

  return {
    courseRatingCandidates: uniqueValues(courseRatingCandidates),
    slopeRatingCandidates: uniqueValues(slopeRatingCandidates),
  };
}

export function extractScorecardHoleSuggestions(result: ScorecardOcrResult | null): ScorecardHoleSuggestions {
  if (!result) {
    return {
      holes: [],
      yardageCount: 0,
      parCount: 0,
      strokeIndexCount: 0,
    };
  }

  const numericLines = result.lines
    .map((line, index) => ({ index, text: line.text, values: extractIntegers(line.text) }))
    .filter((line) => line.values.length >= 3);

  const holeRows = numericLines
    .map((line) => ({ ...line, holeSequence: matchHoleSequence(line.values) }))
    .filter((line): line is NumericLine & { holeSequence: HoleSequenceMatch } => line.holeSequence !== null);

  const usedLines = new Set<number>();
  const holeMap = new Map<number, ScorecardParsedHole>();

  holeRows.forEach((holeRow) => {
    const holeNumbers = holeRow.holeSequence.holeNumbers;
    const holeCount = holeNumbers.length;
    const yardageLine = pickNearbyLine(
      numericLines,
      usedLines,
      holeRow.index,
      holeCount,
      (values) => isYardageRow(values, holeCount),
      hasYardageLabel,
    );
    const parLine = pickNearbyLine(
      numericLines,
      usedLines,
      holeRow.index,
      holeCount,
      (values) => isParRow(values, holeCount),
      hasParLabel,
    );
    const strokeIndexLine = pickNearbyLine(
      numericLines,
      usedLines,
      holeRow.index,
      holeCount,
      (values) => isStrokeIndexRow(values, holeCount),
      hasStrokeIndexLabel,
    );

    if (yardageLine) {
      usedLines.add(yardageLine.index);
    }
    if (parLine) {
      usedLines.add(parLine.index);
    }
    if (strokeIndexLine) {
      usedLines.add(strokeIndexLine.index);
    }

    holeNumbers.forEach((holeNumber, position) => {
      const current = holeMap.get(holeNumber) ?? {
        number: holeNumber,
        yardage: null,
        par: null,
        strokeIndex: null,
      };

      holeMap.set(holeNumber, {
        number: holeNumber,
        yardage: current.yardage ?? yardageLine?.values[position] ?? null,
        par: current.par ?? parLine?.values[position] ?? null,
        strokeIndex: current.strokeIndex ?? strokeIndexLine?.values[position] ?? null,
      });
    });
  });

  const holes = [...holeMap.values()].sort((a, b) => a.number - b.number);

  return {
    holes,
    yardageCount: holes.filter((hole) => hole.yardage !== null).length,
    parCount: holes.filter((hole) => hole.par !== null).length,
    strokeIndexCount: holes.filter((hole) => hole.strokeIndex !== null).length,
  };
}
