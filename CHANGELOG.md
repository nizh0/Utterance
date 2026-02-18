# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project scaffolding with TypeScript, ESLint, Prettier, and Vitest
- Core `Utterance` class with event-driven API (`speechStart`, `pause`, `turnEnd`, `interrupt`)
- `TurnDetector` state machine for turn-taking logic
- `AudioCapture` module using the Web Audio API
- `FeatureExtractor` with energy computation and stubs for MFCCs, pitch, and speech rate
- `ONNXModel` module with stub for ONNX Runtime Web inference
- `EnergyVAD` baseline classifier using RMS energy thresholds as fallback when no ONNX model is loaded
- Shared type definitions in `src/types.ts`
- Training pipeline scaffolding (`train.py`, `export.py`, transformer config)
- Next.js frontend with home page, live demo, and documentation site
- Fumadocs-powered documentation with MDX content (introduction, quick start, how it works, API reference, integrations, contributing)
- Live demo page at `/demo` with real-time event log (React port of the basic example)
- `npm run build` produces both SDK (ESM + CJS + types) and Next.js static site
- `npm start` runs SDK watcher, Next.js dev server, and tests in parallel
- 11 passing tests for the detector and feature extractor
- CONTRIBUTING.md with development workflow and contribution areas
- CHANGELOG.md
