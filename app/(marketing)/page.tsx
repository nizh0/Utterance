import Link from "next/link";
import { Mic, Brain, Shield, Zap, Box, Code2 } from "lucide-react";
import { GitHubIcon, DiscordIcon } from "../shared";
import { CopyButton } from "../copy-button";
import { WaveBackground } from "../wave-background";
import { SyntaxHighlight } from "../syntax-highlight";

const benefits = [
  {
    icon: Shield,
    title: "No cloud dependency",
    description:
      "Everything runs in the browser. No servers, no API keys, no network requests for audio processing.",
  },
  {
    icon: Zap,
    title: "Zero latency",
    description:
      "On-device inference means instant results. No round trip to a server. Decisions happen in milliseconds.",
  },
  {
    icon: Mic,
    title: "Privacy first",
    description:
      "Audio never leaves the user\u2019s device. No recording, no uploading, no third-party processing.",
  },
  {
    icon: Brain,
    title: "Lightweight model",
    description:
      "Small ONNX model that loads fast and runs efficiently. It is designed for real-time performance on any device.",
  },
  {
    icon: Box,
    title: "Framework agnostic",
    description:
      "Works with any JavaScript framework. Use it with React, Vue, vanilla JS, or any voice SDK.",
  },
  {
    icon: Code2,
    title: "Simple event API",
    description:
      "Just listen for turnEnd, pause, and interrupt events. Get building in minutes, not hours.",
  },
];

const codeSnippet = `import { Utterance } from "@utterance/core";

const detector = new Utterance();

detector.on("turnEnd", (result) => {
  console.log("User is done speaking", result.confidence);
});

detector.on("pause", (result) => {
  console.log("User is thinking...", result.duration);
});

detector.on("interrupt", () => {
  console.log("User wants to speak. Stop AI response");
});

await detector.start();`;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="landing-hero">
        <WaveBackground />
        <div className="landing-hero-content">
          <h1 className="landing-h1">Know when they finish talking.</h1>
          <p className="landing-hero-sub">
            Client-side semantic endpointing for voice apps. Detect turn
            completion, thinking pauses, and interrupts entirely in the browser.
          </p>
          <div className="landing-hero-btns">
            <Link href="/docs/quick-start" className="landing-btn-primary">
              Get started
            </Link>
            <Link href="/demo" className="landing-btn-secondary">
              Live demo
            </Link>
          </div>
          <div className="landing-hero-install">
            <code className="landing-install-text">
              npm install @utterance/core
            </code>
            <CopyButton text="npm install @utterance/core" />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="landing-section">
        <div className="landing-section-header">
          <span className="landing-badge">
            <span className="landing-badge-prefix">//</span>Benefits
          </span>
          <h2 className="landing-h2">Why Utterance?</h2>
        </div>
        <div className="landing-grid-3">
          {benefits.map((b) => (
            <div key={b.title} className="landing-card">
              <div className="landing-card-icon">
                <b.icon size={24} strokeWidth={1.5} color="white" />
              </div>
              <div className="landing-card-text">
                <h3 className="landing-card-title">{b.title}</h3>
                <p className="landing-card-desc">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Start */}
      <section id="quick-start" className="landing-section">
        <div className="landing-section-header">
          <span className="landing-badge">
            <span className="landing-badge-prefix">//</span>Quick start
          </span>
          <h2 className="landing-h2">
            Install and start detecting in seconds.
          </h2>
        </div>
        <div className="landing-quickstart">
          <div className="landing-install-row">
            <code className="landing-install-text">
              npm install @utterance/core
            </code>
            <CopyButton text="npm install @utterance/core" />
          </div>
          <div className="landing-code-block">
            <div className="landing-code-header">
              <div className="landing-code-dot landing-code-dot--red" />
              <div className="landing-code-dot landing-code-dot--yellow" />
              <div className="landing-code-dot landing-code-dot--green" />
              <span className="landing-code-filename">index.ts</span>
            </div>
            <pre className="landing-code-pre">
              <SyntaxHighlight code={codeSnippet} />
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-section" style={{ paddingBottom: 48 }}>
        <div className="landing-cta-card">
          <div className="landing-cta-inner">
            <h2 className="landing-h2">Open source. Community driven.</h2>
            <p className="landing-body" style={{ maxWidth: 360 }}>
              MIT licensed. Free forever. Star us on GitHub, join the Discord,
              or open a PR.
            </p>
            <div className="landing-cta-btns">
              <a
                href="https://github.com/nizh0/Utterance"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn-primary"
              >
                <GitHubIcon size={16} />
                GitHub
              </a>
              <a
                href="https://discord.gg/kb4zMHNtEV"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn-secondary"
              >
                <DiscordIcon size={16} />
                Discord
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
