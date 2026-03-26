export type V2Hole = {
  number: number;
  name: string;
  yardage: number;
  par: number;
  strokeIndex: number;
};

export type V2RatingProfile = {
  id: string;
  label: string;
  courseRating: number;
  slopeRating: number;
  par: number;
};

export type V2TeeSet = {
  id: string;
  name: string;
  color?: string | null;
  holes: V2Hole[];
  ratingProfiles: V2RatingProfile[];
};

export type V2CourseSource = "manual" | "scan" | "lookup" | "migration";

export type V2CourseRecord = {
  id: string;
  name: string;
  clubName?: string | null;
  countryCode: "GB";
  source: V2CourseSource;
  savedAt: string;
  tees: V2TeeSet[];
  scorecardImageUri?: string | null;
};

export type V2PlayerProfile = {
  id: string;
  name: string;
  handicapIndex: number | null;
  preferredTeeId?: string | null;
};

export type V2RoundPlayer = {
  id: string;
  playerProfileId?: string | null;
  name: string;
  teeId: string;
  handicapIndex: number | null;
  courseHandicap: number | null;
  playingHandicap: number | null;
  scores: Record<number, string>;
};

export type V2RoundRecord = {
  id: string;
  name: string;
  date: string;
  courseId?: string | null;
  courseName: string;
  courseSnapshotTees: V2TeeSet[];
  players: V2RoundPlayer[];
  savedAt: string;
};

export type V2ImportDraft = {
  id: string;
  createdAt: string;
  imageUri?: string | null;
  courseName: string;
  tees: V2TeeSet[];
};

export type V2Settings = {
  defaultCountryCode: "GB";
  handicapMode: "manual" | "index";
};

export type V2Store = {
  schemaVersion: 2;
  migratedFromV1: boolean;
  courses: V2CourseRecord[];
  rounds: V2RoundRecord[];
  players: V2PlayerProfile[];
  importDrafts: V2ImportDraft[];
  settings: V2Settings;
};
