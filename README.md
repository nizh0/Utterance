<p align="center">
  <h1 align="center">Utterance</h1>
  <p align="center"><strong>Client-side semantic endpointing. Know when they're done talking.</strong></p>
  <p align="center">
    <a href="https://github.com/nizh0/Utterance">GitHub</a> •
    <a href="https://utterance.dev">Website</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#how-it-works">How It Works</a> •
    <a href="#api">API</a> •
    <a href="#contributing">Contributing</a>
  </p>
</p>

---

## The Problem

Every voice app faces the same annoying problem: **it can't tell when you're done talking.**

You pause to think, and it cuts you off. You take a breath, and it responds too soon. You want to interrupt, and it keeps going.

The current solutions either:

- **Detect silence** (Silero VAD, ricky0123/vad): They know when sound stops, but they can't tell if you're thinking or finished.
- **Use server-side AI** (OpenAI Realtime, AssemblyAI): They are smart, but they add delay, costs, and privacy issues.

**Utterance is different.** It uses a lightweight ML model entirely on the client side. It recognizes the difference between a thinking pause and a completed turn. No cloud. No delay. No per-minute fees.

## Quick Start

```bash
npm install @utterance/core
```

```javascript
import { Utterance } from "@utterance/core";

const detector = new Utterance();

detector.on("turnEnd", (result) => {
  console.log("User is done speaking", result.confidence);
  // Safe to send to your AI / LLM now
});

detector.on("pause", (result) => {
  console.log("User is thinking...", result.duration);
  // Don't interrupt — they're still going
});

detector.on("interrupt", () => {
  console.log("User wants to speak — stop AI response");
  // Halt TTS playback, yield the floor
});

detector.on("speechStart", () => {
  console.log("User started speaking");
});

// Start listening
await detector.start();

// Stop when done
detector.stop();
```

## How It Works

Utterance is **not** a traditional Voice Activity Detector (VAD). VADs distinguish sound from silence. Utterance understands **conversational intent**.

```
Traditional VAD:     Sound → Speaking | Silence → Not Speaking
Utterance:           Sound → Speaking | Silence → Thinking? Done? Wants to interrupt?
```

Under the hood:

1. **Audio capture**: Streams microphone input via the Web Audio API.
2. **Feature extraction**: Extracts MFCCs, pitch contour, energy levels, speech rate, and pause duration in real-time.
3. **Semantic classification**: A lightweight ML model (~3-5MB, ONNX) classifies each audio segment into one of four states:
   - `speaking`: active speech detected
   - `thinking_pause`: silence, but the speaker isn't done yet
   - `turn_complete`: the speaker has finished their thought
   - `interrupt_intent`: the listener wants to take over
4. **Event emission**: Fires events your app can react to instantly.

```
[Mic] → [Audio Stream] → [Feature Extraction] → [Utterance Model] → [Events]
              |                    |                      |
         Client-side          Client-side            Client-side
        (Web Audio)        (Lightweight DSP)      (ONNX Runtime)
```

**Everything runs locally.** No network requests. No API keys. No per-minute costs.

## Key Features

- **Semantic endpointing**: understands thinking pauses vs. turn completion
- **Interrupt detection**: knows when a user wants to interject
- **Confidence scoring**: returns probability (0-1) for each detection
- **Client-side only**: no cloud, no latency, no API costs
- **Lightweight**: model under 5MB, inference under 50ms
- **Framework agnostic**: works with any voice stack
- **Privacy first**: audio never leaves the device

## API

### Constructor

```javascript
const detector = new Utterance(options);
```

| Option           | Type     | Default   | Description                                                    |
| ---------------- | -------- | --------- | -------------------------------------------------------------- |
| `sensitivity`    | `number` | `0.5`     | Detection sensitivity (0-1). Higher = more sensitive to pauses |
| `pauseTolerance` | `number` | `1500`    | Max thinking pause duration in ms before triggering turnEnd    |
| `modelPath`      | `string` | `bundled` | Custom model path (ONNX)                                       |
| `sampleRate`     | `number` | `16000`   | Audio sample rate in Hz                                        |

### Events

| Event         | Payload                    | Description                                    |
| ------------- | -------------------------- | ---------------------------------------------- |
| `speechStart` | `{ timestamp }`            | User started speaking                          |
| `pause`       | `{ duration, confidence }` | Thinking pause detected (user likely not done) |
| `turnEnd`     | `{ confidence, duration }` | User finished speaking (safe to respond)       |
| `interrupt`   | `{ timestamp }`            | User wants to interject (stop AI response)     |

### Methods

| Method          | Description                           |
| --------------- | ------------------------------------- |
| `start()`       | Begin listening (returns Promise)     |
| `stop()`        | Stop listening and release microphone |
| `isListening()` | Returns current listening state       |

## Integrations

Utterance works with your existing voice stack. It handles **when** to act — not **what** to transcribe or say.

### With Whisper (Speech-to-Text)

```javascript
import { Utterance } from "@utterance/core";
import { transcribe } from "./whisper";

const detector = new Utterance();
let audioBuffer = [];

detector.on("speechStart", () => {
  audioBuffer = [];
});

detector.on("turnEnd", async (result) => {
  if (result.confidence > 0.8) {
    const text = await transcribe(audioBuffer);
    // Send to your LLM
  }
});

await detector.start();
```

### With OpenAI Chat

```javascript
detector.on("turnEnd", async (result) => {
  const transcript = await getTranscript();
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: transcript }],
  });
  speak(response.choices[0].message.content);
});

detector.on("interrupt", () => {
  stopSpeaking(); // Halt TTS immediately
});
```

## Comparison

| Feature                     | Silero VAD | ricky0123/vad | Picovoice Cobra | OpenAI Realtime | **Utterance** |
| --------------------------- | ---------- | ------------- | --------------- | --------------- | ------------- |
| Detects speech vs. silence  | ✅         | ✅            | ✅              | ✅              | ✅            |
| Semantic pause detection    | ❌         | ❌            | ❌              | ✅              | ✅            |
| Interrupt detection         | ❌         | ❌            | ❌              | ✅              | ✅            |
| Runs client-side            | ✅         | ✅            | ✅              | ❌              | ✅            |
| No API costs                | ✅         | ✅            | ❌              | ❌              | ✅            |
| Privacy (audio stays local) | ✅         | ✅            | ✅              | ❌              | ✅            |

## Roadmap

- [x] Core event API design
- [ ] Energy-based VAD baseline
- [ ] Feature extraction pipeline (MFCCs, pitch, energy)
- [ ] Training data collection & labeling
- [ ] Model v1 training (small transformer)
- [ ] ONNX export & browser runtime
- [ ] npm package (`@utterance/core`)
- [ ] React hooks (`@utterance/react`)
- [ ] React Native support (`@utterance/react-native`)
- [ ] Multi-language support

## Contributing

We're building Utterance in the open, and contributions are welcome.

### Good First Issues

Check out issues labeled [`good-first-issue`](https://github.com/nizh0/Utterance/issues?q=label%3Agood-first-issue) for beginner-friendly tasks.

### Areas We Need Help

- **ML / Audio**: Model architecture, training pipeline, feature engineering
- **JavaScript / TypeScript**: Browser audio capture, Web Audio API, ONNX runtime integration
- **Documentation**: Guides, tutorials, examples
- **Testing**: Real-world conversation testing, edge cases

### Setup

```bash
git clone https://github.com/nizh0/Utterance.git
cd Utterance
npm install
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines and [CHANGELOG.md](CHANGELOG.md) for what's been shipped.

## Community

- [Discord](https://discord.gg/kb4zMHNtEV): Chat with contributors
- [GitHub Issues](https://github.com/nizh0/Utterance/issues): Bug reports & feature requests
- [Roadmap](https://github.com/nizh0/Utterance/projects): See what's coming

## License

MIT © [Utterance](https://utterance.dev)

---

<p align="center">
  <strong>"Five pharmacies on one road. But this one actually knows when you're done talking."</strong>
</p>
