import type { AudioFeatures, ClassificationResult } from "../types";

/**
 * Energy-based Voice Activity Detector.
 *
 * A simple baseline classifier that uses RMS energy to determine
 * if the user is speaking or silent. This serves as the fallback
 * when no ONNX model is loaded.
 *
 * It cannot distinguish thinking pauses from turn completion
 * (that requires the ML model), but it gives the TurnDetector
 * enough signal to fire real events based on pause duration.
 */
export class EnergyVAD {
  private readonly speechThreshold: number;
  private readonly silenceThreshold: number;
  private isSpeaking = false;
  private silenceStart = 0;
  private readonly pauseHintMs: number;

  constructor(sensitivity = 0.5) {
    // Higher sensitivity = lower thresholds = easier to detect speech
    this.speechThreshold = 0.015 * (1 - sensitivity * 0.8);
    this.silenceThreshold = this.speechThreshold * 0.6;
    // How long silence lasts before we hint it might be a turn end
    this.pauseHintMs = 800;
  }

  classify(features: AudioFeatures): ClassificationResult {
    const { energy } = features;
    const now = Date.now();

    if (!this.isSpeaking && energy >= this.speechThreshold) {
      // Transition: silence → speaking
      this.isSpeaking = true;
      this.silenceStart = 0;
      return { label: "speaking", confidence: this.energyToConfidence(energy), timestamp: now };
    }

    if (this.isSpeaking && energy >= this.silenceThreshold) {
      // Still speaking
      this.silenceStart = 0;
      return { label: "speaking", confidence: this.energyToConfidence(energy), timestamp: now };
    }

    if (this.isSpeaking && energy < this.silenceThreshold) {
      // Transition: speaking → silence
      if (this.silenceStart === 0) {
        this.silenceStart = now;
      }

      const silenceDuration = now - this.silenceStart;

      if (silenceDuration >= this.pauseHintMs) {
        // Long enough silence — likely done speaking
        this.isSpeaking = false;
        const confidence = Math.min(silenceDuration / (this.pauseHintMs * 2), 1);
        return { label: "turn_complete", confidence, timestamp: now };
      }

      // Short silence — could be a thinking pause
      return { label: "thinking_pause", confidence: 0.6, timestamp: now };
    }

    // Idle — not speaking, no energy
    return { label: "thinking_pause", confidence: 0.3, timestamp: now };
  }

  reset(): void {
    this.isSpeaking = false;
    this.silenceStart = 0;
  }

  private energyToConfidence(energy: number): number {
    // Map energy to a 0-1 confidence, clamped
    return Math.min(energy / (this.speechThreshold * 4), 1);
  }
}
