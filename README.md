<p align="center">
  <h1 align="center">Utterance</h1>
  <p align="center"><strong>Client-side semantic endpointing. Know when they're done talking.</strong></p>
  <p align="center">
    <a href="https://utterance.dev">Documentation</a> •
    <a href="https://utterance.dev/demo">Live Demo</a> •
    <a href="https://discord.gg/kb4zMHNtEV">Discord</a> •
    <a href="https://github.com/nizh0/Utterance">GitHub</a>
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
});

detector.on("pause", (result) => {
  console.log("User is thinking...", result.duration);
});

detector.on("interrupt", () => {
  console.log("User wants to speak — stop AI response");
});

await detector.start();
```

See the [full documentation](https://utterance.dev/docs/quick-start) for detailed usage, API reference, and integration examples.

## Comparison

| Feature | Silero VAD | ricky0123/vad | Picovoice Cobra | OpenAI Realtime | **Utterance** |
| --- | --- | --- | --- | --- | --- |
| Detects speech vs. silence | Yes | Yes | Yes | Yes | Yes |
| Semantic pause detection | No | No | No | Yes | Yes |
| Interrupt detection | No | No | No | Yes | Yes |
| Runs client-side | Yes | Yes | Yes | No | Yes |
| No API costs | Yes | Yes | No | No | Yes |
| Privacy (audio stays local) | Yes | Yes | Yes | No | Yes |

## Contributing

We're building Utterance in the open, and contributions are welcome.

```bash
git clone https://github.com/nizh0/Utterance.git
cd Utterance
npm install
npm start
```

See the [contributing guide](https://utterance.dev/docs/contributing) for development workflow, project structure, and areas where we need help.

## Community

- [Discord](https://discord.gg/kb4zMHNtEV): Chat with contributors
- [GitHub Issues](https://github.com/nizh0/Utterance/issues): Bug reports & feature requests

## License

MIT © [Utterance](https://utterance.dev)

---

<p align="center">
  <strong>"Five pharmacies on one road. But this one actually knows when you're done talking."</strong>
</p>
