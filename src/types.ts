/**
 * Core types for the Utterance SDK.
 *
 * All shared interfaces and type definitions live here to keep
 * the codebase scalable and avoid circular dependencies.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface UtteranceOptions {
  /** Detection sensitivity (0-1). Higher = more sensitive to pauses. Default: 0.5 */
  sensitivity?: number;
  /** Max thinking pause duration (ms) before triggering turnEnd. Default: 1500 */
  pauseTolerance?: number;
  /** Model source: "cdn" (default), "bundled", or a custom URL. */
  modelPath?: string;
  /** Audio sample rate in Hz. Default: 16000 */
  sampleRate?: number;
}

export const MODEL_CDN_URL =
  "https://pub-46a5feb0029246bcbc93fab6162cff94.r2.dev/v2/utterance-v2.onnx";

export const DEFAULT_OPTIONS: Required<UtteranceOptions> = {
  sensitivity: 0.5,
  pauseTolerance: 1500,
  modelPath: "cdn",
  sampleRate: 16000,
};

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type ClassificationLabel =
  | "speaking"
  | "thinking_pause"
  | "turn_complete"
  | "interrupt_intent";

export interface ClassificationResult {
  label: ClassificationLabel;
  confidence: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface SpeechStartEvent {
  timestamp: number;
}

export interface PauseEvent {
  duration: number;
  confidence: number;
}

export interface TurnEndEvent {
  confidence: number;
  duration: number;
}

export interface InterruptEvent {
  timestamp: number;
  confidence: number;
}

export interface UtteranceEventMap {
  speechStart: SpeechStartEvent;
  pause: PauseEvent;
  turnEnd: TurnEndEvent;
  interrupt: InterruptEvent;
}

export type UtteranceEvent = keyof UtteranceEventMap;

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export interface AudioSource {
  start(): Promise<void>;
  stop(): void;
  onAudioData(callback: (data: Float32Array) => void): void;
}

// ---------------------------------------------------------------------------
// Feature extraction
// ---------------------------------------------------------------------------

export interface AudioFeatures {
  mfcc: Float32Array;
  energy: number;
  pitch: number;
  speechRate: number;
  pauseDuration: number;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export interface Model {
  load(path: string): Promise<void>;
  predict(features: AudioFeatures): Promise<ClassificationResult | null>;
  dispose(): void;
}
