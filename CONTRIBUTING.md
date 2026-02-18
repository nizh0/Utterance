# Contributing to Utterance

Thank you for your interest in contributing to Utterance! We're creating the first client-side semantic endpointing SDK, and we need assistance from people like you.

Whether you are interested in ML, audio processing, JavaScript/TypeScript, or just want to help with documentation, there is a place for you here.

## How to Contribute

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/Utterance.git
cd Utterance
npm install
```

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

Use a descriptive branch name:

- `feature/mfcc-extraction` for a new feature
- `fix/pause-detection-threshold` for a bug fix
- `docs/api-examples` for documentation
- `model/lstm-architecture` for model work

### 3. Make Your Changes

Write clean and easy-to-read code. Add comments where the logic isn't clear. If you are adding a feature, include a test or example.

### 4. Test

```bash
npm run test         # run unit tests
npm run lint         # check code style
npm run typecheck    # check TypeScript types
npm run build        # build ESM + CJS + types into dist/
```

Ensure everything passes before submitting.

### 5. Test in the Browser

To test your changes in a real browser with microphone access:

```bash
npm run build
npx serve .
```

Then open **http://localhost:3000/examples/basic/** in your browser. The demo provides a live event log so you can see `speechStart`, `pause`, `turnEnd`, and `interrupt` events as they fire.

For active development, run these in separate terminal tabs:

```bash
npm run dev          # rebuilds on every file save
npm run test:watch   # re-runs tests on every file save
npx serve .          # serves the project locally
```

This gives you a full dev loop: edit code, see tests re-run automatically, and refresh the browser to test.

### 6. Submit a Pull Request

Push your branch and open a pull request against `main`. In your PR description:

- Describe what you changed and why
- Link any related issues
- Include a screenshot or recording if it involves UI or audio changes
- Update [CHANGELOG.md](CHANGELOG.md) under the `[Unreleased]` section

We review pull requests within 48 hours.

## Where to Start

### Good First Issues

Look for issues labeled [`good-first-issue`](https://github.com/nizh0/Utterance/issues?q=label%3Agood-first-issue). These are manageable tasks that don't require deep knowledge of the codebase.

### Areas We Need Help

**ML & Audio (high priority)**

- Collecting and labeling training data
- Building the feature extraction pipeline (MFCCs, pitch, energy, speech rate)
- Experimenting with model architectures (transformer, LSTM, CNN+GRU)
- Exporting and quantizing to ONNX
- Testing model accuracy in real conversations

**JavaScript / TypeScript**

- Integrating the Web Audio API
- Integrating ONNX Runtime Web
- Designing the event system and API
- Testing browser compatibility
- Creating the React hooks package (`@utterance/react`)
- Building React Native support (`@utterance/react-native`)

**Documentation**

- Improving the API reference
- Creating integration guides (Whisper, OpenAI)
- Writing blog posts and tutorials
- Documenting architecture decisions

**Testing**

- Writing unit tests for feature extraction
- Writing integration tests for the detection pipeline
- Testing real-world conversations
- Exploring edge cases (background noise, multiple speakers, accents)

## Project Structure

```
Utterance/
├── src/
│   ├── audio/          # Audio capture and preprocessing
│   ├── features/       # Feature extraction (MFCCs, energy, pitch)
│   ├── model/          # Model loading and inference
│   ├── detector/       # Turn detection logic and event emission
│   └── index.ts        # Main entry point
├── models/
│   └── utterance-v1.onnx
├── training/
│   ├── data/           # Training data scripts
│   ├── features/       # Feature engineering
│   ├── train.py        # Model training
│   └── export.py       # ONNX export
├── examples/
│   ├── basic/
│   ├── with-whisper/
│   └── with-openai/
├── tests/
├── docs/
├── package.json
├── README.md
├── CONTRIBUTING.md
└── CHANGELOG.md
```

## Code Style

**JavaScript / TypeScript**

- Use TypeScript for all new code
- Use ESLint and Prettier (config included in the repository)
- Prefer `const` over `let` and avoid `var`
- Use async/await instead of raw promises
- Use camelCase for event names: `turnEnd`, `speechStart`

**General**

- Keep functions small and focused
- Use descriptive variable names
- Comment on the "why" instead of the "what"
- Avoid console.log in production code and use the internal logger

## Working on the Model

If you are contributing to the ML side, here's what you should know:

**Training data** can be found in `training/data/`. We use labeled conversational audio with four classes:

- `speaking` for active speech
- `thinking_pause` for mid-thought silence
- `turn_complete` for when a speaker is done
- `interrupt_intent` for when a listener wants to interject

**To train locally:**

```bash
cd training
pip install -r requirements.txt
python train.py --config configs/transformer_small.yaml
```

**To export to ONNX:**

```bash
python export.py --checkpoint checkpoints/best.pt --output models/utterance-v1.onnx
```

When submitting model changes, include:

- The training config used
- Accuracy metrics on the test set
- Model size (must remain under 5MB)
- Inference time benchmarks

## Updating the Changelog

We maintain a [CHANGELOG.md](CHANGELOG.md) following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Every pull request that changes user-facing behavior should include an update to the changelog.

Add your entry under the `[Unreleased]` section using one of these categories:

- **Added** for new features
- **Changed** for changes to existing functionality
- **Fixed** for bug fixes
- **Removed** for features that were removed

Keep entries short and written from the user's perspective. For example:

```
### Added
- Pitch detection using YIN autocorrelation algorithm
```

## Reporting Bugs

Open an issue with:

- Your expected outcome
- What actually happened
- Your browser and OS version
- Your audio setup (microphone, sample rate)
- Steps to reproduce the issue

## Suggesting Features

Open an issue with the `feature-request` label. Describe:

- The problem you want to solve
- Your proposed solution
- Any alternatives you considered

## Community Guidelines

- Be respectful and constructive
- Assume good intentions
- Help newcomers feel welcome
- Focus on the problem, not the person
- Credit others for their work

## Recognition

All contributors are acknowledged in our releases. Significant contributions earn a spot in the README contributors section.

## Questions?

- [Discord](https://discord.gg/kb4zMHNtEV) is the fastest way to get help
- [GitHub Issues](https://github.com/nizh0/Utterance/issues) is for reporting bugs and requesting features

Thank you for helping make voice interfaces truly understand humans.
