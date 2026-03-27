import type {
  V2CourseRecord,
  V2Hole,
  V2RoundPlayer,
  V2RoundRecord,
  V2Store,
  V2TeeSet,
} from "./types";
import { createEmptyV2Store } from "./storage";

type LegacyHole = {
  number: number;
  name: string;
  yardage: number;
  par: number;
  strokeIndex: number;
};

type LegacyTeeSet = {
  id: string;
  name: string;
  courseRating: number;
  slopeRating: number;
  course: LegacyHole[];
};

type LegacyPlayer = {
  id: string;
  name: string;
  handicap: number;
  teeId: string;
  scores: Record<number, string>;
};

type LegacySavedCourse = {
  id: string;
  name: string;
  scorecardImageUri?: string | null;
  tees: LegacyTeeSet[];
  savedAt: string;
};

type LegacySavedRound = {
  id: string;
  name: string;
  date: string;
  courseName: string;
  scorecardImageUri?: string | null;
  tees: LegacyTeeSet[];
  players: LegacyPlayer[];
  savedAt?: string;
};

export type LegacyStoragePayload = {
  savedCourses?: LegacySavedCourse[];
  savedRounds?: LegacySavedRound[];
};

function mapHole(hole: LegacyHole): V2Hole {
  return {
    number: hole.number,
    name: hole.name,
    yardage: hole.yardage,
    par: hole.par,
    strokeIndex: hole.strokeIndex,
  };
}

function totalPar(holes: LegacyHole[]): number {
  return holes.reduce((sum, hole) => sum + hole.par, 0);
}

function mapTee(tee: LegacyTeeSet): V2TeeSet {
  return {
    id: tee.id,
    name: tee.name,
    color: tee.name.toLowerCase(),
    holes: tee.course.map(mapHole),
    ratingProfiles: [
      {
        id: `${tee.id}-default`,
        label: "Default",
        courseRating: tee.courseRating,
        slopeRating: tee.slopeRating,
        par: totalPar(tee.course),
      },
    ],
  };
}

function mapSavedCourse(course: LegacySavedCourse): V2CourseRecord {
  return {
    id: course.id,
    name: course.name,
    countryCode: "GB",
    source: "migration",
    savedAt: course.savedAt,
    tees: course.tees.map(mapTee),
    scorecardImageUri: course.scorecardImageUri ?? null,
  };
}

function mapRoundPlayer(player: LegacyPlayer): V2RoundPlayer {
  return {
    id: player.id,
    name: player.name,
    teeId: player.teeId,
    handicapIndex: null,
    courseHandicap: player.handicap,
    playingHandicap: player.handicap,
    scores: { ...player.scores },
  };
}

function mapSavedRound(round: LegacySavedRound): V2RoundRecord {
  return {
    id: round.id,
    name: round.name,
    date: round.date,
    courseId: null,
    courseName: round.courseName,
    courseSnapshotTees: round.tees.map(mapTee),
    scorecardImageUri: round.scorecardImageUri ?? null,
    players: round.players.map(mapRoundPlayer),
    savedAt: round.savedAt ?? new Date().toISOString(),
  };
}

export function migrateLegacyStore(payload: LegacyStoragePayload | null | undefined): V2Store {
  const base = createEmptyV2Store();

  if (!payload) {
    return base;
  }

  return {
    ...base,
    migratedFromV1: true,
    courses: (payload.savedCourses ?? []).map(mapSavedCourse),
    rounds: (payload.savedRounds ?? []).map(mapSavedRound),
  };
}
