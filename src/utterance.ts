import { AudioCapture } from "./audio";
import { FeatureExtractor } from "./features";
import { ONNXModel } from "./model";
import { TurnDetector } from "./detector";
import {
  DEFAULT_OPTIONS,
  type UtteranceOptions,
  type UtteranceEvent,
  type UtteranceEventMap,
} from "./types";

/**
 * Main entry point for the Utterance SDK.
 *
 * Usage:
 * ```ts
 * const detector = new Utterance({ sensitivity: 0.6 });
 * detector.on("turnEnd", (e) => console.log("Done!", e.confidence));
 * await detector.start();
 * ```
 */
export class Utterance {
  private readonly options: Required<UtteranceOptions>;
  private readonly audio: AudioCapture;
  private readonly features: FeatureExtractor;
  private readonly model: ONNXModel;
  private readonly detector: TurnDetector;
  private listening = false;

  constructor(options: UtteranceOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.audio = new AudioCapture(this.options.sampleRate);
    this.features = new FeatureExtractor(this.options.sampleRate);
    this.model = new ONNXModel(this.options.sensitivity);
    this.detector = new TurnDetector(
      this.options.sensitivity,
      this.options.pauseTolerance,
    );
  }

  /**
   * Register an event listener.
   */
  on<E extends UtteranceEvent>(
    event: E,
    listener: (payload: UtteranceEventMap[E]) => void,
  ): void {
    this.detector.on(event, listener);
  }

  /**
   * Remove an event listener.
   */
  off<E extends UtteranceEvent>(
    event: E,
    listener: (payload: UtteranceEventMap[E]) => void,
  ): void {
    this.detector.off(event, listener);
  }

  /**
   * Start listening to the microphone and detecting turns.
   */
  async start(): Promise<void> {
    if (this.listening) return;

    await this.model.load(this.options.modelPath);

    this.audio.onAudioData(async (frame) => {
      const extracted = this.features.extract(frame);
      const result = await this.model.predict(extracted);
      this.detector.process(result);
    });

    await this.audio.start();
    this.listening = true;
  }

  /**
   * Stop listening and release all resources.
   */
  stop(): void {
    if (!this.listening) return;

    this.audio.stop();
    this.model.dispose();
    this.detector.reset();
    this.listening = false;
  }

  /**
   * Returns whether the detector is currently listening.
   */
  isListening(): boolean {
    return this.listening;
  }
}
