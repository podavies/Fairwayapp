import type { StyleProp, ViewStyle } from "react-native";

export type ScorecardOcrBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScorecardOcrLine = {
  text: string;
  confidence: number;
  bounds: ScorecardOcrBounds | null;
  candidates: string[];
};

export type ScorecardOcrResult = {
  platform: string;
  fullText: string;
  lines: ScorecardOcrLine[];
};

export type ScorecardOcrModuleType = {
  isSupported(): boolean;
  recognizeTextAsync(imageUri: string): Promise<ScorecardOcrResult>;
};

export type ScorecardOcrViewProps = {
  url: string;
  onLoad?: (event: { nativeEvent: { url: string } }) => void;
  style?: StyleProp<ViewStyle>;
};
