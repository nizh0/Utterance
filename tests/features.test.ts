import { describe, it, expect } from "vitest";
import { FeatureExtractor } from "../src/features";

describe("FeatureExtractor", () => {
  it("returns the correct shape for extracted features", () => {
    const extractor = new FeatureExtractor(16000);
    const frame = new Float32Array(4096);
    const features = extractor.extract(frame);

    expect(features.mfcc).toBeInstanceOf(Float32Array);
    expect(features.mfcc.length).toBe(13);
    expect(typeof features.energy).toBe("number");
    expect(typeof features.pitch).toBe("number");
    expect(typeof features.speechRate).toBe("number");
    expect(typeof features.pauseDuration).toBe("number");
  });

  it("computes non-zero energy for a non-silent frame", () => {
    const extractor = new FeatureExtractor(16000);

    // Simulate a simple sine wave
    const frame = new Float32Array(4096);
    for (let i = 0; i < frame.length; i++) {
      frame[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
    }

    const features = extractor.extract(frame);
    expect(features.energy).toBeGreaterThan(0);
  });

  it("computes zero energy for a silent frame", () => {
    const extractor = new FeatureExtractor(16000);
    const frame = new Float32Array(4096); // all zeros
    const features = extractor.extract(frame);

    expect(features.energy).toBe(0);
  });
});
