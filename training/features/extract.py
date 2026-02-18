"""
Extract audio features from processed conversation data.

Extracts 17-dimensional feature vectors per frame:
  - 13 MFCCs (librosa.feature.mfcc)
  - RMS energy (librosa.feature.rms)
  - Pitch / F0 (librosa.pyin)
  - Speech rate (energy envelope peak counting)
  - Pause duration (accumulated silence length)

These features must match the TypeScript implementation in src/features/extractor.ts
within ~1-2% tolerance. The model is trained with noise augmentation to handle drift.

Usage:
    python features/extract.py --input data/processed/ --output data/features/ --config configs/hybrid_v1.yaml
"""

import argparse
import json
from pathlib import Path

import librosa
import numpy as np
import yaml


def load_config(config_path: str) -> dict:
    with open(config_path) as f:
        return yaml.safe_load(f)


class FeatureExtractor:
    """Extract the 17-dim feature vector that matches the TypeScript runtime."""

    def __init__(self, config: dict):
        data_cfg = config["data"]
        self.sr = data_cfg["sample_rate"]
        self.frame_length_ms = data_cfg["frame_length_ms"]
        self.frame_shift_ms = data_cfg["frame_shift_ms"]
        self.n_mfcc = data_cfg["num_mfcc"]
        self.noise_std = data_cfg.get("noise_augmentation_std", 0.0)

        # Derived
        self.n_fft = int(self.sr * self.frame_length_ms / 1000)  # 400 samples at 16kHz
        self.hop_length = int(self.sr * self.frame_shift_ms / 1000)  # 160 samples

    def extract_all(self, audio: np.ndarray, augment: bool = False) -> np.ndarray:
        """
        Extract features for all frames of an audio signal.

        Returns:
            features: (n_frames, 17) array
        """
        # Ensure float32
        audio = audio.astype(np.float32)

        # 1. MFCCs: (n_mfcc, n_frames)
        mfccs = librosa.feature.mfcc(
            y=audio,
            sr=self.sr,
            n_mfcc=self.n_mfcc,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            window="hamming",
            center=True,
            n_mels=40,
        )

        # 2. RMS energy: (1, n_frames)
        rms = librosa.feature.rms(
            y=audio,
            frame_length=self.n_fft,
            hop_length=self.hop_length,
            center=True,
        )

        # 3. Pitch (F0) via pyin: (n_frames,)
        f0, voiced_flag, _ = librosa.pyin(
            audio,
            fmin=50,
            fmax=500,
            sr=self.sr,
            frame_length=self.n_fft,
            hop_length=self.hop_length,
            center=True,
        )
        # Replace NaN (unvoiced) with 0
        f0 = np.nan_to_num(f0, nan=0.0)

        # 4. Speech rate: energy envelope peak counting
        speech_rate = self._compute_speech_rate(audio, rms[0])

        # 5. Pause duration: accumulated silence per frame
        pause_duration = self._compute_pause_duration(rms[0])

        # Align all features to the same number of frames
        n_frames = min(mfccs.shape[1], rms.shape[1], len(f0), len(speech_rate), len(pause_duration))
        mfccs = mfccs[:, :n_frames].T  # (n_frames, 13)
        rms = rms[0, :n_frames].reshape(-1, 1)  # (n_frames, 1)
        f0 = f0[:n_frames].reshape(-1, 1)  # (n_frames, 1)
        speech_rate = speech_rate[:n_frames].reshape(-1, 1)  # (n_frames, 1)
        pause_duration = pause_duration[:n_frames].reshape(-1, 1)  # (n_frames, 1)

        # Normalize features
        mfccs = self._normalize(mfccs)
        rms = self._normalize(rms)
        f0 = f0 / 500.0  # Scale pitch to ~[0, 1] range
        # speech_rate and pause_duration are already in reasonable ranges

        # Stack: (n_frames, 17)
        features = np.concatenate([mfccs, rms, f0, speech_rate, pause_duration], axis=1)

        # Optional noise augmentation for training
        if augment and self.noise_std > 0:
            noise = np.random.normal(0, self.noise_std, features.shape).astype(np.float32)
            features = features + noise

        return features.astype(np.float32)

    def _compute_speech_rate(self, audio: np.ndarray, rms: np.ndarray) -> np.ndarray:
        """
        Estimate speech rate per frame using energy envelope peak counting.

        Counts energy peaks in a sliding 1-second window → syllables/second estimate.
        """
        from scipy.signal import find_peaks

        n_frames = len(rms)
        speech_rate = np.zeros(n_frames, dtype=np.float32)

        # Smooth RMS for peak detection
        kernel_size = 5
        if len(rms) >= kernel_size:
            smoothed = np.convolve(rms, np.ones(kernel_size) / kernel_size, mode="same")
        else:
            smoothed = rms

        # Sliding window: 1 second = sr/hop_length frames
        window_frames = int(self.sr / self.hop_length)
        half_window = window_frames // 2

        # Threshold for "speech" vs "silence"
        threshold = np.median(smoothed) * 0.5

        for i in range(n_frames):
            start = max(0, i - half_window)
            end = min(n_frames, i + half_window)
            window = smoothed[start:end]

            # Count peaks above threshold
            peaks, _ = find_peaks(window, height=threshold, distance=3)
            # Convert to rate (peaks per second)
            window_duration = (end - start) * self.frame_shift_ms / 1000
            if window_duration > 0:
                speech_rate[i] = len(peaks) / window_duration
            else:
                speech_rate[i] = 0

        # Normalize to ~[0, 1] (typical speech is 3-7 syllables/sec)
        speech_rate = speech_rate / 10.0

        return speech_rate

    def _compute_pause_duration(self, rms: np.ndarray) -> np.ndarray:
        """
        Compute accumulated pause duration per frame.

        Tracks how long silence has been going at each frame (in seconds).
        Resets when speech energy is detected.
        """
        n_frames = len(rms)
        pause_duration = np.zeros(n_frames, dtype=np.float32)
        threshold = np.median(rms) * 0.3
        frame_dur = self.frame_shift_ms / 1000.0

        accumulated = 0.0
        for i in range(n_frames):
            if rms[i] < threshold:
                accumulated += frame_dur
            else:
                accumulated = 0.0
            pause_duration[i] = accumulated

        # Cap at 5 seconds and normalize to [0, 1]
        pause_duration = np.minimum(pause_duration, 5.0) / 5.0

        return pause_duration

    def _normalize(self, features: np.ndarray) -> np.ndarray:
        """Per-feature zero-mean unit-variance normalization."""
        mean = features.mean(axis=0, keepdims=True)
        std = features.std(axis=0, keepdims=True)
        std = np.where(std < 1e-8, 1.0, std)
        return (features - mean) / std


def extract_windowed_features(
    features: np.ndarray,
    window_indices: np.ndarray,
) -> np.ndarray:
    """
    Extract fixed-size feature windows for the model.

    Args:
        features: (n_frames, 17) full feature array
        window_indices: (N, 2) start/end frame indices

    Returns:
        windows: (N, context_frames, 17) feature windows
    """
    n_windows = len(window_indices)
    if n_windows == 0:
        return np.empty((0, 0, 17), dtype=np.float32)

    context_frames = window_indices[0, 1] - window_indices[0, 0]
    windows = np.zeros((n_windows, context_frames, 17), dtype=np.float32)

    for i, (start, end) in enumerate(window_indices):
        end = min(end, len(features))
        length = end - start
        if length > 0:
            windows[i, :length] = features[start:end]

    return windows


def main():
    parser = argparse.ArgumentParser(description="Extract features from processed conversation data")
    parser.add_argument("--input", type=str, required=True, help="Path to processed data directory")
    parser.add_argument("--output", type=str, default="data/features", help="Output directory for feature .npz files")
    parser.add_argument("--config", type=str, default="configs/hybrid_v1.yaml", help="Training config YAML")
    parser.add_argument("--augment", action="store_true", help="Apply noise augmentation to features")
    args = parser.parse_args()

    config = load_config(args.config)
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    extractor = FeatureExtractor(config)

    # Load index
    index_path = input_dir / "index.json"
    if not index_path.exists():
        raise FileNotFoundError(f"No index.json found at {index_path}. Run generate_labels.py first.")

    with open(index_path) as f:
        index = json.load(f)

    print(f"Extracting features for {len(index['files'])} conversations...")

    all_features_files = []
    total_windows = 0

    for i, npz_path in enumerate(index["files"]):
        data = np.load(npz_path)
        audio = data["audio"]
        window_indices = data["window_indices"]
        window_labels = data["window_labels"]

        # Extract features for full audio
        features = extractor.extract_all(audio, augment=args.augment)

        # Extract windowed features
        windowed = extract_windowed_features(features, window_indices)

        if len(windowed) == 0:
            continue

        # Save
        conv_id = Path(npz_path).stem
        out_path = output_dir / f"{conv_id}.npz"
        np.savez_compressed(
            str(out_path),
            features=windowed,        # (N, 100, 17)
            labels=window_labels,      # (N,)
        )

        all_features_files.append(str(out_path))
        total_windows += len(window_labels)

        if (i + 1) % 20 == 0:
            print(f"  Extracted {i + 1}/{len(index['files'])}")

    # Save feature index
    feature_index = {
        "files": all_features_files,
        "total_windows": total_windows,
        "feature_dim": 17,
        "context_frames": config["model"]["context_frames"],
    }

    with open(output_dir / "index.json", "w") as f:
        json.dump(feature_index, f, indent=2)

    print(f"\nDone! Extracted features for {total_windows} windows")
    print(f"Output: {output_dir}")


if __name__ == "__main__":
    main()
