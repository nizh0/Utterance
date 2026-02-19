import type { AudioFeatures, ClassificationLabel, ClassificationResult, Model } from "../types";
import { MODEL_CDN_URL } from "../types";
import { EnergyVAD } from "./energy-vad";

/** Labels ordered to match the model's output indices. */
const LABELS: ClassificationLabel[] = [
  "speaking",
  "thinking_pause",
  "turn_complete",
  "interrupt_intent",
];

/** Number of feature dimensions per frame (13 MFCCs + energy + pitch + speechRate + pauseDuration). */
const FEATURE_DIM = 17;

/** Number of frames in the model's context window (1 second at 10ms hop). */
const CONTEXT_FRAMES = 100;

/** How often to run inference (every N frames buffered). Batched at 100ms = 10 frames. */
const INFERENCE_INTERVAL = 10;

/**
 * ONNX Runtime Web inference session type (imported dynamically).
 * Using interfaces to avoid requiring onnxruntime-web at build time.
 */
interface OrtSession {
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array; dims: number[] }>>;
  release(): Promise<void>;
}

interface OrtModule {
  InferenceSession: {
    create(path: string | ArrayBuffer, options?: Record<string, unknown>): Promise<OrtSession>;
  };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
  env: Record<string, unknown>;
}

/**
 * Runs inference on extracted audio features using an ONNX model.
 *
 * Buffers frames into a sliding window (100 frames = 1 second),
 * runs inference every 100ms (10 frames), and falls back to
 * EnergyVAD when no ONNX model is available.
 *
 * Execution backend: WASM by default, WebGPU opt-in.
 */
export class ONNXModel implements Model {
  private session: OrtSession | null = null;
  private ort: OrtModule | null = null;
  private fallback: EnergyVAD;
  private useWebGpu: boolean;

  /** Circular buffer of feature vectors for the context window. */
  private frameBuffer: Float32Array;
  private bufferIdx = 0;
  private framesBuffered = 0;
  private framesSinceInference = 0;

  /** Cache the last inference result for frames between batches. */
  private lastResult: ClassificationResult | null = null;

  /** Hysteresis flag for energy-gate — prevents rapid silence/speech toggling. */
  private silenceMode = false;

  constructor(sensitivity = 0.5, useWebGpu = false) {
    this.fallback = new EnergyVAD(sensitivity);
    this.useWebGpu = useWebGpu;
    this.frameBuffer = new Float32Array(CONTEXT_FRAMES * FEATURE_DIM);
  }

  /**
   * Load the ONNX model from CDN, bundled path, or custom URL.
   *
   * Dynamically imports onnxruntime-web to avoid bundling it
   * when the model isn't used (tree-shaking friendly).
   *
   * @param path - "cdn" (default, loads from Cloudflare R2), "bundled" (from npm package), or a custom URL.
   */
  async load(path: string): Promise<void> {
    try {
      // Dynamic import — only loaded when actually needed
      const ort = await import("onnxruntime-web") as unknown as OrtModule;
      this.ort = ort;

      // Resolve model source
      let modelSource: string | ArrayBuffer = path;

      if (path === "cdn") {
        // Fetch from Cloudflare R2 CDN (default)
        try {
          const response = await fetch(MODEL_CDN_URL);
          if (response.ok) {
            modelSource = await response.arrayBuffer();
          } else {
            throw new Error(`Failed to fetch CDN model: ${response.status}`);
          }
        } catch {
          console.warn("[utterance] CDN model unavailable, falling back to EnergyVAD");
          this.session = null;
          return;
        }
      } else if (path === "bundled") {
        // Try to resolve the model relative to this module at runtime.
        // Avoid `new URL("...", import.meta.url)` pattern which bundlers statically analyze.
        try {
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          const getUrl = new Function("p", "b", "return new URL(p, b).href");
          const href = getUrl("../../models/utterance-v2.onnx", import.meta.url) as string;
          const response = await fetch(href);
          if (response.ok) {
            modelSource = await response.arrayBuffer();
          } else {
            throw new Error(`Failed to fetch bundled model: ${response.status}`);
          }
        } catch {
          console.warn("[utterance] Bundled model not found, falling back to EnergyVAD");
          this.session = null;
          return;
        }
      }

      // Configure execution providers
      const providers: string[] = this.useWebGpu ? ["webgpu", "wasm"] : ["wasm"];

      // Create inference session
      this.session = await ort.InferenceSession.create(modelSource, {
        executionProviders: providers,
      });
    } catch (err) {
      console.warn("[utterance] Failed to load ONNX model, falling back to EnergyVAD:", err);
      this.session = null;
    }
  }

  /**
   * Run inference on extracted features.
   *
   * Buffers frames into a sliding window and runs the ONNX model
   * every 100ms (10 frames). Returns `null` when just buffering
   * (no new inference). Falls back to EnergyVAD when no ONNX model
   * is loaded.
   */
  async predict(features: AudioFeatures): Promise<ClassificationResult | null> {
    if (!this.session || !this.ort) {
      return this.fallback.classify(features);
    }

    // Add frame to circular buffer
    this.addFrame(features);
    this.framesSinceInference++;

    // Run inference every INFERENCE_INTERVAL frames (100ms)
    if (this.framesSinceInference >= INFERENCE_INTERVAL && this.framesBuffered >= CONTEXT_FRAMES) {
      this.framesSinceInference = 0;

      try {
        this.lastResult = await this.runInference();
        return this.lastResult;
      } catch (err) {
        console.warn("[utterance] ONNX inference failed, using EnergyVAD:", err);
        return this.fallback.classify(features);
      }
    }

    // Still buffering — no new result
    return null;
  }

  /**
   * Release model resources.
   */
  dispose(): void {
    if (this.session) {
      this.session.release().catch(() => {});
    }
    this.session = null;
    this.ort = null;
    this.fallback.reset();
    this.resetBuffer();
  }

  /**
   * Add a feature frame to the circular buffer.
   */
  private addFrame(features: AudioFeatures): void {
    const offset = this.bufferIdx * FEATURE_DIM;

    // Pack the 17-dim feature vector: [13 MFCCs, energy, pitch, speechRate, pauseDuration]
    this.frameBuffer.set(features.mfcc, offset);
    this.frameBuffer[offset + 13] = features.energy;
    this.frameBuffer[offset + 14] = features.pitch;
    this.frameBuffer[offset + 15] = features.speechRate;
    this.frameBuffer[offset + 16] = features.pauseDuration;

    this.bufferIdx = (this.bufferIdx + 1) % CONTEXT_FRAMES;
    if (this.framesBuffered < CONTEXT_FRAMES) {
      this.framesBuffered++;
    }
  }

  /**
   * Build the input tensor from the circular buffer and run ONNX inference.
   */
  private async runInference(): Promise<ClassificationResult> {
    const ort = this.ort!;
    const session = this.session!;

    // Unroll circular buffer into a contiguous tensor: (1, 100, 17)
    const input = new Float32Array(CONTEXT_FRAMES * FEATURE_DIM);

    // Read frames in chronological order from the circular buffer
    for (let i = 0; i < CONTEXT_FRAMES; i++) {
      const srcIdx = ((this.bufferIdx - CONTEXT_FRAMES + i + CONTEXT_FRAMES) % CONTEXT_FRAMES) * FEATURE_DIM;
      const dstIdx = i * FEATURE_DIM;
      input.set(this.frameBuffer.subarray(srcIdx, srcIdx + FEATURE_DIM), dstIdx);
    }

    // Measure recent raw energy BEFORE normalization (last 10 frames = ~100ms)
    // Feature index 13 = RMS energy. Used to gate interrupt_intent during silence.
    const RECENT = 10;
    let recentEnergy = 0;
    for (let i = CONTEXT_FRAMES - RECENT; i < CONTEXT_FRAMES; i++) {
      recentEnergy += input[i * FEATURE_DIM + 13];
    }
    recentEnergy /= RECENT;

    // Normalize features to match Python training pipeline:
    // Features 0-13 (MFCCs + energy): per-window zero-mean, unit-variance
    for (let f = 0; f < 14; f++) {
      let sum = 0;
      for (let i = 0; i < CONTEXT_FRAMES; i++) {
        sum += input[i * FEATURE_DIM + f];
      }
      const mean = sum / CONTEXT_FRAMES;

      let varSum = 0;
      for (let i = 0; i < CONTEXT_FRAMES; i++) {
        const d = input[i * FEATURE_DIM + f] - mean;
        varSum += d * d;
      }
      const std = Math.sqrt(varSum / CONTEXT_FRAMES) || 1;

      for (let i = 0; i < CONTEXT_FRAMES; i++) {
        input[i * FEATURE_DIM + f] = (input[i * FEATURE_DIM + f] - mean) / std;
      }
    }

    // Feature 14 (pitch): scale Hz → [0, 1] by dividing by 500
    for (let i = 0; i < CONTEXT_FRAMES; i++) {
      input[i * FEATURE_DIM + 14] /= 500;
    }
    // Features 15-16 (speech rate, pause duration): already normalized in extractor

    // Create tensor and run
    const tensor = new ort.Tensor("float32", input, [1, CONTEXT_FRAMES, FEATURE_DIM]);
    const results = await session.run({ input: tensor });
    const output = results.output;

    // Softmax over the 4 logits
    const logits = output.data;
    const probs = softmax(logits);

    // Find best class
    let bestIdx = 0;
    let bestProb = probs[0];
    for (let i = 1; i < probs.length; i++) {
      if (probs[i] > bestProb) {
        bestProb = probs[i];
        bestIdx = i;
      }
    }

    // Energy-gate with hysteresis: override model output during silence.
    //
    // The per-window zero-mean normalization erases the energy signal from the
    // model's perspective — once the entire window is silent, normalized values
    // look similar to speech. The model then outputs "speaking" (~78%) or
    // "interrupt_intent" (~92%) for pure silence.
    //
    // Fix: when recent raw energy is below threshold, force "thinking_pause".
    // This lets the TurnDetector's pause timer naturally fire turnEnd.
    //
    // Hysteresis prevents rapid toggling when energy hovers near the threshold
    // (e.g. quiet breath, background noise). We use a stricter threshold to
    // enter silence mode and require clearly audible speech to exit it.
    const SILENCE_ENTER_THRESHOLD = 0.02;   // Must drop below this to enter silence
    const SILENCE_EXIT_THRESHOLD  = 0.06;   // Must rise above this to exit silence

    if (this.silenceMode) {
      // In silence mode — only exit when energy clearly rises (real speech)
      if (recentEnergy > SILENCE_EXIT_THRESHOLD) {
        this.silenceMode = false;
      }
    } else {
      // Not in silence mode — enter when energy drops low enough
      if (recentEnergy < SILENCE_ENTER_THRESHOLD) {
        this.silenceMode = true;
      }
    }

    if (this.silenceMode) {
      const modelLabel = LABELS[bestIdx];
      if (modelLabel === "speaking" || modelLabel === "interrupt_intent") {
        // Override to thinking_pause (index 1) with sufficient confidence
        bestIdx = 1; // thinking_pause
        bestProb = Math.max(probs[1], 0.7); // Ensure high enough confidence to pass threshold
      }
    }

    // Interrupt energy gate: the model was trained on Switchboard two-speaker
    // telephone data, so it classifies single-speaker speech transitions as
    // interrupt_intent (~90%). In single-speaker browser use, interrupt should
    // only fire when there's strong sustained energy (actual overlapping speech).
    // Gate: require higher energy to trust interrupt_intent predictions.
    const INTERRUPT_ENERGY_THRESHOLD = 0.08;
    if (LABELS[bestIdx] === "interrupt_intent" && recentEnergy < INTERRUPT_ENERGY_THRESHOLD) {
      // Low-energy interrupt — likely a false positive from speech transition.
      // Downgrade to speaking (the model's second-best class is usually speaking).
      bestIdx = 0; // speaking
      bestProb = probs[0];
    }

    return {
      label: LABELS[bestIdx],
      confidence: bestProb,
      timestamp: Date.now(),
    };
  }

  private resetBuffer(): void {
    this.frameBuffer.fill(0);
    this.bufferIdx = 0;
    this.framesBuffered = 0;
    this.framesSinceInference = 0;
    this.lastResult = null;
    this.silenceMode = false;
  }
}

/**
 * Compute softmax over a float array.
 */
function softmax(logits: Float32Array): Float32Array {
  const max = logits.reduce((a, b) => Math.max(a, b), -Infinity);
  const exps = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    exps[i] = Math.exp(logits[i] - max);
    sum += exps[i];
  }
  for (let i = 0; i < exps.length; i++) {
    exps[i] /= sum;
  }
  return exps;
}
