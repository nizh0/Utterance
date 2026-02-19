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

  /** Timestamp of the last fired interrupt event (for cooldown). */
  private lastInterruptTs = 0;

  /** Consecutive interrupt_intent classifications (debounce counter). */
  private interruptStreak = 0;

  /** Consecutive speaking classifications (debounce for speech start). */
  private speakStreak = 0;

  /** Minimum consecutive speaking frames before firing speechStart (100ms each). */
  private static readonly SPEAK_DEBOUNCE = 2;

  /** Minimum consecutive interrupt frames before firing (100ms each). */
  private static readonly INTERRUPT_DEBOUNCE = 3;

  /** Minimum ms between interrupt events. */
  private static readonly INTERRUPT_COOLDOWN_MS = 3000;

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
        this.interruptStreak = 0;
        this.speakStreak++;
        if (this.state !== "speaking" && this.speakStreak >= TurnDetector.SPEAK_DEBOUNCE) {
          this.state = "speaking";
          this.speakStart = timestamp;
          this.speakStreak = 0;
          this.emit("speechStart", { timestamp });
        }
        break;

      case "thinking_pause":
        this.speakStreak = 0;
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
        this.speakStreak = 0;
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
        this.speakStreak = 0;
        if (confidence >= threshold) {
          this.interruptStreak++;

          // Require sustained interrupt signal (debounce) + cooldown
          const cooledDown = timestamp - this.lastInterruptTs >= TurnDetector.INTERRUPT_COOLDOWN_MS;
          if (this.interruptStreak >= TurnDetector.INTERRUPT_DEBOUNCE && cooledDown) {
            this.lastInterruptTs = timestamp;
            this.interruptStreak = 0;
            this.emit("interrupt", { timestamp, confidence });
          }
        } else {
          this.interruptStreak = 0;
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
    this.lastInterruptTs = 0;
    this.interruptStreak = 0;
    this.speakStreak = 0;
  }

  private emit<E extends UtteranceEvent>(
    event: E,
    payload: UtteranceEventMap[E],
  ): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }
}
