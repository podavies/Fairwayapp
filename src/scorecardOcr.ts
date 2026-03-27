import { Platform } from "react-native";

import ScorecardOcrModule from "../modules";
import type { ScorecardOcrResult } from "../modules";

export {
  extractScorecardHoleSuggestions,
  extractScorecardNameSuggestions,
  extractScorecardOcrHints,
} from "./scorecardOcrParsing";
export type {
  ScorecardHoleSuggestions,
  ScorecardNameSuggestions,
  ScorecardOcrHints,
  ScorecardParsedHole,
} from "./scorecardOcrParsing";

export function getScorecardOcrSupportMessage() {
  if (Platform.OS !== "ios") {
    return "OCR is iPhone-only for now.";
  }
  if (!ScorecardOcrModule?.isSupported?.()) {
    return "OCR needs a Missfits app build, not Expo Go.";
  }
  return null;
}

export async function recognizeScorecardTextAsync(imageUri: string): Promise<ScorecardOcrResult> {
  const supportMessage = getScorecardOcrSupportMessage();
  if (supportMessage || !ScorecardOcrModule?.recognizeTextAsync) {
    throw new Error(supportMessage ?? "Scorecard OCR is unavailable on this device.");
  }
  return ScorecardOcrModule.recognizeTextAsync(imageUri);
}
