package expo.modules.scorecardocr

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ScorecardOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScorecardOcr")

    Function("isSupported") {
      false
    }

    AsyncFunction("recognizeTextAsync") { _: String ->
      throw UnsupportedOperationException("Scorecard OCR is currently available only in Missfits iPhone app builds.")
    }
  }
}
