"""
Hybrid Conv + Attention model for semantic endpointing.

Architecture:
    Input: (batch, 100, 17) — 1 second of 17-dim features at 10ms hop
    → 3x 1D Conv blocks (local temporal patterns)
    → 1x Multi-head Self-Attention (longer-range context)
    → Global Average Pooling
    → Linear classification head
    Output: (batch, 4) — logits for [speaking, thinking_pause, turn_complete, interrupt_intent]

Designed for:
    - <5MB ONNX (int8 quantized)
    - <100ms inference in WASM on mobile browsers
    - ONNX export with fixed sequence length (100 frames)
"""

import math

import torch
import torch.nn as nn
import yaml


class ConvBlock(nn.Module):
    """1D convolution block: Conv1d → BatchNorm → ReLU → Dropout."""

    def __init__(self, in_channels: int, out_channels: int, kernel_size: int, dropout: float = 0.1):
        super().__init__()
        padding = kernel_size // 2  # same padding
        self.conv = nn.Conv1d(in_channels, out_channels, kernel_size, padding=padding)
        self.bn = nn.BatchNorm1d(out_channels)
        self.relu = nn.ReLU(inplace=True)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, channels, seq_len)
        x = self.conv(x)
        x = self.bn(x)
        x = self.relu(x)
        x = self.dropout(x)
        return x


class PositionalEncoding(nn.Module):
    """Sinusoidal positional encoding for the attention layer."""

    def __init__(self, d_model: int, max_len: int = 200):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        if d_model > 1:
            pe[:, 1::2] = torch.cos(position * div_term[:d_model // 2])
        self.register_buffer("pe", pe.unsqueeze(0))  # (1, max_len, d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq_len, d_model)
        return x + self.pe[:, :x.size(1)]


class HybridEndpointModel(nn.Module):
    """
    Hybrid Conv + Attention model for turn-taking classification.

    Combines:
    1. 1D conv blocks for efficient local pattern extraction (speech onset,
       silence boundaries, energy transitions)
    2. Multi-head self-attention for temporal context (distinguishing
       brief thinking pauses from completed turns)
    """

    def __init__(
        self,
        input_dim: int = 17,
        conv_channels: list[int] | None = None,
        conv_kernel_sizes: list[int] | None = None,
        attention_dim: int = 64,
        num_heads: int = 4,
        num_layers: int = 1,
        num_classes: int = 4,
        conv_dropout: float = 0.1,
        attention_dropout: float = 0.1,
        head_dropout: float = 0.2,
    ):
        super().__init__()

        if conv_channels is None:
            conv_channels = [32, 64, 64]
        if conv_kernel_sizes is None:
            conv_kernel_sizes = [5, 3, 3]

        assert len(conv_channels) == len(conv_kernel_sizes), "conv_channels and conv_kernel_sizes must match"

        # Conv blocks: process (batch, input_dim, seq_len)
        conv_layers = []
        in_ch = input_dim
        for out_ch, ks in zip(conv_channels, conv_kernel_sizes):
            conv_layers.append(ConvBlock(in_ch, out_ch, ks, conv_dropout))
            in_ch = out_ch
        self.conv_blocks = nn.Sequential(*conv_layers)

        # Project conv output to attention dim if needed
        self.conv_to_attn = nn.Linear(conv_channels[-1], attention_dim) if conv_channels[-1] != attention_dim else nn.Identity()

        # Positional encoding
        self.pos_enc = PositionalEncoding(attention_dim)

        # Single multi-head self-attention layer
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=attention_dim,
            nhead=num_heads,
            dim_feedforward=attention_dim * 4,
            dropout=attention_dropout,
            batch_first=True,
            activation="relu",
        )
        self.attention = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

        # Classification head
        self.head = nn.Sequential(
            nn.Dropout(head_dropout),
            nn.Linear(attention_dim, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.

        Args:
            x: (batch, seq_len, input_dim) — e.g., (B, 100, 17)

        Returns:
            logits: (batch, num_classes) — e.g., (B, 4)
        """
        # Conv expects (batch, channels, seq_len)
        x = x.transpose(1, 2)  # (B, 17, 100)

        # Conv blocks
        x = self.conv_blocks(x)  # (B, 64, 100)

        # Back to (batch, seq_len, channels) for attention
        x = x.transpose(1, 2)  # (B, 100, 64)

        # Project to attention dim
        x = self.conv_to_attn(x)  # (B, 100, 64)

        # Add positional encoding
        x = self.pos_enc(x)

        # Self-attention
        x = self.attention(x)  # (B, 100, 64)

        # Global average pooling over temporal dimension
        x = x.mean(dim=1)  # (B, 64)

        # Classification
        logits = self.head(x)  # (B, 4)

        return logits

    @property
    def num_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters())

    @property
    def num_trainable_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


def build_model_from_config(config: dict) -> HybridEndpointModel:
    """Build model from a YAML config dictionary."""
    model_cfg = config["model"]
    conv_cfg = model_cfg.get("conv", {})
    attn_cfg = model_cfg.get("attention", {})
    head_cfg = model_cfg.get("head", {})

    model = HybridEndpointModel(
        input_dim=model_cfg["input_dim"],
        conv_channels=conv_cfg.get("channels", [32, 64, 64]),
        conv_kernel_sizes=conv_cfg.get("kernel_sizes", [5, 3, 3]),
        attention_dim=attn_cfg.get("hidden_dim", 64),
        num_heads=attn_cfg.get("num_heads", 4),
        num_layers=attn_cfg.get("num_layers", 1),
        num_classes=model_cfg["num_classes"],
        conv_dropout=conv_cfg.get("dropout", 0.1),
        attention_dropout=attn_cfg.get("dropout", 0.1),
        head_dropout=head_cfg.get("dropout", 0.2),
    )

    return model


def load_config(config_path: str) -> dict:
    with open(config_path) as f:
        return yaml.safe_load(f)


if __name__ == "__main__":
    # Quick sanity check
    config = load_config("configs/hybrid_v1.yaml")
    model = build_model_from_config(config)

    print(f"Model: HybridEndpointModel")
    print(f"Parameters: {model.num_parameters:,} ({model.num_trainable_parameters:,} trainable)")

    # Test forward pass
    batch = torch.randn(4, 100, 17)
    logits = model(batch)
    print(f"Input shape:  {batch.shape}")
    print(f"Output shape: {logits.shape}")
    print(f"Output: {torch.softmax(logits[0], dim=0).detach().numpy()}")

    # Estimate ONNX size (rough: 4 bytes per param for float32, ~1 byte for int8)
    size_f32 = model.num_parameters * 4 / 1024 / 1024
    size_int8 = model.num_parameters * 1 / 1024 / 1024
    print(f"\nEstimated ONNX size: {size_f32:.2f} MB (float32), {size_int8:.2f} MB (int8)")
