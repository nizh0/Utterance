import type { AudioFeatures } from "../types";

/**
 * Extracts audio features from raw PCM frames.
 *
 * Contributors: this is where the signal processing lives.
 * Each method below is a stub — implement the actual DSP and
 * add tests in tests/features/.
 */
export class FeatureExtractor {
  private readonly sampleRate: number;

  constructor(sampleRate = 16000) {
    this.sampleRate = sampleRate;
  }

  /**
   * Extract all features from a single audio frame.
   */
  extract(frame: Float32Array): AudioFeatures {
    return {
      mfcc: this.computeMFCC(frame),
      energy: this.computeEnergy(frame),
      pitch: this.estimatePitch(frame),
      speechRate: this.estimateSpeechRate(frame),
      pauseDuration: 0, // tracked by the detector over time
    };
  }

  /**
   * Compute Mel-Frequency Cepstral Coefficients.
   *
   * TODO: Implement full MFCC pipeline:
   *   1. Pre-emphasis filter
   *   2. Windowing (Hamming)
   *   3. FFT
   *   4. Mel filterbank
   *   5. Log energy
   *   6. DCT
   */
  private computeMFCC(_frame: Float32Array): Float32Array {
    // Placeholder — returns 13 zero coefficients
    return new Float32Array(13);
  }

  /**
   * Compute RMS energy of the frame.
   */
  private computeEnergy(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
    }
    return Math.sqrt(sum / frame.length);
  }

  /**
   * Estimate fundamental frequency (pitch) using autocorrelation.
   *
   * TODO: Implement YIN or autocorrelation-based pitch detection.
   */
  private estimatePitch(_frame: Float32Array): number {
    void this.sampleRate; // will be used by the real implementation
    return 0;
  }

  /**
   * Estimate speech rate (syllables per second).
   *
   * TODO: Implement energy-envelope peak counting.
   */
  private estimateSpeechRate(_frame: Float32Array): number {
    return 0;
  }
}
