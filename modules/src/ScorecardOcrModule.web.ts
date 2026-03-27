import type { ScorecardOcrModuleType } from "./ScorecardOcr.types";

const ScorecardOcrModule: ScorecardOcrModuleType = {
  isSupported() {
    return false;
  },
  async recognizeTextAsync() {
    throw new Error("Scorecard OCR is currently available only in Missfits iPhone app builds.");
  },
};

export default ScorecardOcrModule;
