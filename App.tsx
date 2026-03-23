import { StatusBar } from "expo-status-bar";
import * as FileSystem from "expo-file-system/legacy";
import React, { useEffect, useMemo, useState } from "react";
import {
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
  tees: TeeSet[];
  groups: Group[];
  players: Player[];
  ghosts: Record<string, string | null>;
};
type SavedRound = RoundState & { savedAt: string };
type Tab = "setup" | "live" | "saved";

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
  { id: "red", name: "Red (Ladies)", courseRating: 71.6, slopeRating: 124, yardages: [232, 159, 483, 301, 283, 131, 347, 265, 339, 131, 352, 290, 318, 174, 381, 333, 468, 355] },
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
const scoreEntered = (value: string | undefined) => Number(value) > 0;
const holePoints = (player: Player, hole: Hole) =>
  scoreEntered(player.scores[hole.number])
    ? stableford(Number(player.scores[hole.number]), hole.par, strokes(player.handicap, hole.strokeIndex))
    : 0;
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
const completed = (player: Player, tees: TeeSet[]) =>
  (teeForPlayer(tees, player.teeId)?.course ?? defaultCourse).filter((hole) =>
    scoreEntered(player.scores[hole.number]),
  ).length;

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

function pickGhost(players: Player[], groupId: string, blocked: string[] = []) {
  const memberIds = new Set(players.filter((player) => player.groupId === groupId).map((player) => player.id));
  const ids = shuffle(players.map((player) => player.id));
  return ids.find((playerId) => !memberIds.has(playerId) && !blocked.includes(playerId))
    ?? ids.find((playerId) => !memberIds.has(playerId))
    ?? null;
}

function syncGhosts(players: Player[], groups: Group[], current: Record<string, string | null> = {}, force = false) {
  const next: Record<string, string | null> = {};
  const used = new Set<string>();
  groups.forEach((group) => {
    const members = players.filter((player) => player.groupId === group.id);
    if (members.length !== 3) {
      return;
    }
    const memberIds = new Set(members.map((player) => player.id));
    const existing = current[group.id] ?? null;
    if (!force && existing && !memberIds.has(existing) && !used.has(existing)) {
      next[group.id] = existing;
      used.add(existing);
      return;
    }
    const ghost = pickGhost(players, group.id, [...used]);
    next[group.id] = ghost;
    if (ghost) {
      used.add(ghost);
    }
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

function blankRound(): RoundState {
  return normalizeRound({
    id: id("round"),
    name: "New Rollup",
    date: today(),
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
    return "Uses one drawn player for the whole round.";
  }
  if (size === 4) {
    return "Complete group with no ghost needed.";
  }
  if (size < 3) {
    return "Add more players to make this group valid.";
  }
  return "Too many players. Split this group before scoring.";
}

export default function App() {
  const [tab, setTab] = useState<Tab>("setup");
  const [round, setRound] = useState<RoundState>(() => starterRound());
  const [savedRounds, setSavedRounds] = useState<SavedRound[]>([]);
  const [selectedHole, setSelectedHole] = useState(1);
  const [draftName, setDraftName] = useState("");
  const [draftHandicap, setDraftHandicap] = useState("18");
  const [draftGroupId, setDraftGroupId] = useState("");
  const [draftTeeId, setDraftTeeId] = useState("white");
  const [selectedTeeId, setSelectedTeeId] = useState("white");
  const [storageReady, setStorageReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState(
    STORAGE_URI ? "Loading saved rounds on this device..." : "Local storage is unavailable here.",
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
            activeRound?: RoundState;
            savedRounds?: SavedRound[];
          };
          if (!cancelled && parsed.activeRound) {
            setRound(normalizeRound(parsed.activeRound));
          }
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
          setStorageMessage("Rounds save locally on this device.");
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

  const selectedTee = teeForPlayer(round.tees, selectedTeeId);
  const currentHole = selectedTee?.course.find((hole) => hole.number === selectedHole) ?? selectedTee?.course[0] ?? defaultCourse[0];
  const rankedPlayers = useMemo(
    () =>
      [...round.players]
        .map((player) => ({ ...player, total: totalPoints(player, round.tees), done: completed(player, round.tees) }))
        .sort((a, b) => (b.total !== a.total ? b.total - a.total : b.done - a.done)),
    [round.players, round.tees],
  );
  const playerMap = useMemo(
    () => Object.fromEntries(rankedPlayers.map((player) => [player.id, player])),
    [rankedPlayers],
  );
  const rankedGroups = useMemo(
    () =>
      round.groups
        .map((group) => {
          const members = rankedPlayers.filter((player) => player.groupId === group.id);
          const ghostId = round.ghosts[group.id];
          const ghost = ghostId ? playerMap[ghostId] ?? null : null;
          const total =
            members.reduce((sum, player) => sum + player.total, 0)
            + (members.length === 3 && ghost ? ghost.total : 0);
          const holeTotal =
            members.reduce((sum, player) => sum + holePoints(player, holeForPlayer(round.tees, player, selectedHole)), 0)
            + (members.length === 3 && ghost ? holePoints(ghost, holeForPlayer(round.tees, ghost, selectedHole)) : 0);
          return { ...group, members, ghost, size: members.length, total, holeTotal };
        })
        .sort((a, b) => b.total - a.total),
    [playerMap, rankedPlayers, round.ghosts, round.groups, round.tees, selectedHole],
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Golf Rollup Manager</Text>
          <Text style={styles.heroTitle}>Setup, scoring, and saved rounds in one app.</Text>
          <Text style={styles.heroCopy}>
            Track individual Stableford points, compare mixed 3-balls and 4-balls, and use a round-long drawn player whenever a group only has three golfers.
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
              { key: "setup", label: "Setup" },
              { key: "live", label: "Live Round" },
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
              <Text style={styles.sectionTitle}>Round setup</Text>
              <Text style={styles.sectionSubtitle}>Edit the round, groups, and field before play starts.</Text>
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
                  <Text style={styles.primaryText}>Open scoring</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Course setup</Text>
                <Text style={styles.meta}>
                  {selectedTee.name} • {totalYardageValue} yds • Par {totalParValue} • CR {selectedTee.courseRating} • Slope {selectedTee.slopeRating}
                </Text>
              </View>
              <Text style={styles.sectionSubtitle}>Edit the par and stroke index for each tee set.</Text>
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
              {selectedTee.course.map((hole, index) => (
                <View key={hole.number} style={styles.courseRow}>
                  <View style={styles.courseLabelWrap}>
                    <Text style={styles.itemTitle}>Hole {hole.number}</Text>
                    <Text style={styles.meta}>{hole.name}</Text>
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
                  : `${invalidGroups.length} group${invalidGroups.length === 1 ? "" : "s"} still need adjusting before scoring.`}
              </Text>
              <Text style={styles.noteText}>A 3-ball uses one drawn real player from the rest of the field for the whole round.</Text>
            </View>
          </>
        ) : null}

        {tab === "live" ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{round.name}</Text>
              <Text style={styles.sectionSubtitle}>{formatDate(round.date)} • Live Stableford and group totals</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.smallLabel}>Leading player</Text>
              <Text style={styles.summaryTitle}>{rankedPlayers[0]?.name ?? "No scores yet"}</Text>
              <Text style={styles.meta}>
                {rankedPlayers[0]
                  ? `${rankedPlayers[0].total} points through ${rankedPlayers[0].done} holes`
                  : "Start entering scores to build the leaderboard"}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.smallLabel}>Leading group</Text>
              <Text style={styles.summaryTitle}>{rankedGroups[0]?.name ?? "No group result yet"}</Text>
              <Text style={styles.meta}>{rankedGroups[0] ? `${rankedGroups[0].total} group points` : "Set up the field first"}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.smallLabel}>Selected tee view</Text>
              <Text style={styles.summaryTitle}>{selectedTee.name}</Text>
              <Text style={styles.meta}>{totalYardageValue} yards • Course Rating {selectedTee.courseRating} • Slope {selectedTee.slopeRating}</Text>
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
              <Pressable
                onPress={() =>
                  setRound((current) => ({
                    ...current,
                    ghosts: syncGhosts(current.players, current.groups, current.ghosts, true),
                  }))
                }
                style={styles.primaryButton}
              >
                <Text style={styles.primaryText}>Redraw ghosts</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Group leaderboard</Text>
              <Text style={styles.sectionSubtitle}>3-balls add one drawn player&apos;s full-round score.</Text>
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
                        <Text style={styles.meta}>{groupLabel(group.size)} • {group.holeTotal} points on hole {currentHole.number}</Text>
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
                  {group.size === 3 ? (
                    <View style={styles.subCard}>
                      <Text style={styles.smallLabel}>Ghost player</Text>
                      <Text style={styles.itemTitle}>{group.ghost?.name ?? "No ghost drawn"}</Text>
                      <Text style={styles.meta}>
                        {group.ghost ? `${group.ghost.total} Stableford points added to this group` : "Draw a player from the rest of the field"}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setRound((current) => {
                            const blocked = Object.entries(current.ghosts)
                              .filter(([currentGroupId, ghostId]) => currentGroupId !== group.id && ghostId)
                              .map(([, ghostId]) => ghostId as string);
                            return {
                              ...current,
                              ghosts: { ...current.ghosts, [group.id]: pickGhost(current.players, group.id, blocked) },
                            };
                          })
                        }
                        style={styles.primaryButton}
                      >
                        <Text style={styles.primaryText}>Draw ghost</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.infoBox}>
                      <Text style={styles.infoText}>{groupNote(group.size)}</Text>
                    </View>
                  )}
                </View>
              ))
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Individual leaderboard</Text>
              <Text style={styles.sectionSubtitle}>Ranked by each player&apos;s Stableford total.</Text>
            </View>

            <View style={styles.card}>
              {rankedPlayers.length === 0 ? (
                <Text style={styles.meta}>Add players before scoring begins.</Text>
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
                    <View style={styles.badge}>
                      <Text style={styles.badgeValue}>{player.total}</Text>
                      <Text style={styles.badgeLabel}>pts</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hole entry</Text>
              <Text style={styles.sectionSubtitle}>Enter gross scores and calculate points live.</Text>
            </View>

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
                          value={player.scores[currentHole.number] ?? ""}
                          onChangeText={(value) =>
                            setRound((current) => ({
                              ...current,
                              players: current.players.map((currentPlayer) =>
                                currentPlayer.id === player.id
                                  ? { ...currentPlayer, scores: { ...currentPlayer.scores, [currentHole.number]: value.replace(/[^0-9]/g, "").slice(0, 2) } }
                                  : currentPlayer,
                              ),
                            }))
                          }
                          keyboardType="number-pad"
                          placeholder="Score"
                          placeholderTextColor="#8a877f"
                          style={styles.scoreInput}
                        />
                        <View style={styles.pointsBox}>
                          <Text style={styles.pointsText}>{holePoints(player, holeForPlayer(round.tees, player, selectedHole))}</Text>
                          <Text style={styles.badgeLabel}>pts</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
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
                <Text style={styles.meta}>No saved rounds yet. Save one from the live round tab.</Text>
              </View>
            ) : (
              savedRounds.map((saved) => {
                const players = [...saved.players]
                  .map((player) => ({ ...player, total: totalPoints(player, saved.tees), done: completed(player, saved.tees) }))
                  .sort((a, b) => b.total - a.total);
                const topPlayer = players[0];
                const groupTotals = saved.groups
                  .map((group) => {
                    const members = players.filter((player) => player.groupId === group.id);
                    const ghost = saved.ghosts[group.id] ? players.find((player) => player.id === saved.ghosts[group.id]) ?? null : null;
                    return {
                      ...group,
                      total: members.reduce((sum, player) => sum + player.total, 0) + (members.length === 3 && ghost ? ghost.total : 0),
                    };
                  })
                  .sort((a, b) => b.total - a.total);
                return (
                  <View key={saved.id} style={styles.card}>
                    <Text style={styles.itemTitle}>{saved.name}</Text>
                    <Text style={styles.meta}>{formatDate(saved.date)} • Saved {formatDate(saved.savedAt)}</Text>
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
          <Text style={styles.noteText}>A 3-ball keeps the same drawn player for the whole round, never hole by hole.</Text>
          <Text style={styles.noteText}>Saved rounds are written to local device storage so they can be reopened later on the same device.</Text>
        </View>
      </ScrollView>
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
  courseRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee4d1" },
  courseLabelWrap: { flex: 1 },
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
  scoreInput: { width: 68, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: "#ffffff", paddingVertical: 12, textAlign: "center", fontSize: 18, fontWeight: "700", color: colors.ink },
  pointsBox: { width: 58, borderRadius: 16, backgroundColor: "#edf2eb", paddingVertical: 10, alignItems: "center" },
  pointsText: { color: colors.green2, fontSize: 20, fontWeight: "700" },
  noteCard: { backgroundColor: colors.soft, borderRadius: 22, padding: 18, gap: 10 },
  noteText: { color: "#4e4a41", fontSize: 14, lineHeight: 20 },
});
