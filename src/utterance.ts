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

  /**
   * Accumulation buffer for audio samples.
   *
   * The Web Audio API delivers samples in large chunks (e.g., 4096 samples
   * at a time). The model expects features extracted from 25ms frames
   * (400 samples at 16kHz) with a 10ms hop (160 samples). This buffer
   * accumulates incoming audio so we can extract properly-framed features.
   */
  private sampleBuffer: Float32Array;
  private sampleBufferLen = 0;
  private readonly hopLength: number;
  private readonly frameLength: number;

  /** Guard to prevent overlapping async processing of audio chunks. */
  private processing = false;

  constructor(options: UtteranceOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.audio = new AudioCapture(this.options.sampleRate);
    this.features = new FeatureExtractor(this.options.sampleRate);
    this.model = new ONNXModel(this.options.sensitivity);
    this.detector = new TurnDetector(
      this.options.sensitivity,
      this.options.pauseTolerance,
    );

    // 25ms frame, 10ms hop at the configured sample rate
    this.frameLength = Math.floor(this.options.sampleRate * 0.025); // 400 @ 16kHz
    this.hopLength = Math.floor(this.options.sampleRate * 0.01);    // 160 @ 16kHz

    // Pre-allocate buffer large enough for audio callback + leftover
    // (4096 callback + up to frameLength leftover)
    this.sampleBuffer = new Float32Array(8192 + this.frameLength);
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

    this.sampleBufferLen = 0;
    this.processing = false;

    this.audio.onAudioData((chunk) => {
      // Append incoming samples to the accumulation buffer
      if (this.sampleBufferLen + chunk.length > this.sampleBuffer.length) {
        // Grow buffer if needed (rare)
        const newBuf = new Float32Array((this.sampleBufferLen + chunk.length) * 2);
        newBuf.set(this.sampleBuffer.subarray(0, this.sampleBufferLen));
        this.sampleBuffer = newBuf;
      }
      this.sampleBuffer.set(chunk, this.sampleBufferLen);
      this.sampleBufferLen += chunk.length;

      // Process frames (non-blocking)
      void this.processFrames();
    });

    await this.audio.start();
    this.listening = true;
  }

  /**
   * Extract features from all complete frames in the sample buffer,
   * feed each through the model, and process the results.
   *
   * Each frame is `frameLength` samples (25ms) extracted at `hopLength`
   * (10ms) intervals, matching the Python training pipeline.
   */
  private async processFrames(): Promise<void> {
    // Prevent re-entrant processing
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.sampleBufferLen >= this.frameLength) {
        // Extract a single frame
        const frame = this.sampleBuffer.subarray(0, this.frameLength);

        // Compute features for this 25ms frame
        const extracted = this.features.extract(frame);
        const result = await this.model.predict(extracted);

        // Only process fresh inference results (null = still buffering)
        if (result) {
          this.detector.process(result);
        }

        // Advance by hop length (10ms), keeping the overlap
        const remaining = this.sampleBufferLen - this.hopLength;
        if (remaining > 0) {
          this.sampleBuffer.copyWithin(0, this.hopLength, this.sampleBufferLen);
        }
        this.sampleBufferLen = Math.max(0, remaining);
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Stop listening and release all resources.
   */
  stop(): void {
    if (!this.listening) return;

    this.audio.stop();
    this.model.dispose();
    this.detector.reset();
    this.sampleBufferLen = 0;
    this.listening = false;
  }

  /**
   * Returns whether the detector is currently listening.
   */
  isListening(): boolean {
    return this.listening;
  }
}
