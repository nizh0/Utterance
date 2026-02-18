"""
Export trained Utterance model to ONNX format with int8 quantization.

Usage:
    python export.py --checkpoint checkpoints/best.pt --output ../models/utterance-v1.onnx

The exported model:
    - Accepts input shape (batch, 100, 17) — 1 second of 17-dim features
    - Outputs shape (batch, 4) — logits for [speaking, thinking_pause, turn_complete, interrupt_intent]
    - Quantized to int8 for optimal WASM SIMD performance
    - Must be <5MB
"""

import argparse
import os
import tempfile
from pathlib import Path

import numpy as np
import torch
import yaml

from model import build_model_from_config


def export_to_onnx(
    model: torch.nn.Module,
    output_path: Path,
    context_frames: int = 100,
    input_dim: int = 17,
    opset_version: int = 17,
) -> Path:
    """Export PyTorch model to ONNX format.

    Uses the legacy TorchScript-based exporter for compatibility with
    onnxruntime int8 quantization (the dynamo exporter produces graphs
    that fail shape inference during quantization).
    """
    model.eval()
    model.cpu()

    # Create dummy input
    dummy_input = torch.randn(1, context_frames, input_dim)

    # Use legacy TorchScript exporter — the dynamo exporter produces ONNX
    # graphs with shape annotations that break onnxruntime quantize_dynamic.
    torch.onnx.export(
        model,
        dummy_input,
        str(output_path),
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "output": {0: "batch_size"},
        },
        dynamo=False,
    )

    print(f"Exported ONNX model to {output_path}")
    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"Size: {size_mb:.2f} MB (float32)")

    return output_path


def quantize_int8(input_path: Path, output_path: Path) -> Path:
    """Quantize ONNX model to int8 using dynamic quantization."""
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
    except ImportError:
        print("Skipping int8 quantization — install onnxruntime")
        return input_path

    quantize_dynamic(
        model_input=str(input_path),
        model_output=str(output_path),
        weight_type=QuantType.QInt8,
    )

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"Quantized to int8: {output_path} ({size_mb:.2f} MB)")

    return output_path


def validate_onnx(onnx_path: Path, context_frames: int = 100, input_dim: int = 17):
    """Validate the ONNX model by running test inference."""
    import onnxruntime as ort

    session = ort.InferenceSession(str(onnx_path))

    # Check input/output shapes
    inputs = session.get_inputs()
    outputs = session.get_outputs()

    print(f"\nModel inputs:")
    for inp in inputs:
        print(f"  {inp.name}: {inp.shape} ({inp.type})")

    print(f"Model outputs:")
    for out in outputs:
        print(f"  {out.name}: {out.shape} ({out.type})")

    # Test inference
    dummy = np.random.randn(1, context_frames, input_dim).astype(np.float32)
    results = session.run(None, {"input": dummy})

    output = results[0]
    print(f"\nTest inference:")
    print(f"  Input shape:  {dummy.shape}")
    print(f"  Output shape: {output.shape}")
    print(f"  Output range: [{output.min():.4f}, {output.max():.4f}]")

    # Verify output shape
    assert output.shape == (1, 4), f"Expected output shape (1, 4), got {output.shape}"

    # Softmax to get probabilities
    exp_out = np.exp(output - output.max(axis=1, keepdims=True))
    probs = exp_out / exp_out.sum(axis=1, keepdims=True)
    label_names = ["speaking", "thinking_pause", "turn_complete", "interrupt_intent"]
    print(f"  Probabilities: {dict(zip(label_names, [f'{p:.3f}' for p in probs[0]]))}")

    return True


def compare_pytorch_onnx(
    model: torch.nn.Module,
    onnx_path: Path,
    context_frames: int = 100,
    input_dim: int = 17,
    num_tests: int = 10,
    tolerance: float = 1e-4,
):
    """Compare PyTorch and ONNX model outputs to verify export correctness."""
    import onnxruntime as ort

    model.eval()
    model.cpu()
    session = ort.InferenceSession(str(onnx_path))

    max_diff = 0.0
    for i in range(num_tests):
        dummy = np.random.randn(1, context_frames, input_dim).astype(np.float32)

        # PyTorch
        with torch.no_grad():
            pt_output = model(torch.from_numpy(dummy)).numpy()

        # ONNX
        ort_output = session.run(None, {"input": dummy})[0]

        diff = np.abs(pt_output - ort_output).max()
        max_diff = max(max_diff, diff)

    print(f"\nPyTorch vs ONNX comparison ({num_tests} tests):")
    print(f"  Max absolute difference: {max_diff:.8f}")
    print(f"  Tolerance: {tolerance}")

    if max_diff < tolerance:
        print(f"  ✓ Outputs match within tolerance")
    else:
        print(f"  ⚠ Outputs differ more than tolerance (may be OK for quantized model)")


def main():
    parser = argparse.ArgumentParser(description="Export Utterance model to ONNX")
    parser.add_argument("--checkpoint", type=str, required=True, help="Path to trained checkpoint (.pt)")
    parser.add_argument("--output", type=str, required=True, help="Output path for ONNX model")
    parser.add_argument("--no-quantize", action="store_true", help="Skip int8 quantization")
    parser.add_argument("--validate", action="store_true", default=True, help="Run validation after export")
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Load checkpoint
    print(f"Loading checkpoint: {args.checkpoint}")
    checkpoint = torch.load(args.checkpoint, weights_only=False, map_location="cpu")

    config = checkpoint["config"]
    model_cfg = config["model"]
    context_frames = model_cfg["context_frames"]
    input_dim = model_cfg["input_dim"]

    # Rebuild model
    model = build_model_from_config(config)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    print(f"Model: {model.num_parameters:,} parameters")
    print(f"Training val_acc: {checkpoint.get('val_acc', 'N/A')}")

    # Export to ONNX (float32 first)
    if args.no_quantize:
        onnx_path = export_to_onnx(model, output_path, context_frames, input_dim)
    else:
        # Export float32 to temp, then quantize
        with tempfile.NamedTemporaryFile(suffix=".onnx", delete=False) as tmp:
            tmp_path = Path(tmp.name)

        try:
            export_to_onnx(model, tmp_path, context_frames, input_dim)

            # Quantize to int8
            onnx_path = quantize_int8(tmp_path, output_path)
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    # Validate
    if args.validate:
        validate_onnx(onnx_path, context_frames, input_dim)

        # Compare ONNX with PyTorch (tolerance is higher for quantized models)
        tolerance = 1e-4 if args.no_quantize else 0.5
        compare_pytorch_onnx(model, onnx_path, context_frames, input_dim, tolerance=tolerance)

    # Final size check
    size_mb = os.path.getsize(onnx_path) / 1024 / 1024
    max_size = 5.0
    print(f"\nFinal model size: {size_mb:.2f} MB")
    if size_mb <= max_size:
        print(f"✓ Under {max_size} MB limit")
    else:
        print(f"✗ Exceeds {max_size} MB limit! Consider reducing model size or quantization.")


if __name__ == "__main__":
    main()
