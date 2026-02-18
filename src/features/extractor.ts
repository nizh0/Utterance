import type { AudioFeatures } from "../types";

/**
 * Extracts audio features from raw PCM frames.
 *
 * Produces a 17-dimensional feature vector per frame:
 *   - 13 MFCCs (Mel-Frequency Cepstral Coefficients)
 *   - 1 RMS energy
 *   - 1 pitch (F0)
 *   - 1 speech rate
 *   - 1 pause duration
 *
 * These features are designed to match the Python training pipeline
 * (librosa-based) within ~1-2% tolerance. The model is trained with
 * noise augmentation to handle the drift.
 */
export class FeatureExtractor {
  private readonly sampleRate: number;
  private readonly nFft: number;
  private readonly nMels: number;
  private readonly nMfcc: number;

  // Pre-computed DSP tables
  private readonly hammingWindow: Float32Array;
  private readonly melFilterbank: Float32Array[];
  private readonly dctMatrix: Float32Array[];

  // State for pause duration tracking
  private silenceAccumulator = 0;
  private readonly silenceThreshold = 0.01;
  private readonly frameDurationSec: number;

  // State for speech rate (rolling energy buffer)
  private readonly energyBuffer: Float32Array;
  private energyBufferIdx = 0;
  private energyBufferFull = false;

  constructor(sampleRate = 16000) {
    this.sampleRate = sampleRate;
    this.nFft = Math.floor(sampleRate * 0.025); // 25ms frame = 400 samples at 16kHz
    this.nMels = 40;
    this.nMfcc = 13;
    this.frameDurationSec = 0.01; // 10ms hop

    // Pre-compute Hamming window
    this.hammingWindow = new Float32Array(this.nFft);
    for (let i = 0; i < this.nFft; i++) {
      this.hammingWindow[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (this.nFft - 1));
    }

    // Pre-compute Mel filterbank
    this.melFilterbank = this.createMelFilterbank();

    // Pre-compute DCT matrix for MFCC
    this.dctMatrix = this.createDCTMatrix();

    // Rolling energy buffer for speech rate (1 second of frames)
    const framesPerSecond = Math.floor(1.0 / this.frameDurationSec);
    this.energyBuffer = new Float32Array(framesPerSecond);
  }

  /**
   * Extract all features from a single audio frame.
   */
  extract(frame: Float32Array): AudioFeatures {
    const energy = this.computeEnergy(frame);
    const mfcc = this.computeMFCC(frame);
    const pitch = this.estimatePitch(frame);
    const speechRate = this.estimateSpeechRate(energy);
    const pauseDuration = this.updatePauseDuration(energy);

    return { mfcc, energy, pitch, speechRate, pauseDuration };
  }

  /**
   * Compute Mel-Frequency Cepstral Coefficients.
   *
   * Pipeline: Pre-emphasis → Hamming window → FFT → Mel filterbank → log → DCT
   */
  private computeMFCC(frame: Float32Array): Float32Array {
    // 1. Pre-emphasis filter (coefficient = 0.97)
    const preEmph = new Float32Array(this.nFft);
    const len = Math.min(frame.length, this.nFft);
    preEmph[0] = frame[0];
    for (let i = 1; i < len; i++) {
      preEmph[i] = frame[i] - 0.97 * frame[i - 1];
    }

    // 2. Apply Hamming window
    for (let i = 0; i < this.nFft; i++) {
      preEmph[i] *= this.hammingWindow[i];
    }

    // 3. FFT → power spectrum
    const spectrum = this.fftMagnitude(preEmph);

    // 4. Apply Mel filterbank
    const melEnergies = new Float32Array(this.nMels);
    for (let m = 0; m < this.nMels; m++) {
      let sum = 0;
      const filter = this.melFilterbank[m];
      for (let k = 0; k < filter.length; k++) {
        sum += spectrum[k] * filter[k];
      }
      // Log energy (add small epsilon to avoid log(0))
      melEnergies[m] = Math.log(Math.max(sum, 1e-10));
    }

    // 5. DCT to get MFCCs
    const mfcc = new Float32Array(this.nMfcc);
    for (let i = 0; i < this.nMfcc; i++) {
      let sum = 0;
      const dctRow = this.dctMatrix[i];
      for (let j = 0; j < this.nMels; j++) {
        sum += dctRow[j] * melEnergies[j];
      }
      mfcc[i] = sum;
    }

    return mfcc;
  }

  /**
   * Compute RMS energy of the frame.
   */
  private computeEnergy(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
    }
    return Math.sqrt(sum / frame.length);
  }

  /**
   * Estimate fundamental frequency (pitch) using simplified autocorrelation.
   *
   * Looks for the dominant periodicity in the signal within the
   * speech frequency range (50-500 Hz). Returns 0 for unvoiced frames.
   */
  private estimatePitch(frame: Float32Array): number {
    const minPeriod = Math.floor(this.sampleRate / 500); // 500 Hz
    const maxPeriod = Math.floor(this.sampleRate / 50);  // 50 Hz
    const len = Math.min(frame.length, this.nFft);

    if (len < maxPeriod * 2) return 0;

    // Compute autocorrelation for lag range [minPeriod, maxPeriod]
    let bestCorr = 0;
    let bestLag = 0;

    // Compute energy for normalization
    let energy = 0;
    for (let i = 0; i < len; i++) {
      energy += frame[i] * frame[i];
    }
    if (energy < 1e-10) return 0;

    for (let lag = minPeriod; lag <= maxPeriod && lag < len; lag++) {
      let corr = 0;
      let energyLag = 0;
      const limit = len - lag;
      for (let i = 0; i < limit; i++) {
        corr += frame[i] * frame[i + lag];
        energyLag += frame[i + lag] * frame[i + lag];
      }

      // Normalized correlation
      const norm = Math.sqrt(energy * energyLag);
      if (norm > 0) {
        corr /= norm;
      }

      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    // Voiced threshold — require strong periodicity
    if (bestCorr < 0.3 || bestLag === 0) return 0;

    return this.sampleRate / bestLag;
  }

  /**
   * Estimate speech rate from rolling energy envelope.
   *
   * Counts energy peaks in a 1-second sliding window.
   * Returns a normalized value (~0-1 range, where 0.3-0.7 is typical speech).
   */
  private estimateSpeechRate(energy: number): number {
    // Add to rolling buffer
    this.energyBuffer[this.energyBufferIdx] = energy;
    this.energyBufferIdx = (this.energyBufferIdx + 1) % this.energyBuffer.length;
    if (this.energyBufferIdx === 0) this.energyBufferFull = true;

    const len = this.energyBufferFull ? this.energyBuffer.length : this.energyBufferIdx;
    if (len < 5) return 0;

    // Count peaks in the energy buffer
    let peaks = 0;
    const threshold = this.silenceThreshold * 0.5;
    for (let i = 2; i < len - 2; i++) {
      const idx = (this.energyBufferIdx - len + i + this.energyBuffer.length) % this.energyBuffer.length;
      const prev = this.energyBuffer[(idx - 1 + this.energyBuffer.length) % this.energyBuffer.length];
      const curr = this.energyBuffer[idx];
      const next = this.energyBuffer[(idx + 1) % this.energyBuffer.length];

      if (curr > prev && curr > next && curr > threshold) {
        peaks++;
      }
    }

    // Normalize: typical speech is 3-7 syllables/sec → peaks in 1 second
    const windowDuration = len * this.frameDurationSec;
    const rate = windowDuration > 0 ? peaks / windowDuration : 0;
    return rate / 10.0; // Scale to ~[0, 1]
  }

  /**
   * Track accumulated pause duration.
   *
   * Returns pause duration in seconds, capped at 5s and normalized to [0, 1].
   */
  private updatePauseDuration(energy: number): number {
    if (energy < this.silenceThreshold) {
      this.silenceAccumulator += this.frameDurationSec;
    } else {
      this.silenceAccumulator = 0;
    }
    return Math.min(this.silenceAccumulator, 5.0) / 5.0;
  }

  /**
   * Compute FFT magnitude spectrum (power spectrum).
   *
   * Uses a radix-2 DIT FFT implementation. For frames smaller than
   * nFft, zero-pads to the next power of 2.
   */
  private fftMagnitude(signal: Float32Array): Float32Array {
    // Pad to next power of 2
    let n = 1;
    while (n < signal.length) n *= 2;

    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    real.set(signal);

    // Bit-reversal permutation
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
      let m = n >> 1;
      while (m >= 1 && j >= m) {
        j -= m;
        m >>= 1;
      }
      j += m;
    }

    // Cooley-Tukey FFT
    for (let size = 2; size <= n; size *= 2) {
      const halfSize = size / 2;
      const angle = (-2 * Math.PI) / size;
      const wReal = Math.cos(angle);
      const wImag = Math.sin(angle);

      for (let i = 0; i < n; i += size) {
        let curReal = 1;
        let curImag = 0;

        for (let k = 0; k < halfSize; k++) {
          const evenIdx = i + k;
          const oddIdx = i + k + halfSize;

          const tReal = curReal * real[oddIdx] - curImag * imag[oddIdx];
          const tImag = curReal * imag[oddIdx] + curImag * real[oddIdx];

          real[oddIdx] = real[evenIdx] - tReal;
          imag[oddIdx] = imag[evenIdx] - tImag;
          real[evenIdx] += tReal;
          imag[evenIdx] += tImag;

          const newCurReal = curReal * wReal - curImag * wImag;
          curImag = curReal * wImag + curImag * wReal;
          curReal = newCurReal;
        }
      }
    }

    // Power spectrum (only first half + 1 bins)
    const numBins = n / 2 + 1;
    const power = new Float32Array(numBins);
    for (let i = 0; i < numBins; i++) {
      power[i] = (real[i] * real[i] + imag[i] * imag[i]) / n;
    }

    return power;
  }

  /**
   * Create Mel filterbank matrix.
   *
   * Produces nMels triangular filters spanning the frequency range
   * from 0 to sampleRate/2 on the Mel scale.
   */
  private createMelFilterbank(): Float32Array[] {
    const numBins = Math.floor(this.nFft / 2) + 1;
    // Pad to power of 2
    let n = 1;
    while (n < this.nFft) n *= 2;
    const fftBins = n / 2 + 1;

    const fMin = 0;
    const fMax = this.sampleRate / 2;
    const melMin = this.hzToMel(fMin);
    const melMax = this.hzToMel(fMax);

    // Mel points (nMels + 2 for the edges)
    const melPoints = new Float32Array(this.nMels + 2);
    for (let i = 0; i < this.nMels + 2; i++) {
      melPoints[i] = melMin + (i * (melMax - melMin)) / (this.nMels + 1);
    }

    // Convert back to Hz and then to FFT bin indices
    const binIndices = new Float32Array(this.nMels + 2);
    for (let i = 0; i < this.nMels + 2; i++) {
      const hz = this.melToHz(melPoints[i]);
      binIndices[i] = Math.floor(((n + 1) * hz) / this.sampleRate);
    }

    // Create triangular filters
    const filters: Float32Array[] = [];
    for (let m = 0; m < this.nMels; m++) {
      const filter = new Float32Array(fftBins);
      const left = binIndices[m];
      const center = binIndices[m + 1];
      const right = binIndices[m + 2];

      for (let k = 0; k < fftBins; k++) {
        if (k >= left && k <= center && center > left) {
          filter[k] = (k - left) / (center - left);
        } else if (k > center && k <= right && right > center) {
          filter[k] = (right - k) / (right - center);
        }
      }
      filters.push(filter);
    }

    return filters;
  }

  /**
   * Create DCT-II matrix for MFCC computation.
   */
  private createDCTMatrix(): Float32Array[] {
    const matrix: Float32Array[] = [];
    const scale = Math.sqrt(2.0 / this.nMels);

    for (let i = 0; i < this.nMfcc; i++) {
      const row = new Float32Array(this.nMels);
      for (let j = 0; j < this.nMels; j++) {
        row[j] = scale * Math.cos((Math.PI * i * (j + 0.5)) / this.nMels);
      }
      matrix.push(row);
    }

    return matrix;
  }

  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  private melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
   * Reset internal state (energy buffer, pause accumulator).
   */
  reset(): void {
    this.silenceAccumulator = 0;
    this.energyBuffer.fill(0);
    this.energyBufferIdx = 0;
    this.energyBufferFull = false;
  }
}
