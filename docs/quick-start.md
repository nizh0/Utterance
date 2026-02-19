# Quick Start

Get Utterance running in under 2 minutes. No backend, no API keys, no configuration required.

## Install

```bash
npm install @utterance/core onnxruntime-web
```

`onnxruntime-web` is a peer dependency that runs the ML model in the browser via WebAssembly.

## Basic Usage

```javascript
import { Utterance } from "@utterance/core";

const detector = new Utterance();

detector.on("speechStart", (e) => {
  console.log("User started speaking");
});

detector.on("pause", (e) => {
  console.log("User is thinking...", e.confidence);
});

detector.on("turnEnd", (e) => {
  console.log("User is done speaking", e.confidence, e.duration);
  // Safe to send to your AI, TTS, or assistant
});

detector.on("interrupt", (e) => {
  console.log("User wants to interrupt", e.confidence);
  // Stop AI playback, cut TTS, etc.
});

await detector.start(); // Requests microphone permission
```

That's it. No model downloads to manage, no thresholds to tune. The ONNX model loads automatically from CDN (~360 KB) and all signal processing runs locally in the browser.

## Stop Listening

```javascript
detector.stop();
```

This releases the microphone and all internal resources.

## Events

Utterance emits four events:

| Event | Payload | When it fires |
|-------|---------|---------------|
| `speechStart` | `{ timestamp }` | User begins speaking |
| `pause` | `{ duration, confidence }` | User pauses (thinking) |
| `turnEnd` | `{ confidence, duration }` | User finished their turn |
| `interrupt` | `{ timestamp, confidence }` | User wants to interrupt |

### `turnEnd` vs `pause`

This is what makes Utterance different from VAD (Voice Activity Detection):

- **`pause`** fires when the user stops talking but is likely still thinking. Don't respond yet.
- **`turnEnd`** fires when the user is actually done with their turn. Now respond.

A `pause` that lasts longer than `pauseTolerance` (default: 1500ms) automatically becomes a `turnEnd`.

### `interrupt`

Fires when the user starts talking while your AI is responding. Use this to stop TTS playback or cancel an in-progress response. Requires sustained speech energy to avoid false triggers.

## Configuration

All options are optional. Defaults work well for most use cases.

```javascript
const detector = new Utterance({
  sensitivity: 0.5,      // 0-1, higher = more sensitive to pauses (default: 0.5)
  pauseTolerance: 1500,  // ms before a pause becomes turnEnd (default: 1500)
  modelPath: "cdn",      // "cdn" | "bundled" | custom URL (default: "cdn")
  sampleRate: 16000,     // Audio sample rate in Hz (default: 16000)
});
```

### `sensitivity`

Controls how confident the model needs to be before firing events. Lower values (e.g., 0.3) require higher confidence and produce fewer but more accurate events. Higher values (e.g., 0.7) are more trigger-happy.

### `pauseTolerance`

How long to wait (in milliseconds) during a detected pause before converting it to a `turnEnd`. Increase this for use cases where users think for longer (e.g., coding assistants). Decrease for fast-paced conversation (e.g., customer support bots).

### `modelPath`

Where to load the ONNX model from:

- `"cdn"` (default): Loads from Utterance's CDN. Zero config, works everywhere.
- `"bundled"`: Loads from the npm package. Use this for offline apps or if you can't reach the CDN.
- Custom URL: Point to your own hosted model file.

## Framework Examples

### React

```jsx
import { useEffect, useRef } from "react";
import { Utterance } from "@utterance/core";

function VoiceChat() {
  const detectorRef = useRef(null);

  useEffect(() => {
    const detector = new Utterance();

    detector.on("turnEnd", (e) => {
      // Send to your AI backend
      console.log("Turn complete:", e.confidence);
    });

    detector.on("interrupt", () => {
      // Stop AI response
    });

    detector.start();
    detectorRef.current = detector;

    return () => detector.stop();
  }, []);

  return <div>Listening...</div>;
}
```

### Vanilla JS

```html
<script type="module">
  import { Utterance } from "https://esm.sh/@utterance/core";

  const detector = new Utterance();

  detector.on("speechStart", () => {
    document.getElementById("status").textContent = "Speaking...";
  });

  detector.on("turnEnd", () => {
    document.getElementById("status").textContent = "Done. Processing...";
  });

  document.getElementById("start").onclick = () => detector.start();
  document.getElementById("stop").onclick = () => detector.stop();
</script>
```

## How It Works

Utterance runs a small ONNX neural network (~360 KB) entirely in the browser:

1. **Audio capture**: Microphone audio at 16kHz via Web Audio API
2. **Feature extraction**: 17-dimensional vectors (MFCCs, energy, pitch, speech rate, pause duration) computed per 10ms frame
3. **Classification**: The model processes 1-second windows and classifies into `speaking`, `thinking_pause`, `turn_complete`, or `interrupt_intent`
4. **Event emission**: The turn detector state machine converts classifications into high-level events with debouncing and energy gating

All processing happens on the main thread using WASM. Typical inference takes <5ms per 100ms window.

## Requirements

- Modern browser with WebAssembly support (Chrome, Firefox, Safari, Edge)
- Microphone access (user must grant permission)
- `onnxruntime-web` as a peer dependency

## Next Steps

- [Live Demo](https://utterance.dev/playground) — Try it in your browser
- [API Reference](/docs/api-reference) — Full API documentation
- [GitHub](https://github.com/nizh0/Utterance) — Source code and issues
