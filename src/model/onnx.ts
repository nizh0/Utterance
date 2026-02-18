import type { AudioFeatures, ClassificationLabel, ClassificationResult, Model } from "../types";
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

  constructor(sensitivity = 0.5, useWebGpu = false) {
    this.fallback = new EnergyVAD(sensitivity);
    this.useWebGpu = useWebGpu;
    this.frameBuffer = new Float32Array(CONTEXT_FRAMES * FEATURE_DIM);
  }

  /**
   * Load the ONNX model from a bundled path or URL.
   *
   * Dynamically imports onnxruntime-web to avoid bundling it
   * when the model isn't used (tree-shaking friendly).
   */
  async load(path: string): Promise<void> {
    try {
      // Dynamic import — only loaded when actually needed
      const ort = await import("onnxruntime-web") as unknown as OrtModule;
      this.ort = ort;

      // Resolve model path
      let modelSource: string | ArrayBuffer = path;
      if (path === "bundled") {
        // Try to resolve from the package's models/ directory
        try {
          const response = await fetch(new URL("../../models/utterance-v1.onnx", import.meta.url).href);
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
   * every 100ms (10 frames). Between inference runs, returns the
   * cached result. Falls back to EnergyVAD when no model is loaded.
   */
  async predict(features: AudioFeatures): Promise<ClassificationResult> {
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
      } catch (err) {
        console.warn("[utterance] ONNX inference failed, using EnergyVAD:", err);
        return this.fallback.classify(features);
      }
    }

    // Return cached result or fallback
    return this.lastResult ?? this.fallback.classify(features);
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
