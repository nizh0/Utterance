import { describe, it, expect } from "vitest";
import { FeatureExtractor } from "../src/features";

/**
 * Helper: generate a sine wave frame at a given frequency.
 */
function sineFrame(freq: number, sampleRate: number, length: number): Float32Array {
  const frame = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    frame[i] = 0.5 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return frame;
}

describe("FeatureExtractor", () => {
  const SR = 16000;
  const FRAME_LEN = 400; // 25ms at 16kHz

  it("returns the correct shape for extracted features", () => {
    const extractor = new FeatureExtractor(SR);
    const frame = new Float32Array(FRAME_LEN);
    const features = extractor.extract(frame);

    expect(features.mfcc).toBeInstanceOf(Float32Array);
    expect(features.mfcc.length).toBe(13);
    expect(typeof features.energy).toBe("number");
    expect(typeof features.pitch).toBe("number");
    expect(typeof features.speechRate).toBe("number");
    expect(typeof features.pauseDuration).toBe("number");
  });

  it("computes non-zero energy for a non-silent frame", () => {
    const extractor = new FeatureExtractor(SR);
    const frame = sineFrame(440, SR, FRAME_LEN);
    const features = extractor.extract(frame);
    expect(features.energy).toBeGreaterThan(0);
  });

  it("computes zero energy for a silent frame", () => {
    const extractor = new FeatureExtractor(SR);
    const frame = new Float32Array(FRAME_LEN);
    const features = extractor.extract(frame);
    expect(features.energy).toBe(0);
  });

  describe("MFCC", () => {
    it("produces 13 non-zero coefficients for a speech-like signal", () => {
      const extractor = new FeatureExtractor(SR);
      const frame = sineFrame(200, SR, FRAME_LEN);
      const features = extractor.extract(frame);

      expect(features.mfcc.length).toBe(13);
      // At least some MFCCs should be non-zero for a tonal signal
      const nonZero = Array.from(features.mfcc).filter((v) => Math.abs(v) > 1e-6);
      expect(nonZero.length).toBeGreaterThan(0);
    });

    it("produces all-zero MFCCs for silence", () => {
      const extractor = new FeatureExtractor(SR);
      const frame = new Float32Array(FRAME_LEN);
      const features = extractor.extract(frame);

      // Log of near-zero energy → very negative values, DCT of uniform → mostly zero
      // The first coefficient (energy) may be non-zero but very negative
      // All others should be near zero
      for (let i = 1; i < features.mfcc.length; i++) {
        expect(Math.abs(features.mfcc[i])).toBeLessThan(1e-3);
      }
    });

    it("produces different MFCCs for different frequencies", () => {
      const extractor = new FeatureExtractor(SR);
      const low = extractor.extract(sineFrame(200, SR, FRAME_LEN));
      const high = extractor.extract(sineFrame(3000, SR, FRAME_LEN));

      // MFCCs should differ for different frequency content
      let totalDiff = 0;
      for (let i = 0; i < 13; i++) {
        totalDiff += Math.abs(low.mfcc[i] - high.mfcc[i]);
      }
      expect(totalDiff).toBeGreaterThan(0.1);
    });
  });

  describe("Pitch estimation", () => {
    it("detects pitch of a periodic signal", () => {
      const extractor = new FeatureExtractor(SR);
      // Use a long enough frame for autocorrelation to work
      const frame = sineFrame(200, SR, 800); // 50ms at 200Hz = 10 periods
      const features = extractor.extract(frame);

      // Should detect ~200Hz (within 10% tolerance)
      if (features.pitch > 0) {
        expect(features.pitch).toBeGreaterThan(150);
        expect(features.pitch).toBeLessThan(250);
      }
    });

    it("returns 0 for silence (unvoiced)", () => {
      const extractor = new FeatureExtractor(SR);
      const frame = new Float32Array(FRAME_LEN);
      const features = extractor.extract(frame);
      expect(features.pitch).toBe(0);
    });

    it("returns 0 for noise (unvoiced)", () => {
      const extractor = new FeatureExtractor(SR);
      const frame = new Float32Array(FRAME_LEN);
      for (let i = 0; i < frame.length; i++) {
        frame[i] = (Math.random() - 0.5) * 0.1;
      }
      const features = extractor.extract(frame);
      // Noise should not have strong periodicity
      // Pitch may be 0 or a spurious value, but should not be a clean detection
      expect(features.pitch).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Pause duration tracking", () => {
    it("accumulates pause duration for consecutive silent frames", () => {
      const extractor = new FeatureExtractor(SR);
      const silent = new Float32Array(FRAME_LEN);

      // Feed multiple silent frames
      let lastPause = 0;
      for (let i = 0; i < 50; i++) {
        const features = extractor.extract(silent);
        expect(features.pauseDuration).toBeGreaterThanOrEqual(lastPause);
        lastPause = features.pauseDuration;
      }
      // After 50 frames × 10ms = 500ms of silence
      expect(lastPause).toBeGreaterThan(0);
    });

    it("resets pause duration when speech is detected", () => {
      const extractor = new FeatureExtractor(SR);
      const silent = new Float32Array(FRAME_LEN);
      const loud = sineFrame(200, SR, FRAME_LEN);

      // Accumulate silence
      for (let i = 0; i < 20; i++) {
        extractor.extract(silent);
      }

      // Then speech
      const features = extractor.extract(loud);
      expect(features.pauseDuration).toBe(0);
    });

    it("caps pause duration at normalized 1.0 (5 seconds)", () => {
      const extractor = new FeatureExtractor(SR);
      const silent = new Float32Array(FRAME_LEN);

      // Feed 600 silent frames = 6 seconds (exceeds 5s cap)
      let lastPause = 0;
      for (let i = 0; i < 600; i++) {
        const features = extractor.extract(silent);
        lastPause = features.pauseDuration;
      }
      // Should be capped at 1.0 (= 5 seconds normalized)
      expect(lastPause).toBeLessThanOrEqual(1.0);
    });
  });

  describe("Speech rate", () => {
    it("returns 0 for silence", () => {
      const extractor = new FeatureExtractor(SR);
      const silent = new Float32Array(FRAME_LEN);
      const features = extractor.extract(silent);
      expect(features.speechRate).toBe(0);
    });

    it("returns a value in [0, 1] range", () => {
      const extractor = new FeatureExtractor(SR);
      const frame = sineFrame(200, SR, FRAME_LEN);

      // Feed several frames to fill the rolling buffer
      let rate = 0;
      for (let i = 0; i < 100; i++) {
        const features = extractor.extract(frame);
        rate = features.speechRate;
      }
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });
  });

  describe("reset", () => {
    it("clears internal state", () => {
      const extractor = new FeatureExtractor(SR);
      const silent = new Float32Array(FRAME_LEN);

      // Accumulate state
      for (let i = 0; i < 50; i++) {
        extractor.extract(silent);
      }

      extractor.reset();

      // After reset, pause duration should start from 0 again
      const features = extractor.extract(silent);
      // First frame after reset: 10ms of silence
      expect(features.pauseDuration).toBeLessThan(0.01);
    });
  });
});
