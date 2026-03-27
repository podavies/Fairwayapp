import { requireOptionalNativeModule } from "expo";

import type { ScorecardOcrModuleType } from "./ScorecardOcr.types";

export default requireOptionalNativeModule<ScorecardOcrModuleType>("ScorecardOcr");
