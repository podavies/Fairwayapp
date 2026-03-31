import type { ScorecardOcrBounds, ScorecardOcrLine, ScorecardOcrResult } from "../modules";

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

type TeeAudienceToken = "men" | "ladies";

type OrderedRatingTriplet = {
  index: number;
  teeToken: string | null;
  audienceToken: TeeAudienceToken | null;
  rating: string;
  slope: string;
};

type SplitSideTeeToken = "white" | "yellow" | "red";
type SplitSideTeeSelection = {
  teeToken: SplitSideTeeToken;
  audienceToken: TeeAudienceToken | null;
};

type BoundedScorecardOcrLine = ScorecardOcrLine & {
  bounds: ScorecardOcrBounds;
};

const splitSideHoleAnchorMaxX = 0.34;
const knownTeeWords = [
  "white",
  "yellow",
  "blue",
  "red",
  "green",
  "black",
  "orange",
  "purple",
  "silver",
  "gold",
  "bronze",
  "men",
  "mens",
  "women",
  "ladies",
  "championship",
  "visitor",
];
const defaultTeeColumnOrder = ["white", "yellow", "blue", "red"];

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function lineMidY(line: BoundedScorecardOcrLine) {
  return line.bounds.y + line.bounds.height / 2;
}

function unionBounds(lines: BoundedScorecardOcrLine[]): ScorecardOcrBounds {
  const minX = Math.min(...lines.map((line) => line.bounds.x));
  const minY = Math.min(...lines.map((line) => line.bounds.y));
  const maxX = Math.max(...lines.map((line) => line.bounds.x + line.bounds.width));
  const maxY = Math.max(...lines.map((line) => line.bounds.y + line.bounds.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function clusterBoundedLinesIntoRows(lines: BoundedScorecardOcrLine[]) {
  const sorted = [...lines].sort((a, b) => {
    const yDelta = lineMidY(b) - lineMidY(a);
    if (Math.abs(yDelta) > 0.012) {
      return yDelta;
    }
    return a.bounds.x - b.bounds.x;
  });

  const rows: BoundedScorecardOcrLine[][] = [];
  sorted.forEach((line) => {
    const midY = lineMidY(line);
    const rowIndex = rows.findIndex((row) => {
      const rowMidY = average(row.map(lineMidY));
      const rowHeight = average(row.map((item) => item.bounds.height));
      return Math.abs(midY - rowMidY) <= Math.max(0.018, rowHeight * 1.4);
    });

    if (rowIndex >= 0) {
      rows[rowIndex].push(line);
      return;
    }

    rows.push([line]);
  });

  return rows;
}

function groupBoundedLinesIntoRows(result: ScorecardOcrResult): ScorecardOcrResult | null {
  const boundedLines = boundedLinesFromResult(result);
  if (boundedLines.length < 12) {
    return null;
  }

  const rows = clusterBoundedLinesIntoRows(boundedLines);
  const groupedLines = rows
    .map((row): BoundedScorecardOcrLine | null => {
      const ordered = [...row].sort((a, b) => a.bounds.x - b.bounds.x);
      const text = ordered
        .map((line) => normalizeCandidate(line.text))
        .filter(Boolean)
        .join(" ");
      if (!text) {
        return null;
      }

      return {
        text,
        confidence: average(ordered.map((line) => line.confidence)),
        bounds: unionBounds(ordered),
        candidates: uniqueValues(ordered.flatMap((line) => line.candidates).filter(Boolean)),
      };
    })
    .filter((line): line is BoundedScorecardOcrLine => Boolean(line))
    .sort((a, b) => {
      const aMidY = a.bounds.y + a.bounds.height / 2;
      const bMidY = b.bounds.y + b.bounds.height / 2;
      if (Math.abs(bMidY - aMidY) > 0.012) {
        return bMidY - aMidY;
      }
      return a.bounds.x - b.bounds.x;
    });

  if (groupedLines.length < 6) {
    return null;
  }

  return {
    platform: `${result.platform}-grouped`,
    fullText: groupedLines.map((line) => line.text).join("\n"),
    lines: groupedLines,
  };
}

function candidateResults(result: ScorecardOcrResult | null) {
  if (!result) {
    return [];
  }

  const grouped = groupBoundedLinesIntoRows(result);
  return grouped ? [result, grouped] : [result];
}

function boundedLinesFromResult(result: ScorecardOcrResult) {
  return result.lines.filter(
    (line): line is BoundedScorecardOcrLine => !!line.bounds && normalizeCandidate(line.text).length > 0,
  );
}

function parseHoleAnchorValue(source: string) {
  const normalized = normalizeCandidate(source);
  const digitMatch = normalized.match(/^\D*(\d{1,2})\D*$/);
  if (!digitMatch) {
    return null;
  }

  const holeNumber = Number.parseInt(digitMatch[1], 10);
  return holeNumber >= 1 && holeNumber <= 18 ? holeNumber : null;
}

function boundedRowValues(row: BoundedScorecardOcrLine[]) {
  return [...row]
    .sort((a, b) => a.bounds.x - b.bounds.x)
    .flatMap((line) => extractIntegers(normalizeCandidate(line.text)));
}

function rowHoleAnchor(row: BoundedScorecardOcrLine[]) {
  const ordered = [...row].sort((a, b) => a.bounds.x - b.bounds.x);
  const anchors = ordered
    .map((line) => ({
      line,
      holeNumber: parseHoleAnchorValue(line.text),
    }))
    .filter((item): item is { line: BoundedScorecardOcrLine; holeNumber: number } => item.holeNumber !== null);

  if (!anchors.length) {
    return null;
  }

  const anchor = anchors[0];
  return anchor.line.bounds.x <= splitSideHoleAnchorMaxX ? anchor : null;
}

function boundedRows(result: ScorecardOcrResult) {
  const lines = boundedLinesFromResult(result);
  if (lines.length < 12) {
    return [];
  }

  return clusterBoundedLinesIntoRows(lines);
}

function splitSideTeeSelection(selectedTeeName?: string): SplitSideTeeSelection | null {
  const token = canonicalizeTeeName(selectedTeeName);
  if (token !== "white" && token !== "yellow" && token !== "red") {
    return null;
  }

  return {
    teeToken: token,
    audienceToken: audienceTokenFromSelection(selectedTeeName),
  };
}

function mergedParStrokeValue(value: number | undefined) {
  if (value == null) {
    return null;
  }

  const digits = `${value}`;
  if (digits.length < 2 || digits.length > 3) {
    return null;
  }

  const par = Number.parseInt(digits[0], 10);
  const strokeIndex = Number.parseInt(digits.slice(1), 10);
  if (!isParValue(par) || !isStrokeIndexValue(strokeIndex)) {
    return null;
  }

  return {
    par,
    strokeIndex,
  };
}

function dualParValue(value: number | undefined) {
  if (value == null) {
    return null;
  }

  const digits = `${value}`;
  if (digits.length !== 2) {
    return null;
  }

  const redPar = Number.parseInt(digits[0], 10);
  const yellowLadiesPar = Number.parseInt(digits[1], 10);
  if (!isParValue(redPar) || !isParValue(yellowLadiesPar)) {
    return null;
  }

  return {
    redPar,
    yellowLadiesPar,
  };
}

function altParStrokeValue(value: number | undefined) {
  if (value == null) {
    return null;
  }

  const digits = `${value}`;
  if (digits.length !== 2) {
    return null;
  }

  const par = Number.parseInt(digits[0], 10);
  const strokeIndex = Number.parseInt(digits[1], 10);
  if (!isParValue(par) || !isStrokeIndexValue(strokeIndex)) {
    return null;
  }

  return {
    par,
    strokeIndex,
  };
}

function audienceTokenFromLine(source: string): TeeAudienceToken | null {
  const lower = source.toLowerCase();
  if (/^\s*l\b/.test(lower) || /\b(?:ladies|lady|women|women's|womens)\b/.test(lower)) {
    return "ladies";
  }
  if (/^\s*m\b/.test(lower) || /\b(?:men|men's|mens|gent|gents)\b/.test(lower)) {
    return "men";
  }
  return null;
}

function audienceTokenFromSelection(source?: string | null): TeeAudienceToken | null {
  const lower = source?.toLowerCase() ?? "";
  if (/\b(?:ladies|lady|women|women's|womens)\b/.test(lower)) {
    return "ladies";
  }
  if (/\b(?:men|men's|mens|gent|gents)\b/.test(lower)) {
    return "men";
  }
  return null;
}

function orderedRatingTripletsFromSources(sources: string[], firstHoleRowIndex: number) {
  const orderedRatingTriplets: OrderedRatingTriplet[] = [];

  sources.forEach((source, index) => {
    const normalizedSource = normalizeCandidate(source);
    const lower = normalizedSource.toLowerCase();
    const isPreTable = index >= 0 && index < (firstHoleRowIndex >= 0 ? firstHoleRowIndex : Math.min(sources.length, 6));

    if (!isPreTable) {
      return;
    }

    const orderedTripletMatch = normalizedSource.match(/(?:^|[A-Za-z]\s+)(\d{2})\s+(\d{2}\.\d)\s+(\d{2,3})(?:\b|$)/);
    if (!orderedTripletMatch) {
      return;
    }

    const par = Number.parseInt(orderedTripletMatch[1], 10);
    const ratingValue = orderedTripletMatch[2];
    const slopeValue = orderedTripletMatch[3];
    const rating = Number.parseFloat(ratingValue);
    const slope = Number.parseInt(slopeValue, 10);
    const teeTokens = lineTeeTokens(lower);

    if (
      Number.isNaN(par) ||
      par < 54 ||
      par > 75 ||
      Number.isNaN(rating) ||
      rating < 55 ||
      rating > 80 ||
      Number.isNaN(slope) ||
      slope < 55 ||
      slope > 155
    ) {
      return;
    }

    orderedRatingTriplets.push({
      index,
      teeToken: teeTokens[0] ?? null,
      audienceToken: audienceTokenFromLine(normalizedSource),
      rating: ratingValue,
      slope: slopeValue,
    });
  });

  return orderedRatingTriplets;
}

function inferredSplitSideTeeNames(orderedRatingTriplets: OrderedRatingTriplet[]) {
  if (
    orderedRatingTriplets.length >= 4 &&
    orderedRatingTriplets[0]?.audienceToken === "men" &&
    orderedRatingTriplets[1]?.audienceToken === "men" &&
    orderedRatingTriplets[2]?.audienceToken === "ladies" &&
    orderedRatingTriplets[3]?.audienceToken === "ladies"
  ) {
    return ["White Men", "Yellow Men", "Yellow Ladies", "Red Ladies"];
  }

  if (
    orderedRatingTriplets.length >= 3 &&
    orderedRatingTriplets[0]?.audienceToken === "men" &&
    orderedRatingTriplets[1]?.audienceToken === "men" &&
    orderedRatingTriplets[2]?.audienceToken === "ladies"
  ) {
    return ["White Men", "Yellow Men", "Red Ladies"];
  }

  return [];
}

function pickOrderedRatingTriplet(
  orderedRatingTriplets: OrderedRatingTriplet[],
  selectedTeeToken: string | null,
  selectedAudienceToken: TeeAudienceToken | null,
) {
  const explicitOrderedTriplet = orderedRatingTriplets.find(
    (triplet) =>
      triplet.teeToken &&
      (!selectedTeeToken || triplet.teeToken === selectedTeeToken) &&
      (!selectedAudienceToken || !triplet.audienceToken || triplet.audienceToken === selectedAudienceToken),
  );

  if (explicitOrderedTriplet) {
    return explicitOrderedTriplet;
  }

  if (!selectedTeeToken || orderedRatingTriplets.length < 3) {
    return null;
  }

  const orderedIndex =
    selectedTeeToken === "white"
      ? 0
      : selectedTeeToken === "yellow"
        ? selectedAudienceToken === "ladies" && orderedRatingTriplets.length >= 4
          ? 2
          : 1
        : selectedTeeToken === "blue"
          ? Math.min(2, orderedRatingTriplets.length - 1)
          : orderedRatingTriplets.length - 1;

  return orderedRatingTriplets[orderedIndex] ?? null;
}

function parseSplitSideRightBlock(values: number[]) {
  const redYardage = values[0];
  if (!isYardageValue(redYardage)) {
    return {
      rightRedYardage: null,
      rightPar: null,
      yellowLadiesPar: null,
      rightStrokeIndex: null,
    };
  }

  if (isParValue(values[1]) && isParValue(values[2]) && isStrokeIndexValue(values[3])) {
    return {
      rightRedYardage: redYardage,
      rightPar: values[1],
      yellowLadiesPar: values[2],
      rightStrokeIndex: values[3],
    };
  }

  const mergedDualPar = dualParValue(values[1]);
  if (mergedDualPar && isStrokeIndexValue(values[2])) {
    return {
      rightRedYardage: redYardage,
      rightPar: mergedDualPar.redPar,
      yellowLadiesPar: mergedDualPar.yellowLadiesPar,
      rightStrokeIndex: values[2],
    };
  }

  if (isParValue(values[1])) {
    const mergedAltParStroke = altParStrokeValue(values[2]);
    if (mergedAltParStroke) {
      return {
        rightRedYardage: redYardage,
        rightPar: values[1],
        yellowLadiesPar: mergedAltParStroke.par,
        rightStrokeIndex: mergedAltParStroke.strokeIndex,
      };
    }
  }

  if (isParValue(values[1]) && isStrokeIndexValue(values[2])) {
    return {
      rightRedYardage: redYardage,
      rightPar: values[1],
      yellowLadiesPar: values[1],
      rightStrokeIndex: values[2],
    };
  }

  if (isParValue(values[1])) {
    return {
      rightRedYardage: redYardage,
      rightPar: values[1],
      yellowLadiesPar: values[1],
      rightStrokeIndex: values[1],
    };
  }

  const mergedRightParStroke = mergedParStrokeValue(values[1]);
  if (mergedRightParStroke) {
    return {
      rightRedYardage: redYardage,
      rightPar: mergedRightParStroke.par,
      yellowLadiesPar: mergedRightParStroke.par,
      rightStrokeIndex: mergedRightParStroke.strokeIndex,
    };
  }

  return {
    rightRedYardage: null,
    rightPar: null,
    yellowLadiesPar: null,
    rightStrokeIndex: null,
  };
}

function parseSplitSideRowValues(
  holeNumber: number,
  rest: number[],
  selectedTeeSelection: SplitSideTeeSelection,
): ScorecardParsedHole | null {
  const leftWhiteYardage = rest[0];
  const leftYellowYardage = rest[1];
  const leftBlockSupported =
    isYardageValue(leftWhiteYardage) &&
    isYardageValue(leftYellowYardage) &&
    leftWhiteYardage !== leftYellowYardage;
  let cursor = 2;
  let leftPar: number | null = null;
  let leftStrokeIndex: number | null = null;

  if (leftBlockSupported && isParValue(rest[cursor])) {
    leftPar = rest[cursor];
    cursor += 1;

    if (isStrokeIndexValue(rest[cursor]) && !isYardageValue(rest[cursor])) {
      leftStrokeIndex = rest[cursor];
      cursor += 1;
    } else if (isYardageValue(rest[cursor])) {
      leftStrokeIndex = leftPar;
    }
  } else {
    const mergedLeftParStroke = mergedParStrokeValue(rest[cursor]);
    if (leftBlockSupported && mergedLeftParStroke != null && isYardageValue(rest[cursor + 1])) {
      leftPar = mergedLeftParStroke.par;
      leftStrokeIndex = mergedLeftParStroke.strokeIndex;
      cursor += 1;
    }
  }

  const parsedRightBlock = parseSplitSideRightBlock(rest.slice(cursor));
  const fallbackRightBlock = parseSplitSideRightBlock(rest);
  const rightRedYardage = parsedRightBlock.rightRedYardage ?? fallbackRightBlock.rightRedYardage;
  const rightPar = parsedRightBlock.rightPar ?? fallbackRightBlock.rightPar;
  const yellowLadiesPar = parsedRightBlock.yellowLadiesPar ?? fallbackRightBlock.yellowLadiesPar;
  const rightStrokeIndex = parsedRightBlock.rightStrokeIndex ?? fallbackRightBlock.rightStrokeIndex;

  return selectedTeeSelection.teeToken === "white" && leftBlockSupported && leftPar != null && leftStrokeIndex != null
    ? {
        number: holeNumber,
        yardage: leftWhiteYardage,
        par: leftPar,
        strokeIndex: leftStrokeIndex,
      }
    : selectedTeeSelection.teeToken === "yellow" &&
        selectedTeeSelection.audienceToken !== "ladies" &&
        leftBlockSupported &&
        leftPar != null &&
        leftStrokeIndex != null
      ? {
          number: holeNumber,
          yardage: leftYellowYardage,
          par: leftPar,
          strokeIndex: leftStrokeIndex,
        }
      : selectedTeeSelection.teeToken === "yellow" &&
          selectedTeeSelection.audienceToken === "ladies" &&
          isYardageValue(leftYellowYardage) &&
          rightPar != null &&
          rightStrokeIndex != null
        ? {
            number: holeNumber,
            yardage: leftYellowYardage,
            par: yellowLadiesPar ?? rightPar,
            strokeIndex: rightStrokeIndex,
          }
        : selectedTeeSelection.teeToken === "red" && rightRedYardage != null && rightPar != null && rightStrokeIndex != null
        ? {
            number: holeNumber,
            yardage: rightRedYardage,
            par: rightPar,
            strokeIndex: rightStrokeIndex,
          }
        : null;
}

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

function distinctCount(values: number[]) {
  return new Set(values).size;
}

function summarizeHoleSuggestions(holes: ScorecardParsedHole[]): ScorecardHoleSuggestions {
  const sortedHoles = [...holes].sort((a, b) => a.number - b.number);
  return {
    holes: sortedHoles,
    yardageCount: sortedHoles.filter((hole) => hole.yardage !== null).length,
    parCount: sortedHoles.filter((hole) => hole.par !== null).length,
    strokeIndexCount: sortedHoles.filter((hole) => hole.strokeIndex !== null).length,
  };
}

function mergeHoleSuggestions(...suggestions: ScorecardHoleSuggestions[]) {
  const holeMap = new Map<number, ScorecardParsedHole>();

  suggestions.forEach((suggestion) => {
    suggestion.holes.forEach((hole) => {
      const current = holeMap.get(hole.number);
      if (!current) {
        holeMap.set(hole.number, { ...hole });
        return;
      }

      holeMap.set(hole.number, {
        number: hole.number,
        yardage: current.yardage ?? hole.yardage,
        par: current.par ?? hole.par,
        strokeIndex: current.strokeIndex ?? hole.strokeIndex,
      });
    });
  });

  return summarizeHoleSuggestions([...holeMap.values()]);
}

function canonicalizeTeeName(source?: string | null) {
  const lower = source?.toLowerCase() ?? "";
  return knownTeeWords.find((word) => lower.includes(word)) ?? null;
}

function lineTeeTokens(source: string) {
  const lower = source.toLowerCase();
  return defaultTeeColumnOrder.filter((word) => lower.includes(word));
}

function resolveTeeColumnOrderFromHeader(source: string) {
  const lower = source.toLowerCase();
  const matches = [...lower.matchAll(/\b(white|yellow|blue|red)\b/g)].map((match) => match[1]);
  return matches.length >= 2 ? uniqueValues(matches) : null;
}

function isParValue(value: number | undefined) {
  return value != null && value >= 3 && value <= 6;
}

function isStrokeIndexValue(value: number | undefined) {
  return value != null && value >= 1 && value <= 18;
}

function isYardageValue(value: number | undefined) {
  return value != null && value >= 50 && value <= 700;
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
  const slice = values.slice(0, holeCount);
  return (
    slice.length >= holeCount &&
    slice.every((value) => value >= 3 && value <= 6) &&
    distinctCount(slice) >= 2
  );
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
  return (
    slice.length >= holeCount &&
    slice.every((value) => value >= 50 && value <= 700) &&
    distinctCount(slice) >= Math.min(holeCount, 5)
  );
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
  sourceOffset: number,
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
        offsetDelta: Math.abs(windowMatch.offset - sourceOffset),
        distance: Math.abs(line.index - sourceIndex),
        hasLabel: labelMatcher ? labelMatcher(line.text) : false,
      };
    })
    .filter((line): line is NumericLine & {
      offset: number;
      offsetDelta: number;
      distance: number;
      hasLabel: boolean;
    } => line !== null)
    .sort(
      (a, b) =>
        Number(b.hasLabel) - Number(a.hasLabel) ||
        a.offsetDelta - b.offsetDelta ||
        a.distance - b.distance ||
        a.offset - b.offset,
    );

  return nearby[0] ?? null;
}

function extractScorecardNameSuggestionsFromResult(result: ScorecardOcrResult): ScorecardNameSuggestions {
  const ignoredTeeNames = /^(?:hole|holes|yd|yds|yard|yards|par|stroke|stroke index|index|s\.?\s*i\.?|si|out|in|total)$/i;
  const lines = result.lines
    .map((line) => normalizeCandidate(line.text))
    .filter(Boolean);
  const firstHoleRowIndex = lines.findIndex((line) => contiguousHoleSequence(extractIntegers(line)));
  const preTableLines = lines.slice(0, firstHoleRowIndex >= 0 ? firstHoleRowIndex : Math.min(lines.length, 6));
  const orderedRatingTriplets = orderedRatingTripletsFromSources(lines, firstHoleRowIndex);

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

  teeNameCandidates.push(...inferredSplitSideTeeNames(orderedRatingTriplets));

  return {
    courseNameCandidates: uniqueValues(courseNameCandidates),
    teeNameCandidates: uniqueValues(teeNameCandidates),
  };
}

export function extractScorecardNameSuggestions(result: ScorecardOcrResult | null): ScorecardNameSuggestions {
  if (!result) {
    return {
      courseNameCandidates: [],
      teeNameCandidates: [],
    };
  }

  const suggestions = candidateResults(result).map((candidate) => extractScorecardNameSuggestionsFromResult(candidate));

  return {
    courseNameCandidates: uniqueValues(suggestions.flatMap((candidate) => candidate.courseNameCandidates)),
    teeNameCandidates: uniqueValues(suggestions.flatMap((candidate) => candidate.teeNameCandidates)),
  };
}

function extractScorecardOcrHintsFromResult(result: ScorecardOcrResult, selectedTeeName?: string): ScorecardOcrHints {
  const courseRatingCandidates: string[] = [];
  const slopeRatingCandidates: string[] = [];
  const sources = result.lines.map((line) => line.text);
  const firstHoleRowIndex = sources.findIndex((line) => contiguousHoleSequence(extractIntegers(line)));
  const selectedTeeToken = canonicalizeTeeName(selectedTeeName);
  const selectedAudienceToken = audienceTokenFromSelection(selectedTeeName);
  const orderedRatingTriplets = orderedRatingTripletsFromSources(sources, firstHoleRowIndex);

  sources.forEach((source, index) => {
    const normalizedSource = normalizeCandidate(source);
    const lower = normalizedSource.toLowerCase();
    const isPreTable = index >= 0 && index < (firstHoleRowIndex >= 0 ? firstHoleRowIndex : Math.min(sources.length, 6));
    const teeTokens = lineTeeTokens(lower);
    const hasKnownTeeWord = teeTokens.length > 0;
    const matchesSelectedTee = !selectedTeeToken || teeTokens.length === 0 || teeTokens.includes(selectedTeeToken);
    const ratingMatches = source.matchAll(/(?:course\s*rating|c\/?r|cr|rating)\s*[:\-]?\s*(\d{2}\.\d)/gi);
    if (matchesSelectedTee) {
      for (const match of ratingMatches) {
        const value = match[1];
        const rating = Number.parseFloat(value);
        if (!Number.isNaN(rating) && rating >= 55 && rating <= 80) {
          courseRatingCandidates.push(value);
        }
      }
    }

    const slopeMatches = source.matchAll(/(?:slope(?:\s*rating)?|sr)\s*[:\-]?\s*(\d{2,3})/gi);
    if (matchesSelectedTee) {
      for (const match of slopeMatches) {
        const value = match[1];
        const slope = Number.parseInt(value, 10);
        if (!Number.isNaN(slope) && slope >= 55 && slope <= 155) {
          slopeRatingCandidates.push(value);
        }
      }
    }

    const pairedMatches = source.matchAll(/(\d{2}\.\d)\s*(?:\/|\||-|\s)\s*(\d{2,3})/g);
    if (isPreTable && hasKnownTeeWord && matchesSelectedTee) {
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
    }
  });

  const orderedTriplet = pickOrderedRatingTriplet(orderedRatingTriplets, selectedTeeToken, selectedAudienceToken);
  if (orderedTriplet) {
    courseRatingCandidates.push(orderedTriplet.rating);
    slopeRatingCandidates.push(orderedTriplet.slope);
  }

  return {
    courseRatingCandidates: uniqueValues(courseRatingCandidates),
    slopeRatingCandidates: uniqueValues(slopeRatingCandidates),
  };
}

export function extractScorecardOcrHints(result: ScorecardOcrResult | null, selectedTeeName?: string): ScorecardOcrHints {
  if (!result) {
    return {
      courseRatingCandidates: [],
      slopeRatingCandidates: [],
    };
  }

  const hints = candidateResults(result).map((candidate) => extractScorecardOcrHintsFromResult(candidate, selectedTeeName));
  return {
    courseRatingCandidates: uniqueValues(hints.flatMap((candidate) => candidate.courseRatingCandidates)),
    slopeRatingCandidates: uniqueValues(hints.flatMap((candidate) => candidate.slopeRatingCandidates)),
  };
}

function extractBoundedSplitSideHoleSuggestions(result: ScorecardOcrResult, selectedTeeName?: string): ScorecardHoleSuggestions {
  const selectedTeeSelection = splitSideTeeSelection(selectedTeeName);
  if (!selectedTeeSelection) {
    return {
      holes: [],
      yardageCount: 0,
      parCount: 0,
        strokeIndexCount: 0,
    };
  }

  const lines = boundedLinesFromResult(result);
  const holeAnchors = lines
    .map((line) => ({
      line,
      holeNumber: parseHoleAnchorValue(line.text),
    }))
    .filter((item): item is { line: BoundedScorecardOcrLine; holeNumber: number } => item.holeNumber !== null)
    .filter((item) => item.line.bounds.x <= splitSideHoleAnchorMaxX)
    .sort((a, b) => lineMidY(b.line) - lineMidY(a.line) || a.line.bounds.x - b.line.bounds.x);
  const holeMap = new Map<number, ScorecardParsedHole>();

  holeAnchors.forEach((anchor) => {
    const rowLines = lines
      .filter(
        (line) =>
          Math.abs(lineMidY(line) - lineMidY(anchor.line)) <= Math.max(0.015, anchor.line.bounds.height * 0.75) &&
          line.bounds.x >= anchor.line.bounds.x - 0.01,
      )
      .sort((a, b) => a.bounds.x - b.bounds.x);
    const values = rowLines.flatMap((line) => extractIntegers(normalizeCandidate(line.text)));
    const holeIndex = values.indexOf(anchor.holeNumber);
    if (holeIndex < 0) {
      return;
    }

    const parsedHole = parseSplitSideRowValues(anchor.holeNumber, values.slice(holeIndex + 1), selectedTeeSelection);

    if (parsedHole) {
      holeMap.set(anchor.holeNumber, parsedHole);
    }
  });

  return summarizeHoleSuggestions([...holeMap.values()]);
}

function extractSplitSideHoleSuggestions(result: ScorecardOcrResult, selectedTeeName?: string): ScorecardHoleSuggestions {
  const selectedTeeSelection = splitSideTeeSelection(selectedTeeName);
  if (!selectedTeeSelection) {
    return {
      holes: [],
      yardageCount: 0,
      parCount: 0,
      strokeIndexCount: 0,
    };
  }

  const holeMap = new Map<number, ScorecardParsedHole>();

  result.lines.forEach((line) => {
    const normalized = normalizeCandidate(line.text);
    const values = extractIntegers(normalized);
    const holeNumber = values[0];
    if (holeNumber == null) {
      return;
    }

    if (Number.isNaN(holeNumber) || holeNumber < 1 || holeNumber > 18) {
      return;
    }

    const parsedHole = parseSplitSideRowValues(holeNumber, values.slice(1), selectedTeeSelection);
    if (parsedHole) {
      holeMap.set(holeNumber, parsedHole);
    }
  });

  return summarizeHoleSuggestions([...holeMap.values()]);
}

function extractColumnRowHoleSuggestions(result: ScorecardOcrResult, selectedTeeName?: string): ScorecardHoleSuggestions {
  const selectedTeeToken = canonicalizeTeeName(selectedTeeName) ?? defaultTeeColumnOrder[0];
  const headerOrder =
    result.lines
      .map((line) => resolveTeeColumnOrderFromHeader(line.text))
      .find((value): value is string[] => value !== null) ?? defaultTeeColumnOrder;
  const teeColumnIndex = Math.max(0, headerOrder.indexOf(selectedTeeToken));
  const holeMap = new Map<number, ScorecardParsedHole>();

  result.lines.forEach((line) => {
    const normalized = normalizeCandidate(line.text);
    const holeMatch = normalized.match(/^(\d{1,2})\b/);
    if (!holeMatch) {
      return;
    }

    const holeNumber = Number.parseInt(holeMatch[1], 10);
    if (Number.isNaN(holeNumber) || holeNumber < 1 || holeNumber > 18) {
      return;
    }

    const values = extractIntegers(normalized);
    if (values[0] !== holeNumber) {
      return;
    }

    const rest = values.slice(1);
    if (rest.length < headerOrder.length + 2) {
      return;
    }

    const teeYardages = rest.slice(0, headerOrder.length);
    const par = rest[headerOrder.length];
    const strokeIndex = rest[headerOrder.length + 1];
    const yardage = teeYardages[teeColumnIndex] ?? null;

    if (
      yardage == null ||
      yardage < 50 ||
      yardage > 700 ||
      par < 3 ||
      par > 6 ||
      strokeIndex < 1 ||
      strokeIndex > 18 ||
      (teeYardages.length > 1 && distinctCount(teeYardages) === 1)
    ) {
      return;
    }

    holeMap.set(holeNumber, {
      number: holeNumber,
      yardage,
      par,
      strokeIndex,
    });
  });

  return summarizeHoleSuggestions([...holeMap.values()]);
}

function extractNumericSequenceHoleSuggestions(result: ScorecardOcrResult): ScorecardHoleSuggestions {
  const numericLines = result.lines
    .map((line, index) => ({ index, text: line.text, values: extractIntegers(line.text) }))
    .filter((line) => line.values.length >= 3);

  const holeRows = numericLines
    .map((line) => ({ ...line, holeSequence: matchHoleSequence(line.values) }))
    .filter((line): line is NumericLine & { holeSequence: HoleSequenceMatch } => line.holeSequence !== null);
  const holeRowIndexes = new Set(holeRows.map((line) => line.index));
  const dataLines = numericLines.filter((line) => !holeRowIndexes.has(line.index));

  const usedLines = new Set<number>();
  const holeMap = new Map<number, ScorecardParsedHole>();

  holeRows.forEach((holeRow) => {
    const holeNumbers = holeRow.holeSequence.holeNumbers;
    const holeCount = holeNumbers.length;
    const yardageLine = pickNearbyLine(
      dataLines,
      usedLines,
      holeRow.index,
      holeRow.holeSequence.offset,
      holeCount,
      (values) => isYardageRow(values, holeCount),
      hasYardageLabel,
    );
    const parLine = pickNearbyLine(
      dataLines,
      usedLines,
      holeRow.index,
      holeRow.holeSequence.offset,
      holeCount,
      (values) => isParRow(values, holeCount),
      hasParLabel,
    );
    const strokeIndexLine = pickNearbyLine(
      dataLines,
      usedLines,
      holeRow.index,
      holeRow.holeSequence.offset,
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
      const nextYardage = current.yardage ?? yardageLine?.values[position] ?? null;
      const nextPar = current.par ?? parLine?.values[position] ?? null;
      const nextStrokeIndex = current.strokeIndex ?? strokeIndexLine?.values[position] ?? null;

      if (nextYardage === null && nextPar === null && nextStrokeIndex === null) {
        return;
      }

      holeMap.set(holeNumber, {
        number: holeNumber,
        yardage: nextYardage,
        par: nextPar,
        strokeIndex: nextStrokeIndex,
      });
    });
  });

  return summarizeHoleSuggestions([...holeMap.values()]);
}

function extractScorecardHoleSuggestionsFromResult(result: ScorecardOcrResult, selectedTeeName?: string): ScorecardHoleSuggestions {
  const boundedSplitSideSuggestions = extractBoundedSplitSideHoleSuggestions(result, selectedTeeName);
  const splitSideSuggestions = extractSplitSideHoleSuggestions(result, selectedTeeName);
  const columnRowSuggestions = extractColumnRowHoleSuggestions(result, selectedTeeName);
  const numericSequenceSuggestions = extractNumericSequenceHoleSuggestions(result);

  const mergedSuggestions = mergeHoleSuggestions(
    boundedSplitSideSuggestions,
    splitSideSuggestions,
    columnRowSuggestions,
    numericSequenceSuggestions,
  );

  return [
    mergedSuggestions,
    boundedSplitSideSuggestions,
    splitSideSuggestions,
    columnRowSuggestions,
    numericSequenceSuggestions,
  ].sort(compareHoleSuggestionQuality)[0] ?? {
    holes: [],
    yardageCount: 0,
    parCount: 0,
    strokeIndexCount: 0,
  };
}

function compareHoleSuggestionQuality(a: ScorecardHoleSuggestions, b: ScorecardHoleSuggestions) {
  return (
    b.holes.length - a.holes.length ||
    b.yardageCount - a.yardageCount ||
    b.parCount - a.parCount ||
    b.strokeIndexCount - a.strokeIndexCount
  );
}

export function extractScorecardHoleSuggestions(result: ScorecardOcrResult | null, selectedTeeName?: string): ScorecardHoleSuggestions {
  if (!result) {
    return {
      holes: [],
      yardageCount: 0,
      parCount: 0,
      strokeIndexCount: 0,
    };
  }

  const suggestions = candidateResults(result)
    .map((candidate) => extractScorecardHoleSuggestionsFromResult(candidate, selectedTeeName))
    .sort(compareHoleSuggestionQuality);
  const mergedSuggestions = mergeHoleSuggestions(...suggestions);

  return [mergedSuggestions, ...suggestions].sort(compareHoleSuggestionQuality)[0] ?? {
    holes: [],
    yardageCount: 0,
    parCount: 0,
    strokeIndexCount: 0,
  };
}
