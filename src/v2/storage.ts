import * as FileSystem from "expo-file-system/legacy";

import type { V2Store } from "./types";

export const V2_SCHEMA_VERSION = 2 as const;

export const V1_STORAGE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}rollup-rounds.json`
  : null;

export const V2_STORAGE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}fairway-v2.json`
  : null;

export function createEmptyV2Store(): V2Store {
  return {
    schemaVersion: V2_SCHEMA_VERSION,
    migratedFromV1: false,
    courses: [],
    rounds: [],
    players: [],
    importDrafts: [],
    settings: {
      defaultCountryCode: "GB",
      handicapMode: "manual",
    },
  };
}

export async function readV2Store(): Promise<V2Store | null> {
  if (!V2_STORAGE_URI) {
    return null;
  }

  const info = await FileSystem.getInfoAsync(V2_STORAGE_URI);
  if (!info.exists) {
    return null;
  }

  const raw = await FileSystem.readAsStringAsync(V2_STORAGE_URI);
  return JSON.parse(raw) as V2Store;
}

export async function writeV2Store(store: V2Store): Promise<void> {
  if (!V2_STORAGE_URI) {
    return;
  }

  await FileSystem.writeAsStringAsync(V2_STORAGE_URI, JSON.stringify(store));
}
