import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocalDateValue,
  formatRoundDate,
  parseLocalDateValue,
  syncSharedGhosts,
} from "../src/roundUtils.ts";

test("shared ghost is chosen from a 4-ball so a 3-ball member is not double-counted", () => {
  const groups = [
    { id: "three", name: "Three-ball" },
    { id: "four", name: "Four-ball" },
  ];
  const players = [
    { id: "a", groupId: "three" },
    { id: "b", groupId: "three" },
    { id: "c", groupId: "three" },
    { id: "d", groupId: "four" },
    { id: "e", groupId: "four" },
    { id: "f", groupId: "four" },
    { id: "g", groupId: "four" },
  ];

  const ghosts = syncSharedGhosts(players, groups, { three: "a" }, false, () => 0);

  assert.ok(["d", "e", "f", "g"].includes(ghosts.three));
  assert.ok(!["a", "b", "c"].includes(ghosts.three));
});

test("existing valid shared ghost is preserved", () => {
  const groups = [
    { id: "three", name: "Three-ball" },
    { id: "four", name: "Four-ball" },
  ];
  const players = [
    { id: "a", groupId: "three" },
    { id: "b", groupId: "three" },
    { id: "c", groupId: "three" },
    { id: "d", groupId: "four" },
    { id: "e", groupId: "four" },
    { id: "f", groupId: "four" },
    { id: "g", groupId: "four" },
  ];

  assert.deepEqual(
    syncSharedGhosts(players, groups, { three: "f" }, false, () => 0.99),
    { three: "f" },
  );
});

test("buildLocalDateValue keeps the local calendar day", () => {
  assert.equal(
    buildLocalDateValue(new Date(2026, 3, 18, 0, 30)),
    "2026-04-18",
  );
});

test("parseLocalDateValue rejects impossible dates", () => {
  assert.equal(parseLocalDateValue("2026-02-31"), null);
});

test("formatRoundDate treats YYYY-MM-DD as a local date", () => {
  assert.equal(
    formatRoundDate("2026-04-18", "en-GB"),
    new Date(2026, 3, 18).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  );
});
