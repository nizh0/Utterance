import { describe, it, expect, vi } from "vitest";
import { TurnDetector } from "../src/detector";
import type { ClassificationResult } from "../src/types";

function makeResult(
  label: ClassificationResult["label"],
  confidence = 0.9,
  timestamp = Date.now(),
): ClassificationResult {
  return { label, confidence, timestamp };
}

describe("TurnDetector", () => {
  it("emits speechStart when transitioning from idle to speaking", () => {
    const detector = new TurnDetector();
    const handler = vi.fn();

    detector.on("speechStart", handler);
    detector.process(makeResult("speaking"));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: expect.any(Number) }),
    );
  });

  it("does not emit speechStart twice for consecutive speaking frames", () => {
    const detector = new TurnDetector();
    const handler = vi.fn();

    detector.on("speechStart", handler);
    detector.process(makeResult("speaking"));
    detector.process(makeResult("speaking"));
    detector.process(makeResult("speaking"));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("emits turnEnd on turn_complete with sufficient confidence", () => {
    const detector = new TurnDetector(0.5);
    const handler = vi.fn();

    detector.on("turnEnd", handler);
    detector.process(makeResult("speaking", 0.9, 1000));
    detector.process(makeResult("turn_complete", 0.8, 2000));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 0.8 }),
    );
  });

  it("does not emit turnEnd if confidence is below sensitivity", () => {
    const detector = new TurnDetector(0.8);
    const handler = vi.fn();

    detector.on("turnEnd", handler);
    detector.process(makeResult("speaking", 0.9, 1000));
    detector.process(makeResult("turn_complete", 0.3, 2000));

    expect(handler).not.toHaveBeenCalled();
  });

  it("emits interrupt when confidence meets threshold", () => {
    const detector = new TurnDetector(0.5);
    const handler = vi.fn();

    detector.on("interrupt", handler);
    detector.process(makeResult("interrupt_intent", 0.7));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("emits turnEnd when pause exceeds tolerance", () => {
    const detector = new TurnDetector(0.5, 1000);
    const handler = vi.fn();

    detector.on("turnEnd", handler);

    detector.process(makeResult("speaking", 0.9, 0));
    detector.process(makeResult("thinking_pause", 0.8, 500));
    // Pause has lasted 1100ms — should trigger turnEnd
    detector.process(makeResult("thinking_pause", 0.8, 1600));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("resets state correctly", () => {
    const detector = new TurnDetector();
    const handler = vi.fn();

    detector.on("speechStart", handler);
    detector.process(makeResult("speaking"));
    expect(handler).toHaveBeenCalledTimes(1);

    detector.reset();
    detector.process(makeResult("speaking"));
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("supports removing listeners with off()", () => {
    const detector = new TurnDetector();
    const handler = vi.fn();

    detector.on("speechStart", handler);
    detector.process(makeResult("speaking"));
    expect(handler).toHaveBeenCalledTimes(1);

    detector.off("speechStart", handler);
    detector.reset();
    detector.process(makeResult("speaking"));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
