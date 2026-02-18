import Link from "next/link";
import {
  Mic,
  Brain,
  Shield,
  Zap,
  Box,
  Code2,
  Github,
  MessageCircle,
} from "lucide-react";
import { CopyButton } from "./copy-button";

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
      "On-device inference means instant results. No round-trip to a server — decisions happen in milliseconds.",
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
      "Small ONNX model that loads fast and runs efficiently. Designed for real-time performance on any device.",
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
  console.log("User wants to speak — stop AI response");
});

await detector.start();`;

const navLinks = [
  { label: "Docs", href: "/docs" },
  { label: "Demo", href: "/demo" },
];

export default function HomePage() {
  return (
    <div className="landing-root">
      {/* NavBar */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-nav-logo">
            <svg
              width="24"
              height="16"
              viewBox="0 0 24 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 0L12 16L20 0H24L12 16L0 0H4Z"
                fill="white"
              />
            </svg>
            <span className="landing-nav-logo-text">Utterance</span>
          </Link>
          <div className="landing-nav-links">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="landing-nav-link"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="landing-nav-cta">
            <a
              href="https://github.com/nizh0/Utterance"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-btn-sm"
            >
              <Github size={16} />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-h1">
            Know when they&apos;re done talking.
          </h1>
          <p className="landing-hero-sub">
            Client-side semantic endpointing for voice apps. Detect turn
            completion, thinking pauses, and interrupts — entirely in the
            browser.
          </p>
          <div className="landing-hero-btns">
            <Link href="/docs/quick-start" className="landing-btn-primary">
              Get started
            </Link>
            <Link href="/demo" className="landing-btn-secondary">
              Live demo
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="landing-section">
        <div className="landing-section-header">
          <span className="landing-badge"><span className="landing-badge-prefix">//</span>Benefits</span>
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
      <section className="landing-section">
        <div className="landing-section-header">
          <span className="landing-badge"><span className="landing-badge-prefix">//</span>Quick start</span>
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
              <code>{codeSnippet}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-section" style={{ paddingBottom: 48 }}>
        <div className="landing-cta-card">
          <div className="landing-cta-inner">
            <h2 className="landing-h2">
              Open source. Community driven.
            </h2>
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
                <Github size={16} />
                GitHub
              </a>
              <a
                href="https://discord.gg/kb4zMHNtEV"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn-secondary"
              >
                <MessageCircle size={16} />
                Discord
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-left">
            <Link href="/" className="landing-nav-logo">
              <svg
                width="24"
                height="16"
                viewBox="0 0 24 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 0L12 16L20 0H24L12 16L0 0H4Z"
                  fill="white"
                />
              </svg>
              <span className="landing-nav-logo-text">Utterance</span>
            </Link>
            <p className="landing-footer-desc">
              Client-side semantic endpointing. Know when they&apos;re done
              talking.
            </p>
          </div>
          <div className="landing-footer-nav">
            <span className="landing-footer-nav-title">Navigation</span>
            <Link href="/docs" className="landing-footer-link">
              Docs
            </Link>
            <Link href="/demo" className="landing-footer-link">
              Demo
            </Link>
            <a
              href="https://github.com/nizh0/Utterance"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-footer-link"
            >
              GitHub
            </a>
            <a
              href="https://discord.gg/kb4zMHNtEV"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-footer-link"
            >
              Discord
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
