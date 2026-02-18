import type { AudioFeatures, ClassificationResult, Model } from "../types";
import { EnergyVAD } from "./energy-vad";

/**
 * Runs inference on extracted audio features using an ONNX model.
 *
 * When no ONNX model is loaded (the current default), falls back to
 * the EnergyVAD baseline which uses RMS energy thresholds.
 *
 * Contributors: implement the actual ONNX Runtime Web integration here.
 * See https://onnxruntime.ai/docs/get-started/with-javascript/web.html
 */
export class ONNXModel implements Model {
  private session: unknown = null;
  private fallback: EnergyVAD;

  constructor(sensitivity = 0.5) {
    this.fallback = new EnergyVAD(sensitivity);
  }

  /**
   * Load the ONNX model from a given path or URL.
   *
   * TODO:
   *   1. Import onnxruntime-web InferenceSession
   *   2. Load model bytes
   *   3. Create session with appropriate execution providers
   */
  async load(_path: string): Promise<void> {
    // Falls back to EnergyVAD until a real model is trained
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
  async predict(features: AudioFeatures): Promise<ClassificationResult> {
    if (!this.session) {
      return this.fallback.classify(features);
    }

    // Real ONNX inference will go here
    return this.fallback.classify(features);
  }

  /**
   * Release model resources.
   */
  dispose(): void {
    this.session = null;
    this.fallback.reset();
  }
}
