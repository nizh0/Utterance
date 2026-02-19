"""
Training script for the Utterance semantic endpointing model.

Usage:
    python train.py --config configs/hybrid_v1.yaml --data data/features/ --output checkpoints/

Trains the hybrid conv+attention model on windowed feature data.
Uses stratified train/val split, class-weighted cross-entropy,
AdamW optimizer with cosine LR schedule and early stopping.
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
import yaml

from model import build_model_from_config


class FeatureDataset(Dataset):
    """Dataset of pre-extracted feature windows with labels."""

    def __init__(self, features: np.ndarray, labels: np.ndarray):
        self.features = torch.from_numpy(features).float()
        self.labels = torch.from_numpy(labels).long()

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.features[idx], self.labels[idx]


def load_feature_data(data_dir: Path) -> tuple[np.ndarray, np.ndarray]:
    """Load all feature .npz files from the data directory."""
    index_path = data_dir / "index.json"
    if not index_path.exists():
        raise FileNotFoundError(f"No index.json at {index_path}. Run features/extract.py first.")

    with open(index_path) as f:
        index = json.load(f)

    all_features = []
    all_labels = []

    for npz_path in index["files"]:
        data = np.load(npz_path)
        all_features.append(data["features"])
        all_labels.append(data["labels"])

    features = np.concatenate(all_features, axis=0)
    labels = np.concatenate(all_labels, axis=0)

    return features, labels


def stratified_split(
    features: np.ndarray,
    labels: np.ndarray,
    train_ratio: float = 0.8,
    seed: int = 42,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Stratified train/val split preserving class distribution."""
    from sklearn.model_selection import train_test_split

    train_feat, val_feat, train_labels, val_labels = train_test_split(
        features, labels,
        train_size=train_ratio,
        stratify=labels,
        random_state=seed,
    )

    return train_feat, val_feat, train_labels, val_labels


def compute_class_weights(labels: np.ndarray, num_classes: int = 4, smoothing: float = 0.5) -> torch.Tensor:
    """Compute smoothed inverse-frequency class weights for imbalanced labels.

    Uses sqrt-smoothing to avoid over-correcting on extremely imbalanced data.
    With smoothing=0.5, this takes the square root of inverse frequency,
    which gives moderate correction without crushing the dominant class.
    """
    counts = np.bincount(labels, minlength=num_classes).astype(np.float64)
    counts = np.maximum(counts, 1)  # avoid division by zero
    freqs = counts / counts.sum()
    weights = (1.0 / freqs) ** smoothing  # sqrt-smoothed inverse frequency
    weights = weights / weights.sum() * num_classes  # normalize so weights sum to num_classes
    return torch.from_numpy(weights).float()


def create_weighted_sampler(labels: np.ndarray, num_classes: int = 4) -> WeightedRandomSampler:
    """Create a weighted random sampler for balanced batches."""
    class_weights = compute_class_weights(labels, num_classes)
    sample_weights = class_weights[labels]
    return WeightedRandomSampler(sample_weights, len(sample_weights), replacement=True)


def train_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
) -> tuple[float, float]:
    """Train for one epoch. Returns (loss, accuracy)."""
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    for features, labels in loader:
        features = features.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        logits = model(features)
        loss = criterion(logits, labels)
        loss.backward()

        # Gradient clipping
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

        optimizer.step()

        total_loss += loss.item() * labels.size(0)
        preds = logits.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    return total_loss / total, correct / total


@torch.no_grad()
def validate(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
    num_classes: int = 4,
) -> tuple[float, float, np.ndarray]:
    """Validate model. Returns (loss, accuracy, confusion_matrix)."""
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    confusion = np.zeros((num_classes, num_classes), dtype=np.int64)

    for features, labels in loader:
        features = features.to(device)
        labels = labels.to(device)

        logits = model(features)
        loss = criterion(logits, labels)

        total_loss += loss.item() * labels.size(0)
        preds = logits.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

        for t, p in zip(labels.cpu().numpy(), preds.cpu().numpy()):
            confusion[t][p] += 1

    return total_loss / total, correct / total, confusion


def print_confusion_matrix(confusion: np.ndarray, label_names: list[str]):
    """Pretty-print a confusion matrix."""
    print("\nConfusion Matrix (rows=true, cols=predicted):")
    header = "".ljust(20) + "".join(f"{n:>15s}" for n in label_names)
    print(header)
    print("-" * len(header))
    for i, name in enumerate(label_names):
        row = name.ljust(20) + "".join(f"{confusion[i][j]:>15d}" for j in range(len(label_names)))
        print(row)

    # Per-class metrics
    print("\nPer-class metrics:")
    for i, name in enumerate(label_names):
        tp = confusion[i][i]
        fn = confusion[i].sum() - tp
        fp = confusion[:, i].sum() - tp
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        accuracy = tp / confusion[i].sum() if confusion[i].sum() > 0 else 0
        print(f"  {name:20s}: acc={accuracy:.3f}  prec={precision:.3f}  recall={recall:.3f}  f1={f1:.3f}")


def main():
    parser = argparse.ArgumentParser(description="Train the Utterance endpointing model")
    parser.add_argument("--config", type=str, default="configs/hybrid_v1.yaml", help="Training config YAML")
    parser.add_argument("--data", type=str, default="data/features", help="Path to feature data directory")
    parser.add_argument("--output", type=str, default="checkpoints", help="Output directory for checkpoints")
    parser.add_argument("--device", type=str, default="auto", help="Device: cpu, cuda, mps, or auto")
    args = parser.parse_args()

    # Load config
    with open(args.config) as f:
        config = yaml.safe_load(f)

    train_cfg = config["training"]
    label_names = config["labels"]
    num_classes = config["model"]["num_classes"]

    # Device selection
    if args.device == "auto":
        if torch.cuda.is_available():
            device = torch.device("cuda")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = torch.device("mps")
        else:
            device = torch.device("cpu")
    else:
        device = torch.device(args.device)
    print(f"Using device: {device}")

    # Load data
    data_dir = Path(args.data)
    print(f"Loading features from {data_dir}...")
    features, labels = load_feature_data(data_dir)
    print(f"Loaded {len(labels)} windows, shape: {features.shape}")

    # Print label distribution
    for i, name in enumerate(label_names):
        count = (labels == i).sum()
        print(f"  {name}: {count} ({count / len(labels) * 100:.1f}%)")

    # Split
    train_feat, val_feat, train_labels, val_labels = stratified_split(
        features, labels,
        train_ratio=train_cfg.get("train_split", config["data"]["train_split"]),
    )
    print(f"\nTrain: {len(train_labels)} | Val: {len(val_labels)}")

    # Datasets and loaders
    train_ds = FeatureDataset(train_feat, train_labels)
    val_ds = FeatureDataset(val_feat, val_labels)

    # Shuffle training data (class weighting is handled in the loss function)
    train_loader = DataLoader(
        train_ds,
        batch_size=train_cfg["batch_size"],
        shuffle=True,
        num_workers=0,
        pin_memory=device.type != "cpu",
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=train_cfg["batch_size"],
        shuffle=False,
        num_workers=0,
        pin_memory=device.type != "cpu",
    )

    # Build model
    model = build_model_from_config(config).to(device)
    print(f"\nModel: {model.num_parameters:,} parameters")

    # Loss with class weights
    class_weights = compute_class_weights(train_labels, num_classes).to(device)
    print(f"Class weights: {dict(zip(label_names, [f'{w:.3f}' for w in class_weights.cpu().numpy()]))}")
    label_smoothing = train_cfg.get("label_smoothing", 0.0)
    criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=label_smoothing)
    if label_smoothing > 0:
        print(f"Label smoothing: {label_smoothing}")

    # Optimizer
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=train_cfg["learning_rate"],
        weight_decay=train_cfg.get("weight_decay", 0.01),
    )

    # Scheduler: cosine with warmup
    warmup_epochs = train_cfg.get("warmup_epochs", 3)
    total_epochs = train_cfg["epochs"]

    def lr_lambda(epoch):
        if epoch < warmup_epochs:
            return (epoch + 1) / warmup_epochs
        progress = (epoch - warmup_epochs) / max(total_epochs - warmup_epochs, 1)
        return 0.5 * (1 + math.cos(math.pi * progress))

    import math
    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)

    # Training loop
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    best_val_acc = 0.0
    patience = train_cfg["early_stopping_patience"]
    patience_counter = 0

    print(f"\nTraining for up to {total_epochs} epochs (early stopping patience={patience})")
    print("=" * 80)

    for epoch in range(total_epochs):
        t0 = time.time()

        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, confusion = validate(model, val_loader, criterion, device, num_classes)
        scheduler.step()

        elapsed = time.time() - t0
        lr = optimizer.param_groups[0]["lr"]

        print(
            f"Epoch {epoch + 1:3d}/{total_epochs} | "
            f"train_loss={train_loss:.4f} train_acc={train_acc:.4f} | "
            f"val_loss={val_loss:.4f} val_acc={val_acc:.4f} | "
            f"lr={lr:.6f} | {elapsed:.1f}s"
        )

        # Check improvement
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            patience_counter = 0

            # Save best checkpoint
            checkpoint = {
                "epoch": epoch + 1,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_acc": val_acc,
                "val_loss": val_loss,
                "config": config,
            }
            torch.save(checkpoint, output_dir / "best.pt")
            print(f"  ↑ New best! Saved to {output_dir / 'best.pt'}")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"\nEarly stopping after {epoch + 1} epochs (no improvement for {patience} epochs)")
                break

    # Final evaluation
    print("\n" + "=" * 80)
    print(f"Best validation accuracy: {best_val_acc:.4f}")

    # Load best model and show final confusion matrix
    checkpoint = torch.load(output_dir / "best.pt", weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    _, _, confusion = validate(model, val_loader, criterion, device, num_classes)
    print_confusion_matrix(confusion, label_names)

    # Check against target
    target = config.get("evaluation", {}).get("target_accuracy", 0.85)
    per_class_acc = [confusion[i][i] / confusion[i].sum() if confusion[i].sum() > 0 else 0 for i in range(num_classes)]
    min_class_acc = min(per_class_acc)

    print(f"\nTarget: {target:.0%} per-class accuracy")
    print(f"Worst class: {label_names[per_class_acc.index(min_class_acc)]} at {min_class_acc:.1%}")

    if min_class_acc >= target:
        print("✓ All classes meet the target accuracy!")
    else:
        print("✗ Some classes are below target. Consider:")
        print("  - More training data (especially for underperforming classes)")
        print("  - Adjusting class weights")
        print("  - Data augmentation")
        print("  - Increasing model capacity")


if __name__ == "__main__":
    main()
