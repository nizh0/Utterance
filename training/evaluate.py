"""
Evaluate the trained ONNX model on a hand-labeled test set.

Usage:
    python evaluate.py --model ../models/utterance-v1.onnx --test-dir data/test/ --config configs/hybrid_v1.yaml

Test set structure:
    data/test/
        clip_001.wav         — audio file
        clip_001.json        — annotations with labeled segments
        ...

Annotation format (same as training):
    {
        "annotations": [
            {"start": 0.0, "end": 1.5, "label": "speaking", "speaker": "A"},
            {"start": 1.5, "end": 2.1, "label": "thinking_pause", "speaker": "A"},
            ...
        ]
    }
"""

import argparse
import json
from pathlib import Path

import numpy as np
import yaml


def load_config(config_path: str) -> dict:
    with open(config_path) as f:
        return yaml.safe_load(f)


def evaluate_clip(
    audio_path: Path,
    annotation_path: Path,
    session,
    config: dict,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Run model on a single test clip and compare to ground truth.

    Returns (predictions, ground_truth) as arrays of label indices.
    """
    import librosa
    from features.extract import FeatureExtractor
    from data.generate_labels import generate_frame_labels, create_windows

    data_cfg = config["data"]
    model_cfg = config["model"]
    sr = data_cfg["sample_rate"]
    frame_shift_ms = data_cfg["frame_shift_ms"]
    context_frames = model_cfg["context_frames"]

    # Load audio
    audio, _ = librosa.load(str(audio_path), sr=sr, mono=True)
    duration = len(audio) / sr

    # Load annotations
    with open(annotation_path) as f:
        ann_data = json.load(f)

    # Generate ground truth labels
    frame_labels = generate_frame_labels(ann_data["annotations"], duration, frame_shift_ms)
    window_indices, window_labels = create_windows(frame_labels, context_frames, hop_frames=10)

    if len(window_labels) == 0:
        return np.array([]), np.array([])

    # Extract features
    extractor = FeatureExtractor(config)
    features = extractor.extract_all(audio, augment=False)

    # Create windows
    from features.extract import extract_windowed_features
    windowed = extract_windowed_features(features, window_indices)

    # Run inference
    predictions = []
    for i in range(0, len(windowed), 32):  # batch of 32
        batch = windowed[i:i + 32]
        outputs = session.run(None, {"input": batch})[0]
        preds = outputs.argmax(axis=1)
        predictions.extend(preds.tolist())

    return np.array(predictions), window_labels


def main():
    parser = argparse.ArgumentParser(description="Evaluate ONNX model on hand-labeled test set")
    parser.add_argument("--model", type=str, required=True, help="Path to ONNX model")
    parser.add_argument("--test-dir", type=str, required=True, help="Path to test data directory")
    parser.add_argument("--config", type=str, default="configs/hybrid_v1.yaml", help="Training config YAML")
    args = parser.parse_args()

    import onnxruntime as ort

    config = load_config(args.config)
    label_names = config["labels"]
    num_classes = config["model"]["num_classes"]

    # Load model
    print(f"Loading model: {args.model}")
    session = ort.InferenceSession(args.model)

    # Find test clips
    test_dir = Path(args.test_dir)
    wav_files = sorted(test_dir.glob("*.wav"))

    if not wav_files:
        print(f"No .wav files found in {test_dir}")
        print("\nTo create a test set:")
        print("  1. Record 10-20 short conversational clips")
        print("  2. Save as .wav files in the test directory")
        print("  3. Create matching .json annotation files")
        print("  4. Re-run this script")
        return

    print(f"Found {len(wav_files)} test clips")

    # Evaluate each clip
    all_preds = []
    all_truths = []
    confusion = np.zeros((num_classes, num_classes), dtype=np.int64)

    for wav_path in wav_files:
        json_path = wav_path.with_suffix(".json")
        if not json_path.exists():
            print(f"  Skipping {wav_path.name} — no annotation file")
            continue

        preds, truths = evaluate_clip(wav_path, json_path, session, config)
        if len(preds) == 0:
            continue

        all_preds.extend(preds.tolist())
        all_truths.extend(truths.tolist())

        for t, p in zip(truths, preds):
            confusion[t][p] += 1

        # Per-clip accuracy
        clip_acc = (preds == truths).mean()
        print(f"  {wav_path.name}: {clip_acc:.1%} accuracy ({len(preds)} windows)")

    if not all_preds:
        print("No predictions generated. Check test data.")
        return

    # Overall metrics
    all_preds = np.array(all_preds)
    all_truths = np.array(all_truths)
    overall_acc = (all_preds == all_truths).mean()

    print(f"\n{'=' * 60}")
    print(f"Overall accuracy: {overall_acc:.1%} ({len(all_preds)} windows)")

    # Confusion matrix
    print(f"\nConfusion Matrix (rows=true, cols=predicted):")
    header = "".ljust(20) + "".join(f"{n:>15s}" for n in label_names)
    print(header)
    print("-" * len(header))
    for i, name in enumerate(label_names):
        row = name.ljust(20) + "".join(f"{confusion[i][j]:>15d}" for j in range(num_classes))
        print(row)

    # Per-class metrics
    print(f"\nPer-class metrics:")
    target = config.get("evaluation", {}).get("target_accuracy", 0.85)
    all_meet_target = True

    for i, name in enumerate(label_names):
        tp = confusion[i][i]
        fn = confusion[i].sum() - tp
        fp = confusion[:, i].sum() - tp
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        accuracy = tp / confusion[i].sum() if confusion[i].sum() > 0 else 0

        status = "✓" if accuracy >= target else "✗"
        if accuracy < target:
            all_meet_target = False

        print(f"  {status} {name:20s}: acc={accuracy:.3f}  prec={precision:.3f}  recall={recall:.3f}  f1={f1:.3f}")

    print(f"\nTarget: {target:.0%} per-class accuracy")
    if all_meet_target:
        print("✓ All classes meet the target!")
    else:
        print("✗ Some classes are below target.")


if __name__ == "__main__":
    main()
