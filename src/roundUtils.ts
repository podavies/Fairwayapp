export type RoundGroupRef = {
  id: string;
};

export type RoundPlayerRef = {
  id: string;
  groupId: string;
};

export function buildLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);
  const parsed = new Date(year, monthIndex, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function formatRoundDate(
  value: string,
  locales?: string | string[],
) {
  const parsed = parseLocalDateValue(value) ?? new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(locales, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shuffle<T>(items: T[], random = Math.random) {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    const current = clone[index];
    clone[index] = clone[randomIndex];
    clone[randomIndex] = current;
  }
  return clone;
}

export function syncSharedGhosts(
  players: RoundPlayerRef[],
  groups: RoundGroupRef[],
  current: Record<string, string | null> = {},
  force = false,
  random = Math.random,
) {
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
  const eligibleGhostIds = players
    .filter((player) => groupSizes.get(player.groupId) === 4)
    .map((player) => player.id);

  if (!eligibleGhostIds.length) {
    return next;
  }

  const existingSharedGhost = !force
    ? threeBallGroups
        .map((group) => current[group.id] ?? null)
        .find((ghostId): ghostId is string => !!ghostId && eligibleGhostIds.includes(ghostId))
    : null;
  const sharedGhost = existingSharedGhost ?? shuffle(eligibleGhostIds, random)[0] ?? null;

  threeBallGroups.forEach((group) => {
    next[group.id] = sharedGhost;
  });

  return next;
}
