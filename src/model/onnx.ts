import type { AudioFeatures, ClassificationResult, Model } from "../types";

/**
 * Runs inference on extracted audio features using an ONNX model.
 *
 * Contributors: implement the actual ONNX Runtime Web integration here.
 * See https://onnxruntime.ai/docs/get-started/with-javascript/web.html
 */
export class ONNXModel implements Model {
  private session: unknown = null;

  /**
   * Load the ONNX model from a given path or URL.
   *
   * TODO:
   *   1. Import onnxruntime-web InferenceSession
   *   2. Load model bytes
   *   3. Create session with appropriate execution providers
   */
  async load(_path: string): Promise<void> {
    // Placeholder — model loading not yet implemented
    this.session = null;
  }

  /**
   * Run inference on a set of extracted features.
   *
   * TODO:
   *   1. Build input tensor from AudioFeatures
   *   2. Run session.run()
   *   3. Parse output into ClassificationResult
   */
  async predict(_features: AudioFeatures): Promise<ClassificationResult> {
    if (!this.session) {
      // Until a real model is trained, return a placeholder
      return {
        label: "speaking",
        confidence: 0,
        timestamp: Date.now(),
      };
    }

    // Real inference will go here
    return {
      label: "speaking",
      confidence: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Release model resources.
   */
  dispose(): void {
    this.session = null;
  }
}
