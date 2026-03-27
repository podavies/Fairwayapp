import ExpoModulesCore
import Foundation
import Vision

public class ScorecardOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScorecardOcr")

    Function("isSupported") {
      true
    }

    AsyncFunction("recognizeTextAsync") { (imageUri: String) throws -> [String: Any] in
      let imageURL = self.resolveImageURL(imageUri)

      guard FileManager.default.fileExists(atPath: imageURL.path) else {
        throw NSError(
          domain: "ScorecardOcr",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "The selected scorecard photo could not be found on this device."]
        )
      }

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = false
      request.recognitionLanguages = ["en-GB", "en-US"]

      let handler = VNImageRequestHandler(url: imageURL, options: [:])
      try handler.perform([request])

      let observations = (request.results ?? []).sorted { lhs, rhs in
        let yGap = abs(lhs.boundingBox.midY - rhs.boundingBox.midY)
        if yGap > 0.025 {
          return lhs.boundingBox.midY > rhs.boundingBox.midY
        }
        return lhs.boundingBox.minX < rhs.boundingBox.minX
      }

      let lines: [[String: Any]] = observations.compactMap { observation in
        let candidates = observation.topCandidates(3)
        guard let topCandidate = candidates.first else {
          return nil
        }

        let bounds = observation.boundingBox
        return [
          "text": topCandidate.string,
          "confidence": topCandidate.confidence,
          "bounds": [
            "x": bounds.origin.x,
            "y": bounds.origin.y,
            "width": bounds.size.width,
            "height": bounds.size.height,
          ],
          "candidates": candidates.map(\.string),
        ]
      }

      let fullText = lines.compactMap { $0["text"] as? String }.joined(separator: "\n")

      return [
        "platform": "ios-vision",
        "fullText": fullText,
        "lines": lines,
      ]
    }
  }

  private func resolveImageURL(_ imageUri: String) -> URL {
    if let url = URL(string: imageUri), url.scheme != nil {
      return url
    }
    return URL(fileURLWithPath: imageUri)
  }
}
