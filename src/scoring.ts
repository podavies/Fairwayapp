export type ScoreHole = {
  number: number;
  name: string;
  yardage: number;
  par: number;
  strokeIndex: number;
};

export type ScoreTeeSet = {
  id: string;
  name: string;
  course: ScoreHole[];
};

export type ScorePlayer = {
  handicap: number;
  teeId: string;
  scores: Record<number, string>;
};

export const BLOB_SCORE = "B";

export const strokes = (handicap: number, strokeIndex: number) =>
  Math.floor(handicap / 18) + (strokeIndex <= handicap % 18 ? 1 : 0);

export const stableford = (gross: number, par: number, shots: number) =>
  Math.max(0, 2 + par - (gross - shots));

export const scoreEntered = (value: string | undefined) => value === BLOB_SCORE || Number(value) > 0;

export const scoreDisplayValue = (value: string | undefined) => (value === BLOB_SCORE ? "✓" : value ?? "");

export const holePoints = (player: ScorePlayer, hole: ScoreHole) => {
  const value = player.scores[hole.number];
  if (!scoreEntered(value) || value === BLOB_SCORE) {
    return 0;
  }

  return stableford(Number(value), hole.par, strokes(player.handicap, hole.strokeIndex));
};

export function teeForPlayer<T extends ScoreTeeSet>(tees: T[], teeId: string) {
  return tees.find((tee) => tee.id === teeId) ?? tees[0];
}

export function courseForPlayer(
  tees: ScoreTeeSet[],
  player: ScorePlayer,
  fallbackCourse: ScoreHole[] = [],
) {
  return teeForPlayer(tees, player.teeId)?.course ?? fallbackCourse;
}

export function holeForPlayer(
  tees: ScoreTeeSet[],
  player: ScorePlayer,
  holeNumber: number,
  fallbackCourse: ScoreHole[] = [],
) {
  const tee = teeForPlayer(tees, player.teeId);
  return tee?.course.find((hole) => hole.number === holeNumber) ?? fallbackCourse[holeNumber - 1];
}

export const grossScoreValue = (value: string | undefined) =>
  !scoreEntered(value) || value === BLOB_SCORE ? 0 : Number(value);

export const totalPoints = (player: ScorePlayer, tees: ScoreTeeSet[], fallbackCourse: ScoreHole[] = []) =>
  courseForPlayer(tees, player, fallbackCourse).reduce((sum, hole) => sum + holePoints(player, hole), 0);

export const playerHolePoints = (
  player: ScorePlayer,
  tees: ScoreTeeSet[],
  fallbackCourse: ScoreHole[] = [],
) => courseForPlayer(tees, player, fallbackCourse).map((hole) => holePoints(player, hole));

export const completed = (player: ScorePlayer, tees: ScoreTeeSet[], fallbackCourse: ScoreHole[] = []) =>
  courseForPlayer(tees, player, fallbackCourse).filter((hole) => scoreEntered(player.scores[hole.number])).length;

export const totalShots = (player: ScorePlayer, tees: ScoreTeeSet[], fallbackCourse: ScoreHole[] = []) =>
  courseForPlayer(tees, player, fallbackCourse).reduce(
    (sum, hole) => sum + grossScoreValue(player.scores[hole.number]),
    0,
  );

export const completedGrossScores = (
  player: ScorePlayer,
  tees: ScoreTeeSet[],
  fallbackCourse: ScoreHole[] = [],
) =>
  courseForPlayer(tees, player, fallbackCourse).filter(
    (hole) => grossScoreValue(player.scores[hole.number]) > 0,
  ).length;

function buildTotalsForHoles(player: ScorePlayer, holes: ScoreHole[]) {
  return {
    shots: holes.reduce((sum, hole) => sum + grossScoreValue(player.scores[hole.number]), 0),
    points: holes.reduce((sum, hole) => sum + holePoints(player, hole), 0),
    grossLogged: holes.filter((hole) => grossScoreValue(player.scores[hole.number]) > 0).length,
    holesLogged: holes.filter((hole) => scoreEntered(player.scores[hole.number])).length,
  };
}

export function buildScoreEntryRunningTotals(
  player: ScorePlayer,
  tees: ScoreTeeSet[],
  fallbackCourse: ScoreHole[] = [],
) {
  const course = courseForPlayer(tees, player, fallbackCourse);
  const frontNine = course.filter((hole) => hole.number >= 1 && hole.number <= 9);

  return {
    ...buildTotalsForHoles(player, course),
    frontNine: frontNine.length === 9 ? buildTotalsForHoles(player, frontNine) : null,
  };
}
