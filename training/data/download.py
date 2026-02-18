"""
Download conversational speech data for training the Utterance endpointing model.

Uses the Switchboard-1 Release 2 corpus structure. Since Switchboard requires
an LDC license, this script supports multiple data sources:

1. Switchboard (LDC): Real telephone conversations with turn annotations
2. CALLHOME English (LDC): Multi-topic telephone conversations
3. Santa Barbara Corpus of Spoken American English (free): Natural conversations
4. Synthetic fallback: Generate training data from LibriSpeech by simulating
   conversational patterns (turn-taking, pauses, overlaps)

Usage:
    python data/download.py --source synthetic --output data/raw/
    python data/download.py --source switchboard --ldc-path /path/to/LDC97S62
"""

import argparse
import os
import json
import urllib.request
import tarfile
import shutil
from pathlib import Path


def download_librispeech_devclean(output_dir: Path) -> Path:
    """Download LibriSpeech dev-clean for synthetic conversation generation."""
    url = "https://www.openslr.org/resources/12/dev-clean.tar.gz"
    tar_path = output_dir / "dev-clean.tar.gz"
    extract_dir = output_dir / "LibriSpeech"

    if extract_dir.exists() and any(extract_dir.rglob("*.flac")):
        print(f"LibriSpeech dev-clean already exists at {extract_dir}")
        return extract_dir / "dev-clean"

    print(f"Downloading LibriSpeech dev-clean (~350MB)...")
    output_dir.mkdir(parents=True, exist_ok=True)

    def _progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        pct = min(downloaded / total_size * 100, 100) if total_size > 0 else 0
        print(f"\r  {downloaded / 1e6:.1f}/{total_size / 1e6:.1f} MB ({pct:.0f}%)", end="", flush=True)

    urllib.request.urlretrieve(url, tar_path, reporthook=_progress)
    print("\nExtracting...")

    with tarfile.open(tar_path, "r:gz") as tar:
        tar.extractall(path=output_dir)

    tar_path.unlink()
    print(f"Extracted to {extract_dir / 'dev-clean'}")
    return extract_dir / "dev-clean"


def import_switchboard(ldc_path: Path, output_dir: Path) -> Path:
    """
    Import Switchboard from a local LDC distribution.

    Expects the standard LDC97S62 layout:
        ldc_path/
            swb1/
                sw02001.sph  (or .wav)
                ...
            swb_ms98_transcriptions/
                sw02001A-ms98-a-trans.text
                ...
    """
    swb_audio = ldc_path / "swb1"
    swb_trans = ldc_path / "swb_ms98_transcriptions"

    if not swb_audio.exists():
        # Try alternate layout
        swb_audio = ldc_path
        swb_trans = ldc_path / "transcriptions"

    if not swb_audio.exists():
        raise FileNotFoundError(
            f"Cannot find Switchboard audio at {swb_audio}. "
            f"Expected LDC97S62 directory structure."
        )

    dest = output_dir / "switchboard"
    dest.mkdir(parents=True, exist_ok=True)

    # Copy audio files
    audio_dest = dest / "audio"
    audio_dest.mkdir(exist_ok=True)
    audio_files = list(swb_audio.glob("*.sph")) + list(swb_audio.glob("*.wav"))
    print(f"Found {len(audio_files)} Switchboard audio files")

    for f in audio_files:
        shutil.copy2(f, audio_dest / f.name)

    # Copy transcription files
    if swb_trans.exists():
        trans_dest = dest / "transcriptions"
        trans_dest.mkdir(exist_ok=True)
        trans_files = list(swb_trans.rglob("*.text"))
        print(f"Found {len(trans_files)} transcription files")
        for f in trans_files:
            shutil.copy2(f, trans_dest / f.name)

    print(f"Imported Switchboard to {dest}")
    return dest


def generate_synthetic_conversations(librispeech_dir: Path, output_dir: Path, num_conversations: int = 200) -> Path:
    """
    Generate synthetic two-speaker conversations from LibriSpeech utterances.

    Creates realistic conversational patterns:
    - Speaker A talks, pauses, Speaker B responds
    - Thinking pauses (mid-utterance silence)
    - Turn completions (end-of-turn silence)
    - Interrupts (overlapping speech)

    Each conversation is saved as a WAV file with a JSON annotation file.
    """
    try:
        import numpy as np
        import soundfile as sf
        import librosa
    except ImportError as e:
        raise ImportError(f"Missing dependency: {e}. Run: pip install -r requirements.txt")

    dest = output_dir / "synthetic"
    dest.mkdir(parents=True, exist_ok=True)
    audio_dest = dest / "audio"
    audio_dest.mkdir(exist_ok=True)
    annot_dest = dest / "annotations"
    annot_dest.mkdir(exist_ok=True)

    # Collect all utterance files
    flac_files = sorted(librispeech_dir.rglob("*.flac"))
    if not flac_files:
        raise FileNotFoundError(f"No .flac files found in {librispeech_dir}")

    print(f"Found {len(flac_files)} utterances in LibriSpeech")

    # Group by speaker for realistic speaker assignment
    speaker_utterances: dict[str, list[Path]] = {}
    for f in flac_files:
        speaker_id = f.parent.parent.name
        speaker_utterances.setdefault(speaker_id, []).append(f)

    speakers = list(speaker_utterances.keys())
    if len(speakers) < 2:
        raise ValueError("Need at least 2 speakers to simulate conversations")

    rng = np.random.default_rng(42)
    sr = 16000

    manifest = []

    for conv_idx in range(num_conversations):
        # Pick two different speakers
        spk_a, spk_b = rng.choice(speakers, size=2, replace=False)
        utts_a = speaker_utterances[spk_a]
        utts_b = speaker_utterances[spk_b]

        # Pick 2-5 utterances per speaker for this conversation
        n_turns = rng.integers(3, 8)
        picks_a = [utts_a[i % len(utts_a)] for i in rng.integers(0, len(utts_a), size=n_turns)]
        picks_b = [utts_b[i % len(utts_b)] for i in rng.integers(0, len(utts_b), size=n_turns)]

        # Build conversation timeline
        conversation_audio = []
        annotations = []
        current_time = 0.0

        for turn_idx in range(n_turns):
            is_speaker_a = turn_idx % 2 == 0
            utt_path = picks_a[turn_idx] if is_speaker_a else picks_b[turn_idx]
            speaker = "A" if is_speaker_a else "B"

            # Load utterance
            audio, _ = librosa.load(utt_path, sr=sr, mono=True)

            # Decide conversation pattern for this turn
            pattern = rng.choice(
                ["normal", "thinking_pause", "interrupt", "quick_response"],
                p=[0.4, 0.25, 0.15, 0.2],
            )

            if pattern == "thinking_pause" and len(audio) > sr:
                # Insert a thinking pause in the middle of the utterance
                mid = len(audio) // 2
                pause_len = int(rng.uniform(0.3, 1.2) * sr)
                pause = np.zeros(pause_len, dtype=np.float32)

                part1 = audio[:mid]
                part2 = audio[mid:]

                # Part 1: speaking
                annotations.append({
                    "start": current_time,
                    "end": current_time + len(part1) / sr,
                    "label": "speaking",
                    "speaker": speaker,
                })
                conversation_audio.append(part1)
                current_time += len(part1) / sr

                # Thinking pause
                annotations.append({
                    "start": current_time,
                    "end": current_time + pause_len / sr,
                    "label": "thinking_pause",
                    "speaker": speaker,
                })
                conversation_audio.append(pause)
                current_time += pause_len / sr

                # Part 2: speaking (resume)
                annotations.append({
                    "start": current_time,
                    "end": current_time + len(part2) / sr,
                    "label": "speaking",
                    "speaker": speaker,
                })
                conversation_audio.append(part2)
                current_time += len(part2) / sr

            elif pattern == "interrupt" and turn_idx > 0 and len(conversation_audio) > 0:
                # Overlap: start this speaker's audio slightly before the previous ends
                overlap_dur = min(rng.uniform(0.2, 0.6), 0.5)
                overlap_samples = int(overlap_dur * sr)

                # Back up the timeline slightly
                annotations.append({
                    "start": current_time - overlap_dur,
                    "end": current_time - overlap_dur + len(audio) / sr,
                    "label": "interrupt_intent",
                    "speaker": speaker,
                })

                # Mix overlap region into existing audio
                if overlap_samples > 0 and len(conversation_audio) > 0:
                    last_chunk = conversation_audio[-1]
                    if len(last_chunk) >= overlap_samples:
                        mix_region = audio[:overlap_samples] * 0.7
                        last_chunk[-overlap_samples:] += mix_region[:len(last_chunk[-overlap_samples:])]
                        conversation_audio[-1] = last_chunk
                        remaining = audio[overlap_samples:]
                    else:
                        remaining = audio

                    conversation_audio.append(remaining)
                    current_time += len(remaining) / sr
                else:
                    conversation_audio.append(audio)
                    current_time += len(audio) / sr
            else:
                # Normal turn or quick response
                annotations.append({
                    "start": current_time,
                    "end": current_time + len(audio) / sr,
                    "label": "speaking",
                    "speaker": speaker,
                })
                conversation_audio.append(audio)
                current_time += len(audio) / sr

            # Add inter-turn silence (turn completion gap)
            if turn_idx < n_turns - 1:
                if pattern == "quick_response":
                    gap_dur = rng.uniform(0.1, 0.4)
                elif pattern == "interrupt":
                    gap_dur = 0.0  # no gap for interrupts
                else:
                    gap_dur = rng.uniform(0.5, 2.0)

                if gap_dur > 0:
                    gap = np.zeros(int(gap_dur * sr), dtype=np.float32)
                    annotations.append({
                        "start": current_time,
                        "end": current_time + gap_dur,
                        "label": "turn_complete",
                        "speaker": speaker,
                    })
                    conversation_audio.append(gap)
                    current_time += gap_dur

        # Concatenate and save
        if not conversation_audio:
            continue

        full_audio = np.concatenate(conversation_audio)

        # Normalize
        peak = np.abs(full_audio).max()
        if peak > 0:
            full_audio = full_audio / peak * 0.9

        conv_id = f"conv_{conv_idx:04d}"
        sf.write(str(audio_dest / f"{conv_id}.wav"), full_audio, sr)

        with open(annot_dest / f"{conv_id}.json", "w") as f:
            json.dump({
                "id": conv_id,
                "duration": current_time,
                "sample_rate": sr,
                "speakers": {"A": spk_a, "B": spk_b},
                "annotations": annotations,
            }, f, indent=2)

        manifest.append({
            "id": conv_id,
            "audio": f"audio/{conv_id}.wav",
            "annotations": f"annotations/{conv_id}.json",
            "duration": current_time,
        })

        if (conv_idx + 1) % 20 == 0:
            print(f"  Generated {conv_idx + 1}/{num_conversations} conversations")

    # Write manifest
    with open(dest / "manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)

    total_dur = sum(m["duration"] for m in manifest)
    print(f"\nGenerated {len(manifest)} conversations ({total_dur / 3600:.1f} hours)")
    print(f"Output: {dest}")
    return dest


def main():
    parser = argparse.ArgumentParser(description="Download/prepare training data for Utterance model")
    parser.add_argument(
        "--source",
        type=str,
        choices=["switchboard", "synthetic"],
        default="synthetic",
        help="Data source: 'switchboard' (requires LDC), 'synthetic' (generates from LibriSpeech)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/raw",
        help="Output directory for raw data",
    )
    parser.add_argument(
        "--ldc-path",
        type=str,
        default=None,
        help="Path to LDC Switchboard distribution (required for --source switchboard)",
    )
    parser.add_argument(
        "--num-conversations",
        type=int,
        default=200,
        help="Number of synthetic conversations to generate (for --source synthetic)",
    )
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.source == "switchboard":
        if not args.ldc_path:
            parser.error("--ldc-path is required when using --source switchboard")
        import_switchboard(Path(args.ldc_path), output_dir)

    elif args.source == "synthetic":
        print("Using synthetic conversation generation (LibriSpeech base)")
        print("For best results, use real conversational data (--source switchboard)")
        print()
        librispeech_dir = download_librispeech_devcean(output_dir)
        generate_synthetic_conversations(librispeech_dir, output_dir, args.num_conversations)


def download_librispeech_devcean(output_dir: Path) -> Path:
    """Alias that delegates to the real function (typo-proof)."""
    return download_librispeech_devclean(output_dir)


if __name__ == "__main__":
    main()
