"""
Generate frame-level labels from conversational audio annotations.

Takes the raw audio + annotation files produced by download.py and generates
frame-level feature+label arrays suitable for training.

Usage:
    python data/generate_labels.py --input data/raw/synthetic --output data/processed/ --config configs/hybrid_v1.yaml
"""

import argparse
import json
from pathlib import Path

import numpy as np
import yaml


def load_config(config_path: str) -> dict:
    with open(config_path) as f:
        return yaml.safe_load(f)


def time_to_frame(time_sec: float, frame_shift_ms: int) -> int:
    """Convert a time in seconds to a frame index."""
    return int(time_sec * 1000 / frame_shift_ms)


def generate_frame_labels(
    annotations: list[dict],
    total_duration: float,
    frame_shift_ms: int,
) -> np.ndarray:
    """
    Convert time-based annotations to frame-level label indices.

    Label mapping:
        0 = speaking
        1 = thinking_pause
        2 = turn_complete
        3 = interrupt_intent

    Frames not covered by any annotation default to 'thinking_pause' (silence).
    """
    label_map = {
        "speaking": 0,
        "thinking_pause": 1,
        "turn_complete": 2,
        "interrupt_intent": 3,
    }

    total_frames = time_to_frame(total_duration, frame_shift_ms)
    # Default: silence → thinking_pause (will be overwritten by actual annotations)
    labels = np.full(total_frames, label_map["thinking_pause"], dtype=np.int64)

    for ann in annotations:
        start_frame = time_to_frame(ann["start"], frame_shift_ms)
        end_frame = time_to_frame(ann["end"], frame_shift_ms)
        label_idx = label_map.get(ann["label"])

        if label_idx is None:
            continue

        start_frame = max(0, start_frame)
        end_frame = min(total_frames, end_frame)

        # Interrupt labels take priority over other labels
        if ann["label"] == "interrupt_intent":
            labels[start_frame:end_frame] = label_idx
        else:
            # Only write where not already interrupt
            mask = labels[start_frame:end_frame] != label_map["interrupt_intent"]
            labels[start_frame:end_frame] = np.where(
                mask, label_idx, labels[start_frame:end_frame]
            )

    return labels


def create_windows(
    labels: np.ndarray,
    context_frames: int,
    hop_frames: int = 10,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Slice frame-level labels into fixed-size windows.

    Each window gets a single label = the majority label in that window.
    This matches the model's input: (batch, context_frames) → (batch, 1 label).

    Returns:
        window_indices: (N, 2) array of [start_frame, end_frame] for each window
        window_labels: (N,) array of majority label per window
    """
    n_frames = len(labels)
    if n_frames < context_frames:
        return np.empty((0, 2), dtype=np.int64), np.empty(0, dtype=np.int64)

    indices = []
    window_labels = []

    for start in range(0, n_frames - context_frames + 1, hop_frames):
        end = start + context_frames
        window = labels[start:end]

        # Majority vote for window label
        counts = np.bincount(window, minlength=4)
        majority = counts.argmax()

        indices.append([start, end])
        window_labels.append(majority)

    return np.array(indices, dtype=np.int64), np.array(window_labels, dtype=np.int64)


def process_conversation(
    audio_path: Path,
    annotation_path: Path,
    config: dict,
) -> dict | None:
    """Process a single conversation into windowed label data."""
    import librosa

    data_cfg = config["data"]
    sr = data_cfg["sample_rate"]
    frame_shift_ms = data_cfg["frame_shift_ms"]
    context_frames = config["model"]["context_frames"]

    # Load annotation
    with open(annotation_path) as f:
        ann_data = json.load(f)

    # Load audio to get exact duration
    audio, _ = librosa.load(str(audio_path), sr=sr, mono=True)
    duration = len(audio) / sr

    # Generate frame-level labels
    frame_labels = generate_frame_labels(
        ann_data["annotations"],
        duration,
        frame_shift_ms,
    )

    # Create windows with hop of 10 frames (100ms)
    window_indices, window_labels = create_windows(
        frame_labels,
        context_frames,
        hop_frames=10,
    )

    if len(window_labels) == 0:
        return None

    return {
        "audio": audio,
        "frame_labels": frame_labels,
        "window_indices": window_indices,
        "window_labels": window_labels,
        "duration": duration,
        "sr": sr,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate frame-level labels for training")
    parser.add_argument("--input", type=str, required=True, help="Path to raw data directory (e.g., data/raw/synthetic)")
    parser.add_argument("--output", type=str, default="data/processed", help="Output directory for processed .npz files")
    parser.add_argument("--config", type=str, default="configs/hybrid_v1.yaml", help="Training config YAML")
    args = parser.parse_args()

    config = load_config(args.config)
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load manifest
    manifest_path = input_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"No manifest.json found at {manifest_path}")

    with open(manifest_path) as f:
        manifest = json.load(f)

    print(f"Processing {len(manifest)} conversations...")

    label_names = ["speaking", "thinking_pause", "turn_complete", "interrupt_intent"]
    total_windows = 0
    label_counts = np.zeros(4, dtype=np.int64)
    all_window_indices = []
    all_window_labels = []
    all_audio_paths = []

    for i, entry in enumerate(manifest):
        audio_path = input_dir / entry["audio"]
        annot_path = input_dir / entry["annotations"]

        result = process_conversation(audio_path, annot_path, config)
        if result is None:
            continue

        conv_id = entry["id"]

        # Save per-conversation .npz with audio + labels
        np.savez_compressed(
            str(output_dir / f"{conv_id}.npz"),
            audio=result["audio"],
            frame_labels=result["frame_labels"],
            window_indices=result["window_indices"],
            window_labels=result["window_labels"],
            sr=result["sr"],
        )

        total_windows += len(result["window_labels"])
        label_counts += np.bincount(result["window_labels"], minlength=4)
        all_window_labels.extend(result["window_labels"].tolist())
        all_audio_paths.append(str(output_dir / f"{conv_id}.npz"))

        if (i + 1) % 20 == 0:
            print(f"  Processed {i + 1}/{len(manifest)}")

    # Save master index
    index = {
        "files": all_audio_paths,
        "total_windows": total_windows,
        "label_distribution": {label_names[i]: int(label_counts[i]) for i in range(4)},
    }

    with open(output_dir / "index.json", "w") as f:
        json.dump(index, f, indent=2)

    # Print stats
    print(f"\nDone! Processed {len(manifest)} conversations → {total_windows} training windows")
    print(f"\nLabel distribution:")
    for i, name in enumerate(label_names):
        count = label_counts[i]
        pct = count / total_windows * 100 if total_windows > 0 else 0
        print(f"  {name:20s}: {count:6d} ({pct:.1f}%)")

    # Compute class weights (inverse frequency)
    if total_windows > 0:
        freqs = label_counts / total_windows
        weights = 1.0 / (freqs + 1e-8)
        weights = weights / weights.sum() * len(label_names)
        print(f"\nSuggested class weights: {dict(zip(label_names, [f'{w:.3f}' for w in weights]))}")


if __name__ == "__main__":
    main()
