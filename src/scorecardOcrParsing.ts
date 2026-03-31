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

export type ScorecardAggregateTotal = {
  label: "out" | "in" | "total";
  holeNumbers: number[];
  yardageTotal: number | null;
  parTotal: number | null;
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

type SplitSideTotalsLabel = ScorecardAggregateTotal["label"];

type ParsedHoleMetricKey = "yardage" | "par";

type BoundedScorecardOcrLine = ScorecardOcrLine & {
  bounds: ScorecardOcrBounds;
};

const splitSideHoleAnchorMaxX = 0.34;
const genericScorecardLabelPattern =
  /\b(?:please indicate|competition|date|time|course handicap|handicap index|strokes?\s*rec'?d|distance markers?|player [a-d]\b|marker'?s score|player'?s score|review card|run again|view scorecard|remove photo|ocr preview|attach a scorecard|tap a detected value|blank fields mean|check the course|close)\b/i;
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
    } else if (
      leftBlockSupported &&
      isStrokeIndexValue(rest[cursor]) &&
      isParValue(rest[cursor + 1]) &&
      isYardageValue(rest[cursor + 2])
    ) {
      // OCR occasionally injects a stray stroke value before the left par cell.
      // Keep the reliable par and let later repair logic recover the stroke index if needed.
      leftPar = rest[cursor + 1];
      cursor += 2;
    }
  }

  const parsedRightBlock = parseSplitSideRightBlock(rest.slice(cursor));
  const fallbackRightBlock = parseSplitSideRightBlock(rest);
  const rightRedYardage = parsedRightBlock.rightRedYardage ?? fallbackRightBlock.rightRedYardage;
  const rightPar = parsedRightBlock.rightPar ?? fallbackRightBlock.rightPar;
  const yellowLadiesPar = parsedRightBlock.yellowLadiesPar ?? fallbackRightBlock.yellowLadiesPar;
  const rightStrokeIndex = parsedRightBlock.rightStrokeIndex ?? fallbackRightBlock.rightStrokeIndex;

  return selectedTeeSelection.teeToken === "white" && leftBlockSupported
    ? partialHoleSuggestion(
        holeNumber,
        isYardageValue(leftWhiteYardage) ? leftWhiteYardage : null,
        leftPar,
        leftStrokeIndex,
      )
    : selectedTeeSelection.teeToken === "yellow" &&
        selectedTeeSelection.audienceToken !== "ladies" &&
        leftBlockSupported
      ? partialHoleSuggestion(
          holeNumber,
          isYardageValue(leftYellowYardage) ? leftYellowYardage : null,
          leftPar,
          leftStrokeIndex,
        )
      : selectedTeeSelection.teeToken === "yellow" &&
          selectedTeeSelection.audienceToken === "ladies"
        ? partialHoleSuggestion(
            holeNumber,
            isYardageValue(leftYellowYardage) ? leftYellowYardage : null,
            yellowLadiesPar ?? rightPar,
            rightStrokeIndex,
          )
        : selectedTeeSelection.teeToken === "red"
        ? partialHoleSuggestion(holeNumber, rightRedYardage, rightPar, rightStrokeIndex)
        : null;
}

function partialHoleSuggestion(
  holeNumber: number,
  yardage: number | null,
  par: number | null,
  strokeIndex: number | null,
): ScorecardParsedHole | null {
  return yardage == null && par == null && strokeIndex == null
    ? null
    : {
        number: holeNumber,
        yardage,
        par,
        strokeIndex,
      };
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

function emptyHole(number: number): ScorecardParsedHole {
  return {
    number,
    yardage: null,
    par: null,
    strokeIndex: null,
  };
}

function isAggregateYardageValue(value: number | undefined, holeCount: number) {
  return value != null && value >= holeCount * 50 && value <= holeCount * 700;
}

function isAggregateParValue(value: number | undefined, holeCount: number) {
  return value != null && value >= holeCount * 3 && value <= holeCount * 6;
}

function holeNumbersForTotalsLabel(label: SplitSideTotalsLabel) {
  return label === "out"
    ? Array.from({ length: 9 }, (_, index) => index + 1)
    : label === "in"
      ? Array.from({ length: 9 }, (_, index) => index + 10)
      : Array.from({ length: 18 }, (_, index) => index + 1);
}

function parseSplitSideTotalsRow(source: string, selectedTeeSelection: SplitSideTeeSelection): ScorecardAggregateTotal | null {
  const normalized = normalizeCandidate(source);
  const labelMatch = normalized.match(/\b(out|in|total)\b/i);
  if (!labelMatch) {
    return null;
  }

  const label = labelMatch[1].toLowerCase() as SplitSideTotalsLabel;
  const holeNumbers = holeNumbersForTotalsLabel(label);
  const holeCount = holeNumbers.length;
  const values = extractIntegers(normalized);
  if (!values.length) {
    return null;
  }

  const leftWhiteYardageTotal = isAggregateYardageValue(values[0], holeCount) ? values[0] : null;
  const leftYellowYardageTotal = isAggregateYardageValue(values[1], holeCount) ? values[1] : null;
  const leftParTotal = isAggregateParValue(values[2], holeCount) ? values[2] : null;
  const rightRedYardageTotal = isAggregateYardageValue(values[3], holeCount) ? values[3] : null;
  const rightParTotal = isAggregateParValue(values[4], holeCount) ? values[4] : null;
  const yellowLadiesParTotal = isAggregateParValue(values[5], holeCount) ? values[5] : rightParTotal;

  const yardageTotal =
    selectedTeeSelection.teeToken === "white"
      ? leftWhiteYardageTotal
      : selectedTeeSelection.teeToken === "yellow"
        ? leftYellowYardageTotal
        : rightRedYardageTotal;
  const parTotal =
    selectedTeeSelection.teeToken === "red"
      ? rightParTotal
      : selectedTeeSelection.teeToken === "yellow" && selectedTeeSelection.audienceToken === "ladies"
        ? yellowLadiesParTotal
        : leftParTotal;

  if (yardageTotal == null && parTotal == null) {
    return null;
  }

  return {
    label,
    holeNumbers,
    yardageTotal,
    parTotal,
  };
}

function splitSideTotalsFromResult(result: ScorecardOcrResult, selectedTeeSelection: SplitSideTeeSelection) {
  const totalsByLabel = new Map<SplitSideTotalsLabel, ScorecardAggregateTotal>();

  result.lines.forEach((line) => {
    const parsed = parseSplitSideTotalsRow(line.text, selectedTeeSelection);
    if (!parsed) {
      return;
    }

    const current = totalsByLabel.get(parsed.label);
    const parsedScore = Number(parsed.yardageTotal != null) + Number(parsed.parTotal != null);
    const currentScore = current ? Number(current.yardageTotal != null) + Number(current.parTotal != null) : -1;
    if (!current || parsedScore > currentScore) {
      totalsByLabel.set(parsed.label, parsed);
    }
  });

  return [...totalsByLabel.values()];
}

export function extractScorecardAggregateTotals(result: ScorecardOcrResult | null, selectedTeeName?: string): ScorecardAggregateTotal[] {
  if (!result) {
    return [];
  }

  const selectedTeeSelection = splitSideTeeSelection(selectedTeeName);
  if (!selectedTeeSelection) {
    return [];
  }

  const totalsByLabel = new Map<SplitSideTotalsLabel, ScorecardAggregateTotal>();
  candidateResults(result)
    .flatMap((candidate) => splitSideTotalsFromResult(candidate, selectedTeeSelection))
    .forEach((total) => {
      const current = totalsByLabel.get(total.label);
      const totalScore = Number(total.yardageTotal != null) + Number(total.parTotal != null);
      const currentScore = current ? Number(current.yardageTotal != null) + Number(current.parTotal != null) : -1;
      if (!current || totalScore > currentScore) {
        totalsByLabel.set(total.label, total);
      }
    });

  return (["out", "in", "total"] as const)
    .map((label) => totalsByLabel.get(label))
    .filter((total): total is ScorecardAggregateTotal => total != null);
}

function metricValueIsPlausible(metric: ParsedHoleMetricKey, value: number) {
  return metric === "yardage" ? isYardageValue(value) : isParValue(value);
}

function repairMissingAggregateValue(
  holeMap: Map<number, ScorecardParsedHole>,
  holeNumbers: number[],
  metric: ParsedHoleMetricKey,
  total: number | null,
) {
  if (total == null) {
    return;
  }

  const sideHoles = holeNumbers.map((number) => holeMap.get(number) ?? emptyHole(number));
  const missing = sideHoles.filter((hole) => hole[metric] == null);
  if (missing.length !== 1) {
    return;
  }

  const knownSum = sideHoles.reduce((sum, hole) => sum + (hole[metric] ?? 0), 0);
  const candidateValue = total - knownSum;
  if (!metricValueIsPlausible(metric, candidateValue)) {
    return;
  }

  const targetHole = missing[0];
  holeMap.set(targetHole.number, {
    ...targetHole,
    [metric]: candidateValue,
  });
}

function dominantStrokeParity(sideHoles: ScorecardParsedHole[]) {
  const values = sideHoles
    .map((hole) => hole.strokeIndex)
    .filter((value): value is number => value != null);
  if (!values.length) {
    return null;
  }

  const evenCount = values.filter((value) => value % 2 === 0).length;
  const oddCount = values.length - evenCount;
  const majorityCount = Math.max(evenCount, oddCount);
  return majorityCount >= sideHoles.length - 2 ? (evenCount >= oddCount ? 0 : 1) : null;
}

function suspiciousStrokeRepairHoles(sideHoles: ScorecardParsedHole[]) {
  const frequencies = new Map<number, number>();
  sideHoles.forEach((hole) => {
    if (hole.strokeIndex != null) {
      frequencies.set(hole.strokeIndex, (frequencies.get(hole.strokeIndex) ?? 0) + 1);
    }
  });

  const expectedParity = dominantStrokeParity(sideHoles);
  return sideHoles.filter(
    (hole) =>
      hole.strokeIndex != null &&
      ((frequencies.get(hole.strokeIndex) ?? 0) > 1 ||
        (expectedParity !== null && hole.strokeIndex % 2 !== expectedParity)),
  );
}

function repairAggregateMismatchFromStrokeOutlier(
  holeMap: Map<number, ScorecardParsedHole>,
  holeNumbers: number[],
  metric: ParsedHoleMetricKey,
  total: number | null,
) {
  if (total == null) {
    return;
  }

  const sideHoles = holeNumbers.map((number) => holeMap.get(number) ?? emptyHole(number));
  if (sideHoles.some((hole) => hole[metric] == null)) {
    return;
  }

  const delta = total - sideHoles.reduce((sum, hole) => sum + (hole[metric] ?? 0), 0);
  if (delta === 0) {
    return;
  }

  const suspiciousHoles = suspiciousStrokeRepairHoles(sideHoles);
  if (suspiciousHoles.length !== 1) {
    return;
  }

  const targetHole = suspiciousHoles[0];
  const currentValue = targetHole[metric];
  if (currentValue == null) {
    return;
  }

  const repairedValue = currentValue + delta;
  if (!metricValueIsPlausible(metric, repairedValue)) {
    return;
  }

  holeMap.set(targetHole.number, {
    ...targetHole,
    [metric]: repairedValue,
  });
}

function repairParityStrokeIndexes(holeMap: Map<number, ScorecardParsedHole>, holeNumbers: number[]) {
  const sideHoles = holeNumbers.map((number) => holeMap.get(number) ?? emptyHole(number));
  const expectedParity = dominantStrokeParity(sideHoles);
  if (expectedParity == null) {
    return;
  }

  const frequencies = new Map<number, number>();
  sideHoles.forEach((hole) => {
    if (hole.strokeIndex != null) {
      frequencies.set(hole.strokeIndex, (frequencies.get(hole.strokeIndex) ?? 0) + 1);
    }
  });

  const expectedValues = Array.from({ length: 9 }, (_, index) => (expectedParity === 0 ? (index + 1) * 2 : index * 2 + 1));
  const presentValues = new Set(
    sideHoles
      .map((hole) => hole.strokeIndex)
      .filter((value): value is number => value != null && value % 2 === expectedParity && (frequencies.get(value) ?? 0) === 1),
  );
  const missingValues = expectedValues.filter((value) => !presentValues.has(value));
  const candidateHoles = sideHoles
    .filter(
      (hole) =>
        hole.strokeIndex == null ||
        hole.strokeIndex % 2 !== expectedParity ||
        (hole.strokeIndex != null && (frequencies.get(hole.strokeIndex) ?? 0) > 1),
    )
    .sort((a, b) => a.number - b.number);

  if (candidateHoles.length !== missingValues.length) {
    return;
  }

  candidateHoles.forEach((hole, index) => {
    holeMap.set(hole.number, {
      ...hole,
      strokeIndex: missingValues[index] ?? hole.strokeIndex,
    });
  });
}

function repairSplitSideSuggestionsFromTotals(
  result: ScorecardOcrResult,
  suggestions: ScorecardHoleSuggestions,
  selectedTeeName?: string,
) {
  const selectedTeeSelection = splitSideTeeSelection(selectedTeeName);
  if (!selectedTeeSelection) {
    return suggestions;
  }

  const totals = splitSideTotalsFromResult(result, selectedTeeSelection);
  if (!totals.length) {
    return suggestions;
  }

  const holeMap = new Map<number, ScorecardParsedHole>(suggestions.holes.map((hole) => [hole.number, { ...hole }]));

  totals.forEach((total) => {
    total.holeNumbers.forEach((number) => {
      if (!holeMap.has(number)) {
        holeMap.set(number, emptyHole(number));
      }
    });
    repairMissingAggregateValue(holeMap, total.holeNumbers, "yardage", total.yardageTotal);
    repairMissingAggregateValue(holeMap, total.holeNumbers, "par", total.parTotal);
  });

  totals.forEach((total) => {
    repairAggregateMismatchFromStrokeOutlier(holeMap, total.holeNumbers, "yardage", total.yardageTotal);
    repairAggregateMismatchFromStrokeOutlier(holeMap, total.holeNumbers, "par", total.parTotal);
  });

  if (selectedTeeSelection.teeToken === "white" || (selectedTeeSelection.teeToken === "yellow" && selectedTeeSelection.audienceToken !== "ladies")) {
    repairParityStrokeIndexes(holeMap, holeNumbersForTotalsLabel("out"));
    repairParityStrokeIndexes(holeMap, holeNumbersForTotalsLabel("in"));
  }

  return summarizeHoleSuggestions([...holeMap.values()]);
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

function looksLikeIndividualHoleRow(source: string) {
  const values = extractIntegers(source);
  const holeNumber = values[0];
  return holeNumber != null && holeNumber >= 1 && holeNumber <= 18 && values.length >= 4;
}

function firstScorecardTableLineIndex(lines: string[]) {
  const contiguousIndex = lines.findIndex((line) => contiguousHoleSequence(extractIntegers(line)));
  if (contiguousIndex >= 0) {
    return contiguousIndex;
  }

  return lines.findIndex((line) => looksLikeIndividualHoleRow(line));
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
  const firstHoleRowIndex = firstScorecardTableLineIndex(lines);
  const preTableLines = lines.slice(0, firstHoleRowIndex >= 0 ? firstHoleRowIndex : Math.min(lines.length, 6));
  const orderedRatingTriplets = orderedRatingTripletsFromSources(lines, firstHoleRowIndex);

  const courseNameCandidates = preTableLines
    .filter((line) => {
      const lower = line.toLowerCase();
      const digitCount = (line.match(/\d/g) ?? []).length;
      return (
        /[a-z]/i.test(line) &&
        digitCount <= 1 &&
        !/\b(?:course\s*rating|c\/?r|cr|slope|par|stroke|index|yard|yards?|holes?|out|in|total)\b/i.test(lower) &&
        !genericScorecardLabelPattern.test(lower) &&
        !/^(?:competition|date|time|course|player [a-d])$/i.test(line)
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
        const candidate = normalizeCandidate(prefixMatch[1]);
        const hasTeeSignal =
          /\d/.test(line) ||
          /(course\s*rating|c\/?r|cr|slope|rating)/i.test(lower) ||
          lineTeeTokens(candidate.toLowerCase()).length > 0 ||
          audienceTokenFromSelection(candidate) !== null;
        if (hasTeeSignal && !genericScorecardLabelPattern.test(candidate.toLowerCase())) {
          matches.push(candidate);
        }
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
  const firstHoleRowIndex = firstScorecardTableLineIndex(sources);
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
  const repairedSuggestions = repairSplitSideSuggestionsFromTotals(result, mergedSuggestions, selectedTeeName);

  return [
    repairedSuggestions,
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
  const duplicateStrokePenalty = (suggestion: ScorecardHoleSuggestions) => {
    const strokeIndexes = suggestion.holes
      .map((hole) => hole.strokeIndex)
      .filter((value): value is number => value != null);
    return strokeIndexes.length - new Set(strokeIndexes).size;
  };

  return (
    b.holes.length - a.holes.length ||
    b.yardageCount - a.yardageCount ||
    b.parCount - a.parCount ||
    b.strokeIndexCount - a.strokeIndexCount ||
    duplicateStrokePenalty(a) - duplicateStrokePenalty(b)
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
  const repairedSuggestions = repairSplitSideSuggestionsFromTotals(result, mergedSuggestions, selectedTeeName);

  return [repairedSuggestions, mergedSuggestions, ...suggestions].sort(compareHoleSuggestionQuality)[0] ?? {
    holes: [],
    yardageCount: 0,
    parCount: 0,
    strokeIndexCount: 0,
  };
}
