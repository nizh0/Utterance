"""
Export a trained Utterance model to ONNX format.

Usage:
    python export.py --checkpoint checkpoints/best.pt --output models/utterance-v1.onnx

The exported model must:
    - Be under 5MB
    - Accept the feature vector defined in src/types.ts
    - Output probabilities for: speaking, thinking_pause, turn_complete, interrupt_intent
"""

import argparse


def main():
    parser = argparse.ArgumentParser(description="Export model to ONNX")
    parser.add_argument(
        "--checkpoint",
        type=str,
        required=True,
        help="Path to trained model checkpoint",
    )
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Output path for the ONNX model",
    )
    args = parser.parse_args()

    print(f"Checkpoint: {args.checkpoint}")
    print(f"Output: {args.output}")

    # TODO: Implement ONNX export
    #   1. Load PyTorch checkpoint
    #   2. Create dummy input matching feature dimensions
    #   3. torch.onnx.export() with dynamic axes
    #   4. Validate output size < 5MB
    #   5. Run test inference to verify output shape
    print("ONNX export not yet implemented — contributions welcome!")


if __name__ == "__main__":
    main()
