import type {
  ClassificationResult,
  UtteranceEventMap,
  UtteranceEvent,
} from "../types";

type Listener<T> = (event: T) => void;

/**
 * Core state machine that receives classification results and
 * emits high-level turn-taking events.
 *
 * This is the brain of Utterance. It tracks conversation state
 * and decides when to fire speechStart, pause, turnEnd, and interrupt.
 */
export class TurnDetector {
  private listeners = new Map<string, Set<Listener<unknown>>>();
  private state: "idle" | "speaking" | "paused" = "idle";
  private pauseStart = 0;
  private speakStart = 0;
  private interruptFired = false;

  private readonly sensitivity: number;
  private readonly pauseTolerance: number;

  constructor(sensitivity = 0.5, pauseTolerance = 1500) {
    this.sensitivity = sensitivity;
    this.pauseTolerance = pauseTolerance;
  }

  /**
   * Register an event listener.
   */
  on<E extends UtteranceEvent>(
    event: E,
    listener: Listener<UtteranceEventMap[E]>,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<unknown>);
  }

  /**
   * Remove an event listener.
   */
  off<E extends UtteranceEvent>(
    event: E,
    listener: Listener<UtteranceEventMap[E]>,
  ): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
  }

  /**
   * Process a classification result from the model and emit events.
   */
  process(result: ClassificationResult): void {
    const { label, confidence, timestamp } = result;
    const threshold = this.sensitivity;

    switch (label) {
      case "speaking":
        this.interruptFired = false;
        if (this.state !== "speaking") {
          this.state = "speaking";
          this.speakStart = timestamp;
          this.emit("speechStart", { timestamp });
        }
        break;

      case "thinking_pause":
        if (this.state === "speaking" && confidence >= threshold) {
          this.state = "paused";
          this.pauseStart = timestamp;
          this.emit("pause", {
            duration: 0,
            confidence,
          });
        } else if (this.state === "paused") {
          const duration = timestamp - this.pauseStart;
          if (duration >= this.pauseTolerance) {
            // Pause exceeded tolerance — treat as turn end
            this.state = "idle";
            this.emit("turnEnd", {
              confidence,
              duration: timestamp - this.speakStart,
            });
          }
        }
        break;

      case "turn_complete":
        if (
          (this.state === "speaking" || this.state === "paused") &&
          confidence >= threshold
        ) {
          this.state = "idle";
          this.emit("turnEnd", {
            confidence,
            duration: timestamp - this.speakStart,
          });
        }
        break;

      case "interrupt_intent":
        if (confidence >= threshold && !this.interruptFired) {
          this.interruptFired = true;
          this.emit("interrupt", { timestamp });
        }
        break;
    }
  }

  /**
   * Reset internal state.
   */
  reset(): void {
    this.state = "idle";
    this.pauseStart = 0;
    this.speakStart = 0;
    this.interruptFired = false;
  }

  private emit<E extends UtteranceEvent>(
    event: E,
    payload: UtteranceEventMap[E],
  ): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }
}
