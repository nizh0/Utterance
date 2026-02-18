import type { AudioSource } from "../types";

/**
 * Captures audio from the user's microphone via the Web Audio API.
 *
 * This class abstracts browser audio access so the rest of the pipeline
 * can work with raw Float32Array buffers at a consistent sample rate.
 */
export class AudioCapture implements AudioSource {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private callback: ((data: Float32Array) => void) | null = null;
  private readonly sampleRate: number;

  constructor(sampleRate = 16000) {
    this.sampleRate = sampleRate;
  }

  onAudioData(callback: (data: Float32Array) => void): void {
    this.callback = callback;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: this.sampleRate,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.context = new AudioContext({ sampleRate: this.sampleRate });
    const source = this.context.createMediaStreamSource(this.stream);

    // TODO: Migrate to AudioWorklet for better performance.
    // ScriptProcessorNode is deprecated but still widely supported.
    const bufferSize = 4096;
    this.processor = this.context.createScriptProcessor(bufferSize, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      this.callback?.(new Float32Array(input));
    };

    source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  stop(): void {
    this.processor?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();

    this.processor = null;
    this.stream = null;
    this.context = null;
  }
}
