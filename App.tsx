import { StatusBar } from "expo-status-bar";
import * as FileSystem from "expo-file-system/legacy";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Hole = {
  number: number;
  name: string;
  yardage: number;
  par: number;
  strokeIndex: number;
};
type Group = { id: string; name: string };
type TeeSet = {
  id: string;
  name: string;
  courseRating: number;
  slopeRating: number;
  course: Hole[];
};
type Player = {
  id: string;
  name: string;
  handicap: number;
  groupId: string;
  teeId: string;
  scores: Record<number, string>;
};
type RoundState = {
  id: string;
  name: string;
  date: string;
  courseName: string;
  tees: TeeSet[];
  groups: Group[];
  players: Player[];
  ghosts: Record<string, string | null>;
};
type SavedRound = RoundState & { savedAt: string };
type Tab = "setup" | "live" | "saved";
type ScoreEntryMode = "group" | "player";
type LiveSection = "groups" | "players" | "entry";

const defaultCourse: Hole[] = [
  { number: 1, name: "Home Wood", yardage: 279, par: 4, strokeIndex: 12 },
  { number: 2, name: "Partridge Way", yardage: 199, par: 3, strokeIndex: 8 },
  { number: 3, name: "Langley Walk", yardage: 536, par: 5, strokeIndex: 6 },
  { number: 4, name: "Skylark Bend", yardage: 343, par: 4, strokeIndex: 18 },
  { number: 5, name: "The Old Gate", yardage: 328, par: 4, strokeIndex: 10 },
  { number: 6, name: "Home Farm", yardage: 165, par: 3, strokeIndex: 16 },
  { number: 7, name: "Oak Corner", yardage: 407, par: 4, strokeIndex: 2 },
  { number: 8, name: "Foxes Covert", yardage: 341, par: 4, strokeIndex: 14 },
  { number: 9, name: "Vixen Crossing", yardage: 421, par: 4, strokeIndex: 4 },
  { number: 10, name: "The Ha Ha", yardage: 169, par: 3, strokeIndex: 15 },
  { number: 11, name: "Chestnut Bend", yardage: 413, par: 4, strokeIndex: 3 },
  { number: 12, name: "The Swannery", yardage: 323, par: 4, strokeIndex: 17 },
  { number: 13, name: "Pheasants", yardage: 349, par: 4, strokeIndex: 7 },
  { number: 14, name: "Mansion Copse", yardage: 195, par: 3, strokeIndex: 11 },
  { number: 15, name: "Lime Walk", yardage: 410, par: 4, strokeIndex: 1 },
  { number: 16, name: "Rushes", yardage: 425, par: 4, strokeIndex: 5 },
  { number: 17, name: "Ice House", yardage: 534, par: 5, strokeIndex: 13 },
  { number: 18, name: "Witty Brook", yardage: 395, par: 4, strokeIndex: 9 },
];

const STORAGE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}rollup-rounds.json`
  : null;
const DEFAULT_COURSE_NAME = "Default Course";

const colors = {
  bg: "#f3efe4",
  panel: "#fffdf7",
  green: "#143726",
  green2: "#2d5a3d",
  sand: "#dcc99a",
  pale: "#f4efdf",
  soft: "#ece4d1",
  ink: "#1c231d",
  muted: "#6d6b64",
  border: "#ddd1b8",
};

const teeDefinitions = [
  { id: "white", name: "White", courseRating: 70.7, slopeRating: 125, yardages: [279, 199, 536, 343, 328, 165, 407, 341, 421, 169, 413, 323, 349, 195, 410, 425, 534, 395] },
  { id: "yellow", name: "Yellow", courseRating: 68.9, slopeRating: 120, yardages: [258, 188, 527, 334, 316, 150, 375, 289, 358, 161, 374, 315, 339, 184, 386, 388, 500, 374] },
  { id: "blue", name: "Blue", courseRating: 67.8, slopeRating: 119, yardages: [269, 164, 513, 304, 292, 139, 386, 302, 377, 124, 360, 294, 325, 177, 371, 370, 509, 360] },
  { id: "red", name: "Red", courseRating: 71.6, slopeRating: 124, yardages: [232, 159, 483, 301, 283, 131, 347, 265, 339, 131, 352, 290, 318, 174, 381, 333, 468, 355] },
];

const id = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const today = () => new Date().toISOString().slice(0, 10);
const defaultGroups = () => [
  { id: id("group"), name: "Group 1" },
  { id: id("group"), name: "Group 2" },
];
const strokes = (handicap: number, strokeIndex: number) =>
  Math.floor(handicap / 18) + (strokeIndex <= handicap % 18 ? 1 : 0);
const stableford = (gross: number, par: number, shots: number) =>
  Math.max(0, 2 + par - (gross - shots));
const BLOB_SCORE = "B";
const scoreEntered = (value: string | undefined) => value === BLOB_SCORE || Number(value) > 0;
const scoreDisplayValue = (value: string | undefined) => (value === BLOB_SCORE ? "✓" : value ?? "");
const holePoints = (player: Player, hole: Hole) => {
  const value = player.scores[hole.number];
  if (!scoreEntered(value) || value === BLOB_SCORE) {
    return 0;
  }
  return stableford(Number(value), hole.par, strokes(player.handicap, hole.strokeIndex));
};
function teeForPlayer(tees: TeeSet[], teeId: string) {
  return tees.find((tee) => tee.id === teeId) ?? tees[0];
}

function holeForPlayer(tees: TeeSet[], player: Player, holeNumber: number) {
  const tee = teeForPlayer(tees, player.teeId);
  return tee?.course.find((hole) => hole.number === holeNumber) ?? defaultCourse[holeNumber - 1];
}

const totalPoints = (player: Player, tees: TeeSet[]) =>
  (teeForPlayer(tees, player.teeId)?.course ?? defaultCourse).reduce(
    (sum, hole) => sum + holePoints(player, hole),
    0,
  );
const playerHolePoints = (player: Player, tees: TeeSet[]) =>
  (teeForPlayer(tees, player.teeId)?.course ?? defaultCourse).map((hole) => holePoints(player, hole));
const completed = (player: Player, tees: TeeSet[]) =>
  (teeForPlayer(tees, player.teeId)?.course ?? defaultCourse).filter((hole) =>
    scoreEntered(player.scores[hole.number]),
  ).length;

function countbackTotals(points: number[]) {
  return [9, 6, 3, 1].map((holes) => points.slice(-holes).reduce((sum, value) => sum + value, 0));
}

function compareCountback(aPoints: number[], bPoints: number[]) {
  const aTotals = countbackTotals(aPoints);
  const bTotals = countbackTotals(bPoints);

  for (let index = 0; index < aTotals.length; index += 1) {
    if (bTotals[index] !== aTotals[index]) {
      return bTotals[index] - aTotals[index];
    }
  }

  return 0;
}

function comparePlayers(
  a: Player & { total: number; done: number; holePoints: number[] },
  b: Player & { total: number; done: number; holePoints: number[] },
) {
  if (b.total !== a.total) {
    return b.total - a.total;
  }

  if (b.done !== a.done) {
    return b.done - a.done;
  }

  const countback = compareCountback(a.holePoints, b.holePoints);
  if (countback !== 0) {
    return countback;
  }

  return a.name.localeCompare(b.name);
}

function compareWorstPlayers(
  a: Player & { total: number; done: number; holePoints: number[] },
  b: Player & { total: number; done: number; holePoints: number[] },
) {
  if (b.done !== a.done) {
    return b.done - a.done;
  }

  if (a.total !== b.total) {
    return a.total - b.total;
  }

  const countback = compareCountback(b.holePoints, a.holePoints);
  if (countback !== 0) {
    return countback;
  }

  return a.name.localeCompare(b.name);
}

function shuffle<T>(items: T[]) {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = clone[index];
    clone[index] = clone[randomIndex];
    clone[randomIndex] = current;
  }
  return clone;
}

function syncGhosts(players: Player[], groups: Group[], current: Record<string, string | null> = {}, force = false) {
  const next: Record<string, string | null> = {};
  const groupSizes = new Map(
    groups.map((group) => [group.id, players.filter((player) => player.groupId === group.id).length]),
  );
  const activeGroupSizes = [...groupSizes.values()].filter((size) => size > 0);
  const mixedThreeAndFour = activeGroupSizes.includes(3) && activeGroupSizes.includes(4);

  if (!mixedThreeAndFour) {
    return next;
  }

  const threeBallGroups = groups.filter((group) => groupSizes.get(group.id) === 3);
  const eligibleGhostIds = players.map((player) => player.id);
  const existingSharedGhost = !force
    ? threeBallGroups
        .map((group) => current[group.id] ?? null)
        .find((ghostId): ghostId is string => !!ghostId && eligibleGhostIds.includes(ghostId))
    : null;
  const sharedGhost = existingSharedGhost ?? shuffle(eligibleGhostIds)[0] ?? null;

  threeBallGroups.forEach((group) => {
    next[group.id] = sharedGhost;
  });

  return next;
}

function cloneRound(round: RoundState): RoundState {
  return {
    ...round,
    tees: round.tees.map((tee) => ({
      ...tee,
      course: tee.course.map((hole) => ({ ...hole })),
    })),
    groups: round.groups.map((group) => ({ ...group })),
    players: round.players.map((player) => ({ ...player, scores: { ...player.scores } })),
    ghosts: { ...round.ghosts },
  };
}

function normalizeCourse(holes?: Hole[], fallbackYardages?: number[]) {
  return defaultCourse.map((defaultHole, index) => {
    const incomingHole = holes?.[index];
    return {
      number: defaultHole.number,
      name: incomingHole?.name?.trim() ? incomingHole.name : defaultHole.name,
      yardage:
        incomingHole?.yardage && incomingHole.yardage > 0
          ? incomingHole.yardage
          : fallbackYardages?.[index] ?? defaultHole.yardage,
      par: incomingHole?.par && incomingHole.par > 0 ? incomingHole.par : defaultHole.par,
      strokeIndex:
        incomingHole?.strokeIndex && incomingHole.strokeIndex > 0
          ? incomingHole.strokeIndex
          : defaultHole.strokeIndex,
    };
  });
}

function defaultTees(baseCourse?: Hole[]) {
  return teeDefinitions.map((tee) => ({
    ...tee,
    course: normalizeCourse(baseCourse, tee.yardages),
  }));
}

function normalizeTees(tees?: TeeSet[], legacyCourse?: Hole[]) {
  if (!tees?.length) {
    return defaultTees(legacyCourse);
  }

  const teeMap = new Map(tees.map((tee) => [tee.id, tee]));
  return teeDefinitions.map((definition) => {
    const existing = teeMap.get(definition.id);
    return {
      ...definition,
      courseRating: existing?.courseRating ?? definition.courseRating,
      slopeRating: existing?.slopeRating ?? definition.slopeRating,
      course: normalizeCourse(existing?.course ?? legacyCourse, definition.yardages),
    };
  });
}

function normalizeRound(round: RoundState): RoundState {
  const legacyCourse = (round as RoundState & { course?: Hole[] }).course;
  const tees = normalizeTees(round.tees, legacyCourse);
  const groups = round.groups.length ? round.groups : defaultGroups();
  const fallbackGroupId = groups[0]?.id ?? id("group");
  const validGroupIds = new Set(groups.map((group) => group.id));
  const validTeeIds = new Set(tees.map((tee) => tee.id));
  const fallbackTeeId = tees[0]?.id ?? "white";
  const players = round.players.map((player) => ({
    ...player,
    groupId: validGroupIds.has(player.groupId) ? player.groupId : fallbackGroupId,
    teeId: validTeeIds.has(player.teeId) ? player.teeId : fallbackTeeId,
    scores: { ...player.scores },
  }));
  return {
    id: round.id || id("round"),
    name: round.name || "Rollup Round",
    date: round.date || today(),
    courseName: round.courseName?.trim() || DEFAULT_COURSE_NAME,
    tees,
    groups: groups.map((group) => ({ ...group })),
    players,
    ghosts: syncGhosts(players, groups, round.ghosts ?? {}),
  };
}

function starterRound(): RoundState {
  const groups = defaultGroups();
  const [a, b] = groups;
  return normalizeRound({
    id: id("round"),
    name: "Saturday Rollup",
    date: today(),
    courseName: DEFAULT_COURSE_NAME,
    tees: defaultTees(),
    groups,
    players: [
      { id: id("p"), name: "Chris", handicap: 11, groupId: a.id, teeId: "white", scores: { 1: "5", 2: "4", 3: "3", 4: "6" } },
      { id: id("p"), name: "Martin", handicap: 17, groupId: a.id, teeId: "white", scores: { 1: "5", 2: "6", 3: "4", 4: "7" } },
      { id: id("p"), name: "Neil", handicap: 22, groupId: a.id, teeId: "yellow", scores: { 1: "6", 2: "5", 3: "4", 4: "6" } },
      { id: id("p"), name: "Adrian", handicap: 9, groupId: a.id, teeId: "blue", scores: { 1: "4", 2: "4", 3: "3", 4: "5" } },
      { id: id("p"), name: "Steve", handicap: 14, groupId: b.id, teeId: "yellow", scores: { 1: "5", 2: "5", 3: "3", 4: "6" } },
      { id: id("p"), name: "Paul", handicap: 19, groupId: b.id, teeId: "yellow", scores: { 1: "6", 2: "5", 3: "4", 4: "6" } },
      { id: id("p"), name: "Graham", handicap: 24, groupId: b.id, teeId: "red", scores: { 1: "6", 2: "6", 3: "4", 4: "7" } },
    ],
    ghosts: {},
  });
}

function randomTestScores(holeCount = 6): Record<number, string> {
  const scores: Record<number, string> = {};

  for (let hole = 1; hole <= holeCount; hole += 1) {
    const roll = Math.random();
    scores[hole] = roll < 0.12 ? BLOB_SCORE : String(3 + Math.floor(Math.random() * 6));
  }

  return scores;
}

function ghostTestRound(): RoundState {
  const groups = [
    { id: id("group"), name: "Group 1" },
    { id: id("group"), name: "Group 2" },
    { id: id("group"), name: "Group 3" },
    { id: id("group"), name: "Group 4" },
  ];
  const [group1, group2, group3, group4] = groups;

  return normalizeRound({
    id: id("round"),
    name: "Ghost Test Round",
    date: today(),
    courseName: DEFAULT_COURSE_NAME,
    tees: defaultTees(),
    groups,
    players: [
      { id: id("p"), name: "Chris", handicap: 11, groupId: group1.id, teeId: "white", scores: randomTestScores() },
      { id: id("p"), name: "Martin", handicap: 17, groupId: group1.id, teeId: "white", scores: randomTestScores() },
      { id: id("p"), name: "Neil", handicap: 22, groupId: group1.id, teeId: "yellow", scores: randomTestScores() },
      { id: id("p"), name: "Adrian", handicap: 9, groupId: group1.id, teeId: "blue", scores: randomTestScores() },
      { id: id("p"), name: "Steve", handicap: 14, groupId: group2.id, teeId: "yellow", scores: randomTestScores() },
      { id: id("p"), name: "Paul", handicap: 19, groupId: group2.id, teeId: "yellow", scores: randomTestScores() },
      { id: id("p"), name: "Graham", handicap: 24, groupId: group2.id, teeId: "red", scores: randomTestScores() },
      { id: id("p"), name: "Lee", handicap: 8, groupId: group3.id, teeId: "white", scores: randomTestScores() },
      { id: id("p"), name: "Jason", handicap: 13, groupId: group3.id, teeId: "white", scores: randomTestScores() },
      { id: id("p"), name: "Mark", handicap: 20, groupId: group3.id, teeId: "yellow", scores: randomTestScores() },
      { id: id("p"), name: "Pete", handicap: 16, groupId: group4.id, teeId: "yellow", scores: randomTestScores() },
      { id: id("p"), name: "Tom", handicap: 21, groupId: group4.id, teeId: "red", scores: randomTestScores() },
      { id: id("p"), name: "Ben", handicap: 6, groupId: group4.id, teeId: "blue", scores: randomTestScores() },
    ],
    ghosts: {},
  });
}

function blankRound(): RoundState {
  return normalizeRound({
    id: id("round"),
    name: "New Rollup",
    date: today(),
    courseName: DEFAULT_COURSE_NAME,
    tees: defaultTees(),
    groups: defaultGroups(),
    players: [],
    ghosts: {},
  });
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function groupLabel(size: number) {
  if (size === 3) {
    return "3-ball";
  }
  if (size === 4) {
    return "4-ball";
  }
  return `${size} players`;
}

function groupNote(size: number) {
  if (size === 3) {
    return "3-ball groups use best 2 scores unless the field mixes 3s and 4s.";
  }
  if (size === 4) {
    return "4-ball groups use the best 3 scores on each hole.";
  }
  if (size < 3) {
    return "Add more players to make this group valid.";
  }
  return "Too many players. Split this group before scoring.";
}

function groupSizeSummary(groups: Group[], players: Player[]) {
  const sizes = groups
    .map((group) => players.filter((player) => player.groupId === group.id).length)
    .filter((size) => size > 0);
  return {
    allThree: sizes.length > 0 && sizes.every((size) => size === 3),
    allFour: sizes.length > 0 && sizes.every((size) => size === 4),
    mixedThreeAndFour: sizes.includes(3) && sizes.includes(4),
  };
}

function countingScoresForGroup(groupSize: number, summary: ReturnType<typeof groupSizeSummary>) {
  if (summary.mixedThreeAndFour) {
    return groupSize >= 4 ? 3 : groupSize === 3 ? 3 : groupSize;
  }
  if (summary.allFour) {
    return groupSize >= 4 ? 3 : groupSize;
  }
  if (summary.allThree) {
    return groupSize === 3 ? 2 : groupSize;
  }
  if (groupSize >= 4) {
    return 3;
  }
  if (groupSize === 3) {
    return 2;
  }
  return groupSize;
}

function sumBestScores(points: number[], count: number) {
  return [...points]
    .sort((a, b) => b - a)
    .slice(0, count)
    .reduce((sum, value) => sum + value, 0);
}

function groupHoleTotal(
  tees: TeeSet[],
  members: Player[],
  ghost: Player | null,
  holeNumber: number,
  scoresToCount: number,
  includeGhost: boolean,
) {
  const points = members.map((player) => holePoints(player, holeForPlayer(tees, player, holeNumber)));
  if (includeGhost && ghost) {
    points.push(holePoints(ghost, holeForPlayer(tees, ghost, holeNumber)));
  }
  return sumBestScores(points, scoresToCount);
}

function groupRoundTotal(
  tees: TeeSet[],
  members: Player[],
  ghost: Player | null,
  scoresToCount: number,
  includeGhost: boolean,
) {
  return defaultCourse.reduce(
    (sum, hole) => sum + groupHoleTotal(tees, members, ghost, hole.number, scoresToCount, includeGhost),
    0,
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("setup");
  const [round, setRound] = useState<RoundState>(() => blankRound());
  const [savedRounds, setSavedRounds] = useState<SavedRound[]>([]);
  const [selectedHole, setSelectedHole] = useState(1);
  const [draftName, setDraftName] = useState("");
  const [draftHandicap, setDraftHandicap] = useState("18");
  const [draftGroupId, setDraftGroupId] = useState("");
  const [draftTeeId, setDraftTeeId] = useState("white");
  const [selectedTeeId, setSelectedTeeId] = useState("white");
  const [courseSetupExpanded, setCourseSetupExpanded] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [scoreEntryMode, setScoreEntryMode] = useState<ScoreEntryMode>("group");
  const [scoreEntryPlayerId, setScoreEntryPlayerId] = useState<string | null>(null);
  const [liveSection, setLiveSection] = useState<LiveSection>("entry");
  const [storageReady, setStorageReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState(
    STORAGE_URI ? "Loading saved rounds on this device. Current round resets on app open..." : "Local storage is unavailable here.",
  );

  useEffect(() => {
    if (!STORAGE_URI) {
      setStorageReady(true);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const info = await FileSystem.getInfoAsync(STORAGE_URI);
        if (info.exists) {
          const parsed = JSON.parse(await FileSystem.readAsStringAsync(STORAGE_URI)) as {
            savedRounds?: SavedRound[];
          };
          if (!cancelled && parsed.savedRounds) {
            setSavedRounds(
              parsed.savedRounds.map((item) => ({
                ...normalizeRound(item as RoundState),
                savedAt: item.savedAt,
              })),
            );
          }
        }
        if (!cancelled) {
          setStorageMessage("Saved rounds stay on this device. Current round resets each time the app opens.");
          setStorageReady(true);
        }
      } catch {
        if (!cancelled) {
          setStorageMessage("Could not load saved rounds. The app is still ready to use.");
          setStorageReady(true);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady || !STORAGE_URI) {
      return;
    }
    let cancelled = false;
    const persist = async () => {
      try {
        await FileSystem.writeAsStringAsync(
          STORAGE_URI,
          JSON.stringify({
            activeRound: cloneRound(round),
            savedRounds: savedRounds.map((item) => ({ ...cloneRound(item), savedAt: item.savedAt })),
          }),
        );
        if (!cancelled) {
          setStorageMessage(`Saved ${savedRounds.length} round${savedRounds.length === 1 ? "" : "s"} on this device.`);
        }
      } catch {
        if (!cancelled) {
          setStorageMessage("Could not save changes locally.");
        }
      }
    };
    void persist();
    return () => {
      cancelled = true;
    };
  }, [round, savedRounds, storageReady]);

  useEffect(() => {
    const firstGroupId = round.groups[0]?.id ?? "";
    if (!draftGroupId || !round.groups.some((group) => group.id === draftGroupId)) {
      setDraftGroupId(firstGroupId);
    }
  }, [draftGroupId, round.groups]);

  useEffect(() => {
    const firstTeeId = round.tees[0]?.id ?? "white";
    if (!draftTeeId || !round.tees.some((tee) => tee.id === draftTeeId)) {
      setDraftTeeId(firstTeeId);
    }
    if (!selectedTeeId || !round.tees.some((tee) => tee.id === selectedTeeId)) {
      setSelectedTeeId(firstTeeId);
    }
  }, [draftTeeId, round.tees, selectedTeeId]);

  useEffect(() => {
    if (selectedPlayerId && !round.players.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId(null);
    }
  }, [round.players, selectedPlayerId]);

  useEffect(() => {
    if (scoreEntryPlayerId && !round.players.some((player) => player.id === scoreEntryPlayerId)) {
      setScoreEntryPlayerId(null);
    }
  }, [round.players, scoreEntryPlayerId]);

  const selectedTee = teeForPlayer(round.tees, selectedTeeId);
  const currentHole = selectedTee?.course.find((hole) => hole.number === selectedHole) ?? selectedTee?.course[0] ?? defaultCourse[0];
  const selectedPlayer = useMemo(
    () => round.players.find((player) => player.id === selectedPlayerId) ?? null,
    [round.players, selectedPlayerId],
  );
  const selectedPlayerTee = selectedPlayer ? teeForPlayer(round.tees, selectedPlayer.teeId) : null;
  const selectedPlayerCourse = selectedPlayerTee?.course ?? defaultCourse;
  const rankedPlayers = useMemo(
    () =>
      [...round.players]
        .map((player) => ({
          ...player,
          total: totalPoints(player, round.tees),
          done: completed(player, round.tees),
          holePoints: playerHolePoints(player, round.tees),
        }))
        .sort(comparePlayers),
    [round.players, round.tees],
  );
  useEffect(() => {
    if (!rankedPlayers.length) {
      setScoreEntryPlayerId(null);
      return;
    }

    if (!scoreEntryPlayerId || !rankedPlayers.some((player) => player.id === scoreEntryPlayerId)) {
      setScoreEntryPlayerId(rankedPlayers[0].id);
    }
  }, [rankedPlayers, scoreEntryPlayerId]);

  const scoreEntryPlayer = useMemo(
    () => rankedPlayers.find((player) => player.id === scoreEntryPlayerId) ?? rankedPlayers[0] ?? null,
    [rankedPlayers, scoreEntryPlayerId],
  );
  const scoreEntryCourse = scoreEntryPlayer ? teeForPlayer(round.tees, scoreEntryPlayer.teeId)?.course ?? defaultCourse : defaultCourse;
  const playerMap = useMemo(
    () => Object.fromEntries(rankedPlayers.map((player) => [player.id, player])),
    [rankedPlayers],
  );
  const lowestPointsPlayer = useMemo(
    () =>
      [...rankedPlayers]
        .filter((player) => player.done > 0)
        .sort(compareWorstPlayers)[0] ?? null,
    [rankedPlayers],
  );
  const scoringSummary = useMemo(
    () => groupSizeSummary(round.groups, round.players),
    [round.groups, round.players],
  );
  const rankedGroups = useMemo(
    () =>
      round.groups
        .map((group) => {
          const members = rankedPlayers.filter((player) => player.groupId === group.id);
          const ghostId = round.ghosts[group.id];
          const ghost = ghostId ? playerMap[ghostId] ?? null : null;
          const scoresToCount = countingScoresForGroup(members.length, scoringSummary);
          const includeGhost = scoringSummary.mixedThreeAndFour && members.length === 3;
          const total = groupRoundTotal(round.tees, members, ghost, scoresToCount, includeGhost);
          const holeTotal = groupHoleTotal(round.tees, members, ghost, selectedHole, scoresToCount, includeGhost);
          return { ...group, members, ghost, size: members.length, total, holeTotal, scoresToCount, includeGhost };
        })
        .sort((a, b) => b.total - a.total),
    [playerMap, rankedPlayers, round.ghosts, round.groups, round.players, round.tees, scoringSummary, selectedHole],
  );

  const setRoster = (updater: (current: RoundState) => RoundState, forceGhostRedraw = false) => {
    setRound((current) => {
      const next = updater(current);
      return {
        ...next,
        ghosts: syncGhosts(next.players, next.groups, next.ghosts, forceGhostRedraw),
      };
    });
  };

  const invalidGroups = round.groups.filter((group) => {
    const size = round.players.filter((player) => player.groupId === group.id).length;
    return size !== 3 && size !== 4;
  });
  const totalParValue = selectedTee.course.reduce((sum, hole) => sum + hole.par, 0);
  const totalYardageValue = selectedTee.course.reduce((sum, hole) => sum + hole.yardage, 0);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const groupEntryPlayers = useMemo(
    () => round.groups.flatMap((group) => round.players.filter((player) => player.groupId === group.id)),
    [round.groups, round.players],
  );
  const groupEntryKeys = useMemo(
    () => groupEntryPlayers.map((player) => `group:${selectedHole}:${player.id}`),
    [groupEntryPlayers, selectedHole],
  );
  const playerEntryKeys = useMemo(
    () => (scoreEntryPlayer ? scoreEntryCourse.map((hole) => `player:${scoreEntryPlayer.id}:${hole.number}`) : []),
    [scoreEntryCourse, scoreEntryPlayer],
  );

  const updatePlayerScore = (playerId: string, holeNumber: number, value: string) => {
    const nextScore = value === BLOB_SCORE ? BLOB_SCORE : value.replace(/[^0-9]/g, "").slice(0, 1);
    setRound((current) => ({
      ...current,
      players: current.players.map((currentPlayer) =>
        currentPlayer.id === playerId
          ? { ...currentPlayer, scores: { ...currentPlayer.scores, [holeNumber]: nextScore } }
          : currentPlayer,
      ),
    }));
  };

  const toggleBlobScore = (playerId: string, holeNumber: number, orderedKeys: string[], currentKey: string) => {
    const currentValue = round.players.find((player) => player.id === playerId)?.scores[holeNumber];
    const nextValue = currentValue === BLOB_SCORE ? "" : BLOB_SCORE;
    updatePlayerScore(playerId, holeNumber, nextValue);

    if (nextValue === BLOB_SCORE) {
      const currentIndex = orderedKeys.indexOf(currentKey);
      const nextKey = currentIndex >= 0 ? orderedKeys[currentIndex + 1] : undefined;
      focusNextInput(nextKey);
    }
  };

  const focusNextInput = (nextKey: string | undefined) => {
    if (!nextKey) {
      return;
    }

    inputRefs.current[nextKey]?.focus();
  };

  const handleScoreInputChange = (playerId: string, holeNumber: number, value: string, orderedKeys: string[], currentKey: string) => {
    const sanitized = value.replace(/[^0-9]/g, "").slice(0, 1);
    updatePlayerScore(playerId, holeNumber, sanitized);

    if (!sanitized) {
      return;
    }

    const currentIndex = orderedKeys.indexOf(currentKey);
    const nextKey = currentIndex >= 0 ? orderedKeys[currentIndex + 1] : undefined;
    focusNextInput(nextKey);
  };

  const clearCurrentRound = () => {
    setRound(blankRound());
    setSelectedHole(1);
    setSelectedPlayerId(null);
    setScoreEntryPlayerId(null);
    setScoreEntryMode("group");
    setSelectedTeeId("white");
    setCourseSetupExpanded(false);
    setLiveSection("entry");
    setTab("setup");
  };

  const loadGhostTestRound = () => {
    setRound(ghostTestRound());
    setSelectedHole(1);
    setSelectedPlayerId(null);
    setScoreEntryPlayerId(null);
    setScoreEntryMode("group");
    setSelectedTeeId("white");
    setCourseSetupExpanded(false);
    setLiveSection("groups");
    setTab("live");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Golf Rollup Manager</Text>
          <Text style={styles.heroTitle}>Create rollups, log scores, and save results in one app.</Text>
          <Text style={styles.heroCopy}>
            Log individual Stableford points after the round, compare mixed 3-balls and 4-balls, and total groups hole by hole using your rollup best-ball rules.
          </Text>
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{round.players.length}</Text>
              <Text style={styles.statLabel}>Players</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{round.groups.length}</Text>
              <Text style={styles.statLabel}>Groups</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{savedRounds.length}</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </View>
          </View>
          <View style={styles.tabRow}>
            {[
              { key: "setup", label: "Create Rollup" },
              { key: "live", label: "Log Scores" },
              { key: "saved", label: "Saved" },
            ].map((item) => {
              const active = tab === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key as Tab)}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {tab === "setup" ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Create rollup</Text>
              <Text style={styles.sectionSubtitle}>Build the rollup, groups, and field before you log scores.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Round details</Text>
              <TextInput
                value={round.name}
                onChangeText={(value) => setRound((current) => ({ ...current, name: value }))}
                placeholder="Round name"
                placeholderTextColor="#8a877f"
                style={styles.input}
              />
              <TextInput
                value={round.date}
                onChangeText={(value) => setRound((current) => ({ ...current, date: value }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#8a877f"
                style={styles.input}
              />
              <View style={styles.buttonRow}>
                <Pressable onPress={() => { setRound(blankRound()); setSelectedHole(1); setTab("setup"); }} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>New blank round</Text>
                </Pressable>
                <Pressable onPress={() => setTab("live")} style={styles.primaryButton}>
                  <Text style={styles.primaryText}>Log scores</Text>
                </Pressable>
              </View>
              {__DEV__ ? (
                <View style={styles.subCard}>
                  <Text style={styles.smallLabel}>Dev only</Text>
                  <Text style={styles.meta}>Load a mixed-field test round with 4 groups: one 4-ball and three 3-balls.</Text>
                  <Pressable onPress={loadGhostTestRound} style={styles.smallButton}>
                    <Text style={styles.smallButtonText}>Load ghost test round</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Course setup</Text>
                <Pressable onPress={() => setCourseSetupExpanded((current) => !current)} style={styles.smallButton}>
                  <Text style={styles.smallButtonText}>{courseSetupExpanded ? "Hide holes" : "Show holes"}</Text>
                </Pressable>
              </View>
              <TextInput
                value={round.courseName}
                onChangeText={(value) => setRound((current) => ({ ...current, courseName: value.slice(0, 40) }))}
                placeholder="Course name"
                placeholderTextColor="#8a877f"
                style={styles.input}
              />
              <Text style={styles.sectionSubtitle}>
                {round.courseName} • {selectedTee.name} • {totalYardageValue} yds • Par {totalParValue} • CR {selectedTee.courseRating} • Slope {selectedTee.slopeRating}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {round.tees.map((tee) => {
                  const active = selectedTeeId === tee.id;
                  return (
                    <Pressable
                      key={tee.id}
                      onPress={() => setSelectedTeeId(tee.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{tee.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.subCard}>
                <Text style={styles.smallLabel}>Selected tee</Text>
                <TextInput
                  value={selectedTee.name}
                  onChangeText={(value) =>
                    setRound((current) => ({
                      ...current,
                      tees: current.tees.map((tee) =>
                        tee.id === selectedTeeId ? { ...tee, name: value.slice(0, 18) || tee.name } : tee,
                      ),
                    }))
                  }
                  placeholder="Tee name"
                  placeholderTextColor="#8a877f"
                  style={styles.input}
                />
                <View style={styles.courseMetaRow}>
                  <View style={styles.courseMetaInputWrap}>
                    <Text style={styles.smallLabel}>CR</Text>
                    <TextInput
                      value={String(selectedTee.courseRating)}
                      onChangeText={(value) =>
                        setRound((current) => ({
                          ...current,
                          tees: current.tees.map((tee) =>
                            tee.id === selectedTeeId
                              ? {
                                  ...tee,
                                  courseRating: Number.parseFloat(value.replace(/[^0-9.]/g, "").slice(0, 4) || String(tee.courseRating)),
                                }
                              : tee,
                          ),
                        }))
                      }
                      keyboardType="decimal-pad"
                      placeholder="70.0"
                      placeholderTextColor="#8a877f"
                      style={styles.courseInput}
                    />
                  </View>
                  <View style={styles.courseMetaInputWrap}>
                    <Text style={styles.smallLabel}>Slope</Text>
                    <TextInput
                      value={String(selectedTee.slopeRating)}
                      onChangeText={(value) =>
                        setRound((current) => ({
                          ...current,
                          tees: current.tees.map((tee) =>
                            tee.id === selectedTeeId
                              ? {
                                  ...tee,
                                  slopeRating: Math.min(155, Math.max(55, Number(value.replace(/[^0-9]/g, "").slice(0, 3) || tee.slopeRating))),
                                }
                              : tee,
                          ),
                        }))
                      }
                      keyboardType="number-pad"
                      placeholder="120"
                      placeholderTextColor="#8a877f"
                      style={styles.courseInput}
                    />
                  </View>
                </View>
                <Pressable
                  onPress={() =>
                    setRound((current) => ({
                      ...current,
                      courseName: DEFAULT_COURSE_NAME,
                      tees: defaultTees(),
                    }))
                  }
                  style={styles.smallButton}
                >
                  <Text style={styles.smallButtonText}>Reset default course</Text>
                </Pressable>
              </View>
              {courseSetupExpanded ? (
                <>
                  <Text style={styles.sectionSubtitle}>Edit the hole name, yardage, par, and stroke index for the selected tee.</Text>
                  {selectedTee.course.map((hole, index) => (
                    <View key={hole.number} style={styles.courseRow}>
                      <View style={styles.courseLabelWrap}>
                        <Text style={styles.itemTitle}>Hole {hole.number}</Text>
                        <TextInput
                          value={hole.name}
                          onChangeText={(value) =>
                            setRound((current) => ({
                              ...current,
                              tees: current.tees.map((tee) =>
                                tee.id === selectedTeeId
                                  ? {
                                      ...tee,
                                      course: tee.course.map((currentHole, holeIndex) =>
                                        holeIndex === index
                                          ? {
                                              ...currentHole,
                                              name: value.slice(0, 24) || currentHole.name,
                                            }
                                          : currentHole,
                                      ),
                                    }
                                  : tee,
                              ),
                            }))
                          }
                          placeholder="Hole name"
                          placeholderTextColor="#8a877f"
                          style={styles.courseNameInput}
                        />
                      </View>
                      <View style={styles.courseInputWrap}>
                        <Text style={styles.smallLabel}>Yds</Text>
                        <TextInput
                          value={String(hole.yardage)}
                          onChangeText={(value) =>
                            setRound((current) => ({
                              ...current,
                              tees: current.tees.map((tee) =>
                                tee.id === selectedTeeId
                                  ? {
                                      ...tee,
                                      course: tee.course.map((currentHole, holeIndex) =>
                                        holeIndex === index
                                          ? {
                                              ...currentHole,
                                              yardage: Math.max(1, Number(value.replace(/[^0-9]/g, "").slice(0, 3) || currentHole.yardage)),
                                            }
                                          : currentHole,
                                      ),
                                    }
                                  : tee,
                              ),
                            }))
                          }
                          keyboardType="number-pad"
                          placeholder="350"
                          placeholderTextColor="#8a877f"
                          style={styles.courseInput}
                        />
                      </View>
                      <View style={styles.courseInputWrap}>
                        <Text style={styles.smallLabel}>Par</Text>
                        <TextInput
                          value={String(hole.par)}
                          onChangeText={(value) =>
                            setRound((current) => ({
                              ...current,
                              tees: current.tees.map((tee) =>
                                tee.id === selectedTeeId
                                  ? {
                                      ...tee,
                                      course: tee.course.map((currentHole, holeIndex) =>
                                        holeIndex === index
                                          ? {
                                              ...currentHole,
                                              par: Math.min(6, Math.max(3, Number(value.replace(/[^0-9]/g, "").slice(0, 1) || currentHole.par))),
                                            }
                                          : currentHole,
                                      ),
                                    }
                                  : tee,
                              ),
                            }))
                          }
                          keyboardType="number-pad"
                          placeholder="4"
                          placeholderTextColor="#8a877f"
                          style={styles.courseInput}
                        />
                      </View>
                      <View style={styles.courseInputWrap}>
                        <Text style={styles.smallLabel}>SI</Text>
                        <TextInput
                          value={String(hole.strokeIndex)}
                          onChangeText={(value) =>
                            setRound((current) => ({
                              ...current,
                              tees: current.tees.map((tee) =>
                                tee.id === selectedTeeId
                                  ? {
                                      ...tee,
                                      course: tee.course.map((currentHole, holeIndex) =>
                                        holeIndex === index
                                          ? {
                                              ...currentHole,
                                              strokeIndex: Math.min(18, Math.max(1, Number(value.replace(/[^0-9]/g, "").slice(0, 2) || currentHole.strokeIndex))),
                                            }
                                          : currentHole,
                                      ),
                                    }
                                  : tee,
                              ),
                            }))
                          }
                          keyboardType="number-pad"
                          placeholder="1"
                          placeholderTextColor="#8a877f"
                          style={styles.courseInput}
                        />
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.meta}>Course details are collapsed to keep setup shorter. Tap `Show holes` when you want to edit all 18.</Text>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Groups</Text>
                <Pressable
                  onPress={() =>
                    setRoster((current) => ({
                      ...current,
                      groups: [...current.groups, { id: id("group"), name: `Group ${current.groups.length + 1}` }],
                    }))
                  }
                  style={styles.smallButton}
                >
                  <Text style={styles.smallButtonText}>Add group</Text>
                </Pressable>
              </View>
              {round.groups.map((group) => {
                const size = round.players.filter((player) => player.groupId === group.id).length;
                const removable = size === 0 && round.groups.length > 1;
                return (
                  <View key={group.id} style={styles.subCard}>
                    <TextInput
                      value={group.name}
                      onChangeText={(value) =>
                        setRoster((current) => ({
                          ...current,
                          groups: current.groups.map((currentGroup) =>
                            currentGroup.id === group.id ? { ...currentGroup, name: value.slice(0, 24) } : currentGroup,
                          ),
                        }))
                      }
                      placeholder="Group name"
                      placeholderTextColor="#8a877f"
                      style={styles.input}
                    />
                    <Text style={styles.meta}>{groupLabel(size)} • {groupNote(size)}</Text>
                    {removable ? (
                      <Pressable
                        onPress={() =>
                          setRoster((current) => ({
                            ...current,
                            groups: current.groups.filter((currentGroup) => currentGroup.id !== group.id),
                          }))
                        }
                        style={styles.smallButton}
                      >
                        <Text style={styles.smallButtonText}>Remove empty group</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Add player</Text>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Player name"
                placeholderTextColor="#8a877f"
                style={styles.input}
              />
              <TextInput
                value={draftHandicap}
                onChangeText={(value) => setDraftHandicap(value.replace(/[^0-9]/g, "").slice(0, 2))}
                keyboardType="number-pad"
                placeholder="Handicap"
                placeholderTextColor="#8a877f"
                style={styles.input}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {round.tees.map((tee) => {
                  const active = draftTeeId === tee.id;
                  return (
                    <Pressable
                      key={tee.id}
                      onPress={() => setDraftTeeId(tee.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{tee.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {round.groups.map((group) => {
                  const active = draftGroupId === group.id;
                  return (
                    <Pressable
                      key={group.id}
                      onPress={() => setDraftGroupId(group.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{group.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                onPress={() => {
                  const name = draftName.trim();
                  if (!name || !draftGroupId) {
                    return;
                  }
                  setRoster((current) => ({
                    ...current,
                    players: [
                      ...current.players,
                      {
                        id: id("player"),
                        name,
                        handicap: Number(draftHandicap || "0"),
                        groupId: draftGroupId,
                        teeId: draftTeeId,
                        scores: {},
                      },
                    ],
                  }));
                  setDraftName("");
                  setDraftHandicap("18");
                }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryText}>Add player</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Field</Text>
              {round.players.length === 0 ? (
                <Text style={styles.meta}>Add players above to build the field.</Text>
              ) : (
                round.players.map((player) => (
                  <View key={player.id} style={styles.subCard}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.smallLabel}>Player</Text>
                      <Pressable
                        onPress={() =>
                          setRoster((current) => ({
                            ...current,
                            players: current.players.filter((currentPlayer) => currentPlayer.id !== player.id),
                          }))
                        }
                        style={styles.smallButton}
                      >
                        <Text style={styles.smallButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                    <TextInput
                      value={player.name}
                      onChangeText={(value) =>
                        setRoster((current) => ({
                          ...current,
                          players: current.players.map((currentPlayer) =>
                            currentPlayer.id === player.id ? { ...currentPlayer, name: value.slice(0, 24) } : currentPlayer,
                          ),
                        }))
                      }
                      placeholder="Player name"
                      placeholderTextColor="#8a877f"
                      style={styles.input}
                    />
                    <TextInput
                      value={String(player.handicap)}
                      onChangeText={(value) =>
                        setRoster((current) => ({
                          ...current,
                          players: current.players.map((currentPlayer) =>
                            currentPlayer.id === player.id
                              ? { ...currentPlayer, handicap: Number(value.replace(/[^0-9]/g, "").slice(0, 2) || "0") }
                              : currentPlayer,
                          ),
                        }))
                      }
                      keyboardType="number-pad"
                      placeholder="Handicap"
                      placeholderTextColor="#8a877f"
                      style={styles.input}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {round.tees.map((tee) => {
                        const active = player.teeId === tee.id;
                        return (
                          <Pressable
                            key={tee.id}
                            onPress={() =>
                              setRoster((current) => ({
                                ...current,
                                players: current.players.map((currentPlayer) =>
                                  currentPlayer.id === player.id ? { ...currentPlayer, teeId: tee.id } : currentPlayer,
                                ),
                              }))
                            }
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{tee.name}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {round.groups.map((group) => {
                        const active = player.groupId === group.id;
                        return (
                          <Pressable
                            key={group.id}
                            onPress={() =>
                              setRoster((current) => ({
                                ...current,
                                players: current.players.map((currentPlayer) =>
                                  currentPlayer.id === player.id ? { ...currentPlayer, groupId: group.id } : currentPlayer,
                                ),
                              }))
                            }
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{group.name}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ))
              )}
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteText}>
                {invalidGroups.length === 0
                  ? "All groups currently fit the 3-ball or 4-ball rule."
                  : `${invalidGroups.length} group${invalidGroups.length === 1 ? "" : "s"} still need adjusting before score logging.`}
              </Text>
              <Text style={styles.noteText}>In a mixed field, every 3-ball uses the same drawn real player from anywhere in the field for the whole round.</Text>
              <Text style={styles.noteText}>If every group is a 3-ball, the team score is the best 2 Stableford scores per hole. If every group is a 4-ball, it is the best 3 per hole. Mixed fields give every 3-ball the same ghost and still count the best 3 per hole.</Text>
            </View>
          </>
        ) : null}

        {tab === "live" ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{round.name}</Text>
              <Text style={styles.sectionSubtitle}>{round.courseName} • {formatDate(round.date)} • Log scores and review Stableford group totals</Text>
            </View>

            <View style={styles.tabRow}>
              <Pressable onPress={() => setLiveSection("entry")} style={[styles.segmentButton, liveSection === "entry" && styles.segmentButtonActive]}>
                <Text style={[styles.segmentText, liveSection === "entry" && styles.segmentTextActive]}>Entry</Text>
              </Pressable>
              <Pressable onPress={() => setLiveSection("players")} style={[styles.segmentButton, liveSection === "players" && styles.segmentButtonActive]}>
                <Text style={[styles.segmentText, liveSection === "players" && styles.segmentTextActive]}>Players (LB)</Text>
              </Pressable>
              <Pressable onPress={() => setLiveSection("groups")} style={[styles.segmentButton, liveSection === "groups" && styles.segmentButtonActive]}>
                <Text style={[styles.segmentText, liveSection === "groups" && styles.segmentTextActive]}>Groups (LB)</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.smallLabel}>Round snapshot</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.itemText}>Leading player</Text>
                <Text style={styles.itemValue}>
                  {rankedPlayers[0] ? `${rankedPlayers[0].name} • ${rankedPlayers[0].total} pts` : "No scores yet"}
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.itemText}>Lowest player</Text>
                <Text style={styles.itemValue}>
                  {lowestPointsPlayer
                    ? `${lowestPointsPlayer.name} • ${lowestPointsPlayer.total} pts`
                    : "No scores yet"}
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.itemText}>Leading group</Text>
                <Text style={styles.itemValue}>
                  {rankedGroups[0] ? `${rankedGroups[0].name} • ${rankedGroups[0].total} pts` : "No group result yet"}
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => {
                  setSavedRounds((current) => [
                    { ...cloneRound(round), id: id("saved"), savedAt: new Date().toISOString() },
                    ...current,
                  ]);
                  setTab("saved");
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>Save round</Text>
              </Pressable>
              {scoringSummary.mixedThreeAndFour ? (
                <Pressable
                  onPress={() =>
                    setRound((current) => ({
                      ...current,
                      ghosts: syncGhosts(current.players, current.groups, current.ghosts, true),
                    }))
                  }
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryText}>Redraw ghost</Text>
                </Pressable>
              ) : (
                <View style={styles.primaryButton}>
                  <Text style={styles.primaryText}>
                    {scoringSummary.allThree ? "Best 2 count" : scoringSummary.allFour ? "Best 3 count" : "Scoring rules set"}
                  </Text>
                </View>
              )}
            </View>

            <Pressable onPress={clearCurrentRound} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>Clear current round</Text>
            </Pressable>

            {liveSection === "groups" ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Group leaderboard</Text>
                  <Text style={styles.sectionSubtitle}>
                    {scoringSummary.mixedThreeAndFour
                      ? "Mixed field: 4-balls count best 3, and every 3-ball shares one ghost so they also count best 3."
                      : scoringSummary.allThree
                        ? "All 3-balls: each group counts the best 2 Stableford scores on every hole."
                        : "All 4-balls: each group counts the best 3 Stableford scores on every hole."}
                  </Text>
                </View>

                {rankedGroups.length === 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.meta}>There are no players in the active round yet.</Text>
                  </View>
                ) : (
                  rankedGroups.map((group, index) => (
                    <View key={group.id} style={styles.card}>
                      <View style={styles.rankRow}>
                        <View style={styles.rankLeft}>
                          <Text style={styles.rankNumber}>{index + 1}</Text>
                          <View>
                            <Text style={styles.itemTitle}>{group.name}</Text>
                            <Text style={styles.meta}>{groupLabel(group.size)} • Best {group.scoresToCount} scores • {group.holeTotal} points on hole {currentHole.number}</Text>
                          </View>
                        </View>
                        <View style={styles.badge}>
                          <Text style={styles.badgeValue}>{group.total}</Text>
                          <Text style={styles.badgeLabel}>pts</Text>
                        </View>
                      </View>
                      {group.members.map((player) => (
                        <View key={player.id} style={styles.rowBetween}>
                          <Text style={styles.itemText}>{player.name}</Text>
                          <Text style={styles.itemValue}>{player.total} pts</Text>
                        </View>
                      ))}
                      {group.includeGhost ? (
                        <View style={styles.subCard}>
                          <Text style={styles.smallLabel}>Ghost player</Text>
                          <Text style={styles.itemTitle}>{group.ghost?.name ?? "No ghost drawn"}</Text>
                          <Text style={styles.meta}>
                            {group.ghost
                              ? `This mixed-field 3-ball shares ${group.ghost.name} with the other 3-balls and takes the best 3 scores on each hole.`
                              : "Draw one shared ghost from anywhere in the field."}
                          </Text>
                          <Pressable
                            onPress={() =>
                              setRound((current) => ({
                                ...current,
                                ghosts: syncGhosts(current.players, current.groups, current.ghosts, true),
                              }))
                            }
                            style={styles.primaryButton}
                          >
                            <Text style={styles.primaryText}>Change shared ghost</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.infoBox}>
                          <Text style={styles.infoText}>
                            {group.size === 3
                              ? `This 3-ball is counting the best ${group.scoresToCount} scores on each hole.`
                              : `This 4-ball is counting the best ${group.scoresToCount} scores on each hole.`}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </>
            ) : null}

            {liveSection === "players" ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Individual leaderboard</Text>
                  <Text style={styles.sectionSubtitle}>Ranked by each player&apos;s Stableford total. Tap a points badge to open the logged round.</Text>
                </View>

                <View style={styles.card}>
                  {rankedPlayers.length === 0 ? (
                    <Text style={styles.meta}>Add players before score logging begins.</Text>
                  ) : (
                    rankedPlayers.map((player, index) => (
                      <View key={player.id} style={styles.rankRow}>
                        <View style={styles.rankLeft}>
                          <Text style={styles.rankNumber}>{index + 1}</Text>
                          <View>
                            <Text style={styles.itemTitle}>{player.name}</Text>
                            <Text style={styles.meta}>
                              {round.groups.find((group) => group.id === player.groupId)?.name ?? "Group"} • {teeForPlayer(round.tees, player.teeId)?.name ?? "Tee"} • HI {player.handicap} • {player.done}/18 holes
                            </Text>
                          </View>
                        </View>
                        <Pressable onPress={() => setSelectedPlayerId(player.id)} style={styles.badge}>
                          <Text style={styles.badgeValue}>{player.total}</Text>
                          <Text style={styles.badgeLabel}>pts</Text>
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              </>
            ) : null}

            {liveSection === "entry" ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Score entry</Text>
                  <Text style={styles.sectionSubtitle}>Log scores by group one hole at a time, or switch to one player and fill the whole round in one go.</Text>
                </View>

                <View style={styles.tabRow}>
                  <Pressable onPress={() => setScoreEntryMode("group")} style={[styles.segmentButton, scoreEntryMode === "group" && styles.segmentButtonActive]}>
                    <Text style={[styles.segmentText, scoreEntryMode === "group" && styles.segmentTextActive]}>By group</Text>
                  </Pressable>
                  <Pressable onPress={() => setScoreEntryMode("player")} style={[styles.segmentButton, scoreEntryMode === "player" && styles.segmentButtonActive]}>
                    <Text style={[styles.segmentText, scoreEntryMode === "player" && styles.segmentTextActive]}>By player</Text>
                  </Pressable>
                </View>

                {scoreEntryMode === "group" ? (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {selectedTee.course.map((hole) => {
                        const active = hole.number === selectedHole;
                        return (
                          <Pressable key={hole.number} onPress={() => setSelectedHole(hole.number)} style={[styles.holeChip, active && styles.chipActive]}>
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{hole.number}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    <View style={styles.card}>
                      <View style={styles.subCard}>
                        <Text style={styles.itemTitle}>Hole {currentHole.number}</Text>
                        <Text style={styles.meta}>{currentHole.name}</Text>
                        <Text style={styles.meta}>
                          Par, stroke index, and yardage can vary by tee. Current view: {selectedTee.name} • {currentHole.yardage} yds • CR {selectedTee.courseRating} • Slope {selectedTee.slopeRating}
                        </Text>
                      </View>
                      <View style={styles.subCard}>
                        {round.tees.map((tee) => {
                          const teeHole = tee.course.find((hole) => hole.number === selectedHole) ?? tee.course[0];
                          return (
                            <View key={tee.id} style={styles.rowBetween}>
                              <Text style={styles.itemText}>{tee.name} • {teeHole.name}</Text>
                              <Text style={styles.itemValue}>{teeHole.yardage} yds • Par {teeHole.par} • SI {teeHole.strokeIndex}</Text>
                            </View>
                          );
                        })}
                      </View>
                      {round.groups.map((group) => {
                        const members = round.players.filter((player) => player.groupId === group.id);
                        if (members.length === 0) {
                          return null;
                        }
                        return (
                          <View key={group.id} style={styles.subCard}>
                            <Text style={styles.itemTitle}>{group.name}</Text>
                            {members.map((player) => (
                              <View key={player.id} style={styles.scoreRow}>
                                <View style={styles.scoreInfo}>
                                  <Text style={styles.itemText}>{player.name}</Text>
                                  <Text style={styles.meta}>
                                    {teeForPlayer(round.tees, player.teeId)?.name ?? "Tee"} • HI {player.handicap} • Gets {strokes(player.handicap, holeForPlayer(round.tees, player, selectedHole).strokeIndex)} shot{strokes(player.handicap, holeForPlayer(round.tees, player, selectedHole).strokeIndex) === 1 ? "" : "s"}
                                  </Text>
                                </View>
                            <TextInput
                              ref={(ref) => {
                                inputRefs.current[`group:${selectedHole}:${player.id}`] = ref;
                              }}
                              value={scoreDisplayValue(player.scores[currentHole.number])}
                              onChangeText={(value) =>
                                handleScoreInputChange(
                                  player.id,
                                  currentHole.number,
                                  value,
                                  groupEntryKeys,
                                  `group:${selectedHole}:${player.id}`,
                                )
                              }
                              keyboardType="number-pad"
                              placeholder="Score"
                              placeholderTextColor="#8a877f"
                              maxLength={1}
                              blurOnSubmit={false}
                              style={[styles.scoreInput, player.scores[currentHole.number] === BLOB_SCORE && styles.scoreInputBlob]}
                            />
                                <Pressable
                                  onPress={() =>
                                    toggleBlobScore(
                                      player.id,
                                      currentHole.number,
                                      groupEntryKeys,
                                      `group:${selectedHole}:${player.id}`,
                                    )
                                  }
                                  style={[styles.blobButton, player.scores[currentHole.number] === BLOB_SCORE && styles.blobButtonActive]}
                                >
                                  <Text style={[styles.blobButtonText, player.scores[currentHole.number] === BLOB_SCORE && styles.blobButtonTextActive]}>
                                    Blob
                                  </Text>
                                </Pressable>
                                <Pressable onPress={() => setSelectedPlayerId(player.id)} style={styles.pointsBox}>
                                  <Text style={styles.pointsText}>{holePoints(player, holeForPlayer(round.tees, player, selectedHole))}</Text>
                                  <Text style={styles.badgeLabel}>pts</Text>
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {rankedPlayers.map((player) => {
                        const active = player.id === scoreEntryPlayer?.id;
                        return (
                          <Pressable
                            key={player.id}
                            onPress={() => setScoreEntryPlayerId(player.id)}
                            style={[styles.playerChip, active && styles.playerChipActive]}
                          >
                            <Text style={[styles.playerChipName, active && styles.playerChipNameActive]}>{player.name}</Text>
                            <Text style={[styles.playerChipMeta, active && styles.playerChipMetaActive]}>
                              {teeForPlayer(round.tees, player.teeId)?.name ?? "Tee"} • {player.total} pts
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    {scoreEntryPlayer ? (
                      <View style={styles.card}>
                        <View style={styles.subCard}>
                          <Text style={styles.itemTitle}>{scoreEntryPlayer.name}</Text>
                          <Text style={styles.meta}>
                            {round.groups.find((group) => group.id === scoreEntryPlayer.groupId)?.name ?? "Group"} • {teeForPlayer(round.tees, scoreEntryPlayer.teeId)?.name ?? "Tee"} • HI {scoreEntryPlayer.handicap}
                          </Text>
                          <Text style={styles.meta}>
                            Enter the whole round for one player here. Tap the points box to open the round summary view.
                          </Text>
                        </View>
                        {scoreEntryCourse.map((hole) => (
                          <View key={hole.number} style={styles.playerEntryRow}>
                            <View style={styles.playerEntryInfo}>
                              <Text style={styles.itemText}>Hole {hole.number} • {hole.name}</Text>
                              <Text style={styles.meta}>
                                Par {hole.par} • SI {hole.strokeIndex} • {hole.yardage} yds • Gets {strokes(scoreEntryPlayer.handicap, hole.strokeIndex)} shot{strokes(scoreEntryPlayer.handicap, hole.strokeIndex) === 1 ? "" : "s"}
                              </Text>
                            </View>
                            <TextInput
                              ref={(ref) => {
                                inputRefs.current[`player:${scoreEntryPlayer.id}:${hole.number}`] = ref;
                              }}
                              value={scoreDisplayValue(scoreEntryPlayer.scores[hole.number])}
                              onChangeText={(value) =>
                                handleScoreInputChange(
                                  scoreEntryPlayer.id,
                                  hole.number,
                                  value,
                                  playerEntryKeys,
                                  `player:${scoreEntryPlayer.id}:${hole.number}`,
                                )
                              }
                              keyboardType="number-pad"
                              placeholder="Score"
                              placeholderTextColor="#8a877f"
                              maxLength={1}
                              blurOnSubmit={false}
                              style={[styles.scoreInput, scoreEntryPlayer.scores[hole.number] === BLOB_SCORE && styles.scoreInputBlob]}
                            />
                            <Pressable
                              onPress={() =>
                                toggleBlobScore(
                                  scoreEntryPlayer.id,
                                  hole.number,
                                  playerEntryKeys,
                                  `player:${scoreEntryPlayer.id}:${hole.number}`,
                                )
                              }
                              style={[styles.blobButton, scoreEntryPlayer.scores[hole.number] === BLOB_SCORE && styles.blobButtonActive]}
                            >
                              <Text style={[styles.blobButtonText, scoreEntryPlayer.scores[hole.number] === BLOB_SCORE && styles.blobButtonTextActive]}>
                                Blob
                              </Text>
                            </Pressable>
                            <Pressable onPress={() => setSelectedPlayerId(scoreEntryPlayer.id)} style={styles.pointsBox}>
                              <Text style={styles.pointsText}>{holePoints(scoreEntryPlayer, hole)}</Text>
                              <Text style={styles.badgeLabel}>pts</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.card}>
                        <Text style={styles.meta}>Add players before using player-by-player score entry.</Text>
                      </View>
                    )}
                  </>
                )}
              </>
            ) : null}
          </>
        ) : null}

        {tab === "saved" ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Saved rounds</Text>
              <Text style={styles.sectionSubtitle}>{storageMessage}</Text>
            </View>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() =>
                  setSavedRounds((current) => [
                    { ...cloneRound(round), id: id("saved"), savedAt: new Date().toISOString() },
                    ...current,
                  ])
                }
                style={styles.primaryButton}
              >
                <Text style={styles.primaryText}>Save current round</Text>
              </Pressable>
              <Pressable onPress={() => { setRound(blankRound()); setSelectedHole(1); setTab("setup"); }} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Start new round</Text>
              </Pressable>
            </View>
            {savedRounds.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.meta}>No saved rounds yet. Save one from the score logging tab.</Text>
              </View>
            ) : (
              savedRounds.map((saved) => {
                const players = [...saved.players]
                  .map((player) => ({
                    ...player,
                    total: totalPoints(player, saved.tees),
                    done: completed(player, saved.tees),
                    holePoints: playerHolePoints(player, saved.tees),
                  }))
                  .sort(comparePlayers);
                const topPlayer = players[0];
                const savedSummary = groupSizeSummary(saved.groups, saved.players);
                const groupTotals = saved.groups
                  .map((group) => {
                    const members = players.filter((player) => player.groupId === group.id);
                    const ghost = saved.ghosts[group.id] ? players.find((player) => player.id === saved.ghosts[group.id]) ?? null : null;
                    const scoresToCount = countingScoresForGroup(members.length, savedSummary);
                    const includeGhost = savedSummary.mixedThreeAndFour && members.length === 3;
                    return {
                      ...group,
                      total: groupRoundTotal(saved.tees, members, ghost, scoresToCount, includeGhost),
                    };
                  })
                  .sort((a, b) => b.total - a.total);
                return (
                  <View key={saved.id} style={styles.card}>
                    <Text style={styles.itemTitle}>{saved.name}</Text>
                    <Text style={styles.meta}>{saved.courseName} • {formatDate(saved.date)} • Saved {formatDate(saved.savedAt)}</Text>
                    <Text style={styles.itemText}>{saved.players.length} players across {saved.groups.length} groups</Text>
                    <Text style={styles.itemText}>{topPlayer ? `Top player: ${topPlayer.name} on ${topPlayer.total} points` : "No player summary available"}</Text>
                    <Text style={styles.itemText}>{groupTotals[0] ? `Top group: ${groupTotals[0].name} on ${groupTotals[0].total} points` : "No group summary available"}</Text>
                    <View style={styles.buttonRow}>
                      <Pressable onPress={() => { setRound(normalizeRound(saved)); setSelectedHole(1); setTab("live"); }} style={styles.primaryButton}>
                        <Text style={styles.primaryText}>Load round</Text>
                      </Pressable>
                      <Pressable onPress={() => setSavedRounds((current) => current.filter((item) => item.id !== saved.id))} style={styles.secondaryButton}>
                        <Text style={styles.secondaryText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : null}

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>Stableford points are calculated from gross score, handicap, and stroke index.</Text>
          <Text style={styles.noteText}>Group scores are counted hole by hole using best-ball rules: best 3 from a 4-ball, best 2 from an all-3-ball field, or best 3 with a ghost when 3s and 4s are mixed.</Text>
          <Text style={styles.noteText}>Individual ties are split by countback on the last 9 holes, then last 6, last 3, and final hole.</Text>
          <Text style={styles.noteText}>In mixed fields, the shared ghost player stays with every 3-ball for the whole round, never hole by hole.</Text>
          <Text style={styles.noteText}>Saved rounds are written to local device storage so they can be reopened later on the same device.</Text>
        </View>
      </ScrollView>
      <Modal
        visible={!!selectedPlayer}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPlayerId(null)}
      >
        <View style={styles.modalScrim}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedPlayerId(null)} />
          <View style={styles.modalCard}>
            {selectedPlayer ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleWrap}>
                    <Text style={styles.smallLabel}>Player round</Text>
                    <Text style={styles.modalTitle}>{selectedPlayer.name}</Text>
                    <Text style={styles.meta}>
                      {round.groups.find((group) => group.id === selectedPlayer.groupId)?.name ?? "Group"} • {selectedPlayerTee?.name ?? "Tee"} • HI {selectedPlayer.handicap}
                    </Text>
                  </View>
                  <Pressable onPress={() => setSelectedPlayerId(null)} style={styles.modalCloseButton}>
                    <Text style={styles.secondaryText}>Close</Text>
                  </Pressable>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>{totalPoints(selectedPlayer, round.tees)} points</Text>
                  <Text style={styles.meta}>
                    {completed(selectedPlayer, round.tees)}/18 holes completed • Countback uses the last 9, 6, 3, then 1 hole.
                  </Text>
                </View>
                <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                  {selectedPlayerCourse.map((hole) => {
                    const gross = selectedPlayer.scores[hole.number] ?? "";
                    const points = holePoints(selectedPlayer, hole);
                    return (
                      <View key={hole.number} style={styles.modalHoleRow}>
                        <View style={styles.modalHoleLeft}>
                          <View style={styles.modalHoleNumber}>
                            <Text style={styles.modalHoleNumberText}>{hole.number}</Text>
                          </View>
                          <View style={styles.courseLabelWrap}>
                            <Text style={styles.itemText}>{hole.name}</Text>
                            <Text style={styles.meta}>Par {hole.par} • SI {hole.strokeIndex} • {hole.yardage} yds</Text>
                          </View>
                        </View>
                        <View style={styles.modalStat}>
                          <Text style={styles.modalStatLabel}>Gross</Text>
                          <Text style={styles.modalStatValue}>{gross === BLOB_SCORE ? "Blob" : gross || "-"}</Text>
                        </View>
                        <View style={styles.modalStat}>
                          <Text style={styles.modalStatLabel}>Pts</Text>
                          <Text style={styles.modalStatValue}>{gross ? points : "-"}</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 36, gap: 18 },
  hero: { backgroundColor: colors.green, borderRadius: 28, padding: 24, gap: 16 },
  kicker: { color: colors.sand, fontSize: 13, fontWeight: "700", letterSpacing: 1.8, textTransform: "uppercase" },
  heroTitle: { color: "#fcfbf5", fontSize: 30, lineHeight: 36, fontWeight: "700" },
  heroCopy: { color: "#d5e4d7", fontSize: 15, lineHeight: 22 },
  statRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 10 },
  statValue: { color: "#ffffff", fontSize: 24, fontWeight: "700", textAlign: "center" },
  statLabel: { color: "#ccdacd", fontSize: 12, textAlign: "center", marginTop: 4 },
  tabRow: { flexDirection: "row", gap: 10 },
  tabButton: { flex: 1, backgroundColor: "rgba(255,255,255,0.09)", borderRadius: 16, paddingVertical: 12, alignItems: "center" },
  tabButtonActive: { backgroundColor: colors.sand },
  tabText: { color: "#dce5dd", fontWeight: "700", fontSize: 14 },
  tabTextActive: { color: colors.ink },
  segmentButton: { flex: 1, backgroundColor: "#e8e0cd", borderRadius: 16, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  segmentButtonActive: { backgroundColor: colors.green, borderColor: colors.green },
  segmentText: { color: colors.green2, fontWeight: "700", fontSize: 14 },
  segmentTextActive: { color: "#ffffff" },
  section: { gap: 3 },
  sectionTitle: { color: colors.ink, fontSize: 24, fontWeight: "700" },
  sectionSubtitle: { color: colors.muted, fontSize: 14 },
  card: { backgroundColor: colors.panel, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: colors.border, gap: 12 },
  subCard: { backgroundColor: colors.pale, borderRadius: 18, padding: 14, gap: 10 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: "#ffffff", paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: colors.ink },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  buttonRow: { flexDirection: "row", gap: 12 },
  primaryButton: { flex: 1, backgroundColor: colors.green, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center" },
  secondaryButton: { flex: 1, backgroundColor: colors.soft, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center" },
  primaryText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  secondaryText: { color: colors.green2, fontWeight: "700", fontSize: 14 },
  smallButton: { alignSelf: "flex-start", backgroundColor: colors.soft, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  smallButtonText: { color: colors.green2, fontWeight: "700", fontSize: 12 },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: { backgroundColor: "#e6dfcf", borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  chipActive: { backgroundColor: colors.green },
  chipText: { color: colors.green2, fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: "#ffffff" },
  courseRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee4d1" },
  courseLabelWrap: { flex: 1 },
  courseNameInput: { marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink },
  courseMetaRow: { flexDirection: "row", gap: 10 },
  courseMetaInputWrap: { flex: 1, gap: 6 },
  courseInputWrap: { width: 72, gap: 6 },
  courseInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: "#ffffff", paddingVertical: 10, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.ink },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  smallLabel: { color: colors.green2, fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1 },
  summaryCard: { backgroundColor: colors.sand, borderRadius: 20, padding: 16, gap: 4 },
  summaryTitle: { color: colors.ink, fontSize: 24, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  rankRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingBottom: 10 },
  rankLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rankNumber: { width: 34, height: 34, borderRadius: 17, textAlign: "center", textAlignVertical: "center", backgroundColor: "#edf2eb", color: colors.green2, fontWeight: "700", fontSize: 16, overflow: "hidden" },
  badge: { minWidth: 58, borderRadius: 18, backgroundColor: colors.green, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  badgeValue: { color: "#ffffff", fontSize: 20, fontWeight: "700" },
  badgeLabel: { color: "#dce5dd", fontSize: 11 },
  itemTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  itemText: { color: colors.ink, fontSize: 15, lineHeight: 20 },
  itemValue: { color: colors.green2, fontSize: 15, fontWeight: "700" },
  infoBox: { backgroundColor: "#edf2eb", borderRadius: 18, padding: 14 },
  infoText: { color: colors.green2, fontSize: 14, lineHeight: 19 },
  holeChip: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#e6dfcf", alignItems: "center", justifyContent: "center" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreInfo: { flex: 1, gap: 2 },
  playerEntryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#eee4d1" },
  playerEntryInfo: { flex: 1, gap: 2 },
  scoreInput: { width: 68, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: "#ffffff", paddingVertical: 12, textAlign: "center", fontSize: 18, fontWeight: "700", color: colors.ink },
  scoreInputBlob: { color: colors.green2 },
  blobButton: { width: 56, borderRadius: 14, backgroundColor: colors.soft, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  blobButtonActive: { backgroundColor: colors.green },
  blobButtonText: { color: colors.green2, fontSize: 12, fontWeight: "700" },
  blobButtonTextActive: { color: "#ffffff" },
  pointsBox: { width: 58, borderRadius: 16, backgroundColor: "#edf2eb", paddingVertical: 10, alignItems: "center" },
  pointsText: { color: colors.green2, fontSize: 20, fontWeight: "700" },
  playerChip: { backgroundColor: "#e6dfcf", borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
  playerChipActive: { backgroundColor: colors.green },
  playerChipName: { color: colors.green2, fontWeight: "700", fontSize: 14 },
  playerChipNameActive: { color: "#ffffff" },
  playerChipMeta: { color: colors.muted, fontSize: 12 },
  playerChipMetaActive: { color: "#dce5dd" },
  noteCard: { backgroundColor: colors.soft, borderRadius: 22, padding: 18, gap: 10 },
  noteText: { color: "#4e4a41", fontSize: 14, lineHeight: 20 },
  modalScrim: { flex: 1, justifyContent: "center", padding: 20 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,55,38,0.5)" },
  modalCard: { maxHeight: "85%", backgroundColor: colors.panel, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  modalTitleWrap: { flex: 1, gap: 4 },
  modalTitle: { color: colors.ink, fontSize: 28, lineHeight: 32, fontWeight: "700" },
  modalCloseButton: { backgroundColor: colors.soft, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { gap: 10, paddingBottom: 4 },
  modalHoleRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.pale, borderRadius: 18, padding: 12 },
  modalHoleLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  modalHoleNumber: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#edf2eb", alignItems: "center", justifyContent: "center" },
  modalHoleNumberText: { color: colors.green2, fontSize: 16, fontWeight: "700" },
  modalStat: { width: 58, borderRadius: 14, backgroundColor: "#ffffff", paddingVertical: 8, alignItems: "center" },
  modalStatLabel: { color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  modalStatValue: { color: colors.green2, fontSize: 18, fontWeight: "700" },
});
