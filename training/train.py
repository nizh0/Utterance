"""
Utterance model training script.

Usage:
    python train.py --config configs/transformer_small.yaml

Contributors: this is the starting point for model training.
See CONTRIBUTING.md for details on the four classification labels.
"""

import argparse


def main():
    parser = argparse.ArgumentParser(description="Train the Utterance model")
    parser.add_argument(
        "--config",
        type=str,
        required=True,
        help="Path to training config YAML",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="checkpoints/",
        help="Directory to save checkpoints",
    )
    args = parser.parse_args()

    print(f"Training config: {args.config}")
    print(f"Output directory: {args.output}")

    # TODO: Implement training pipeline
    #   1. Load and preprocess training data from data/
    #   2. Extract features (MFCCs, pitch, energy, speech rate)
    #   3. Build model (see configs/ for architecture options)
    #   4. Train with cross-validation
    #   5. Save best checkpoint
    print("Training pipeline not yet implemented — contributions welcome!")


if __name__ == "__main__":
    main()
