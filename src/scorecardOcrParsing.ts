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
  values: number[];
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
  if (values.length < 9) {
    return null;
  }

  const firstNine = values.slice(0, 9);
  if (firstNine.every((value, index) => value === firstNine[0] + index) && (firstNine[0] === 1 || firstNine[0] === 10)) {
    return firstNine;
  }

  const firstEighteen = values.slice(0, 18);
  if (firstEighteen.length === 18 && firstEighteen.every((value, index) => value === index + 1)) {
    return firstEighteen;
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

function pickNearbyLine(
  numericLines: NumericLine[],
  usedLines: Set<number>,
  sourceIndex: number,
  matcher: (values: number[]) => boolean,
) {
  const nearby = numericLines
    .filter((line) => !usedLines.has(line.index) && line.index !== sourceIndex && Math.abs(line.index - sourceIndex) <= 4)
    .sort((a, b) => Math.abs(a.index - sourceIndex) - Math.abs(b.index - sourceIndex));

  return nearby.find((line) => matcher(line.values)) ?? null;
}

export function extractScorecardNameSuggestions(result: ScorecardOcrResult | null): ScorecardNameSuggestions {
  if (!result) {
    return {
      courseNameCandidates: [],
      teeNameCandidates: [],
    };
  }

  const knownTeeWords = ["white", "yellow", "blue", "red", "green", "black", "orange", "purple", "silver", "gold", "bronze"];
  const lines = result.lines
    .map((line) => normalizeCandidate(line.text))
    .filter(Boolean);
  const numericLines = lines.map((line) => extractIntegers(line));
  const firstHoleRowIndex = numericLines.findIndex((values) => contiguousHoleSequence(values));
  const preTableLines = lines.slice(0, firstHoleRowIndex >= 0 ? firstHoleRowIndex : Math.min(lines.length, 6));

  const courseNameCandidates = preTableLines
    .filter((line) => {
      const lower = line.toLowerCase();
      const digitCount = (line.match(/\d/g) ?? []).length;
      return (
        /[a-z]/i.test(line) &&
        digitCount <= 1 &&
        !/(course\s*rating|c\/?r|cr|slope|par|stroke|index|yard|holes?|out|in|total)/i.test(lower)
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
    .filter((line) => line.length >= 3);

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
    .map((line, index) => ({ index, values: extractIntegers(line.text) }))
    .filter((line) => line.values.length >= 3);

  const holeRows = numericLines
    .map((line) => ({ ...line, holeNumbers: contiguousHoleSequence(line.values) }))
    .filter((line): line is NumericLine & { holeNumbers: number[] } => Array.isArray(line.holeNumbers));

  const usedLines = new Set<number>();
  const holeMap = new Map<number, ScorecardParsedHole>();

  holeRows.forEach((holeRow) => {
    const holeNumbers = holeRow.holeNumbers;
    const holeCount = holeNumbers.length;
    const yardageLine = pickNearbyLine(numericLines, usedLines, holeRow.index, (values) => isYardageRow(values, holeCount));
    const parLine = pickNearbyLine(numericLines, usedLines, holeRow.index, (values) => isParRow(values, holeCount));
    const strokeIndexLine = pickNearbyLine(numericLines, usedLines, holeRow.index, (values) => isStrokeIndexRow(values, holeCount));

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
