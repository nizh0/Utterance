/**
 * @utterance/core
 *
 * Client-side semantic endpointing.
 * Know when they're done talking.
 */

export { Utterance } from "./utterance";

// Re-export types so consumers can use them
export type {
  UtteranceOptions,
  UtteranceEvent,
  UtteranceEventMap,
  SpeechStartEvent,
  PauseEvent,
  TurnEndEvent,
  InterruptEvent,
  AudioFeatures,
  ClassificationResult,
  ClassificationLabel,
} from "./types";
