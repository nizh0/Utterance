import type { Metadata } from "next";
import Link from "next/link";
import { Mic, Brain, Shield, Zap, Box, Code2 } from "lucide-react";
import { GitHubIcon, DiscordIcon } from "../shared";
import { CopyButton } from "../copy-button";
import { WaveBackground } from "../wave-background";
import { SyntaxHighlight } from "../syntax-highlight";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: {
    absolute: "Utterance — Client-Side Semantic Endpointing for Voice Apps",
  },
  description:
    "Client-side semantic endpointing for voice apps. Detect turn completion, thinking pauses, and interrupts entirely in the browser. No servers, no API keys, zero latency.",
  alternates: {
    canonical: "https://utterance.dev",
  },
  openGraph: {
    title: "Utterance — Know When They Finish Talking",
    description:
      "Client-side semantic endpointing for voice apps. Detect turn completion, thinking pauses, and interrupts entirely in the browser.",
    url: "https://utterance.dev",
  },
};

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
    <main>
      {/* Hero */}
      <section className="landing-hero" aria-labelledby="hero-heading">
        <WaveBackground />
        <div className="landing-hero-content">
          <h1 id="hero-heading" className="landing-h1">
            Know when they finish talking.
          </h1>
          <p className="landing-hero-sub">
            Client-side semantic endpointing for voice apps. Detect turn
            completion, thinking pauses, and interrupts entirely in the browser.
          </p>
          <div className="landing-hero-btns" role="group" aria-label="Get started actions">
            <Button asChild size="lg">
              <Link href="/docs/quick-start">Get started</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/demo">Live demo</Link>
            </Button>
          </div>
          <div className="landing-hero-install" role="group" aria-label="Install command">
            <code className="landing-install-text">
              npm install @utterance/core
            </code>
            <CopyButton text="npm install @utterance/core" />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="landing-section" aria-labelledby="benefits-heading">
        <div className="landing-section-header">
          <Badge variant="outline" className="w-fit rounded-md border-border px-2.5 py-1 text-muted-foreground font-normal text-sm">
            <span className="text-muted-foreground">//</span>
            Benefits
          </Badge>
          <h2 id="benefits-heading" className="landing-h2">Why Utterance?</h2>
        </div>
        <div className="landing-grid-3" role="list" aria-label="Key benefits">
          {benefits.map((b) => (
            <Card
              key={b.title}
              className="border-none shadow-none gap-0 py-0"
              role="listitem"
            >
              <CardContent className="flex flex-col gap-6 p-5">
                <div className="landing-card-icon" aria-hidden="true">
                  <b.icon size={24} strokeWidth={1.5} color="white" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-medium text-white">{b.title}</h3>
                  <p className="text-base leading-[1.3] text-muted-foreground">
                    {b.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Quick Start */}
      <section id="quick-start" className="landing-section" aria-labelledby="quickstart-heading">
        <div className="landing-section-header">
          <Badge variant="outline" className="w-fit rounded-md border-border px-2.5 py-1 text-muted-foreground font-normal text-sm">
            <span className="text-muted-foreground">//</span>
            Quick start
          </Badge>
          <h2 id="quickstart-heading" className="landing-h2">
            Install and start detecting in seconds.
          </h2>
        </div>
        <div className="landing-quickstart">
          <div className="landing-install-row" role="group" aria-label="Install command">
            <code className="landing-install-text">
              npm install @utterance/core
            </code>
            <CopyButton text="npm install @utterance/core" />
          </div>
          <figure className="landing-code-block" aria-label="Code example">
            <div className="landing-code-header" aria-hidden="true">
              <div className="landing-code-dot landing-code-dot--red" />
              <div className="landing-code-dot landing-code-dot--yellow" />
              <div className="landing-code-dot landing-code-dot--green" />
              <span className="landing-code-filename">index.ts</span>
            </div>
            <pre className="landing-code-pre" aria-label="Utterance usage example code">
              <SyntaxHighlight code={codeSnippet} />
            </pre>
          </figure>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-section" style={{ paddingBottom: 48 }} aria-labelledby="cta-heading">
        <Card className="w-full h-[360px] border-none shadow-none">
          <CardContent className="flex-1 flex flex-col justify-center items-start gap-3 p-10">
            <h2 id="cta-heading" className="landing-h2">Open source. Community driven.</h2>
            <p className="text-base leading-[1.3] text-muted-foreground max-w-[360px]">
              MIT licensed. Free forever. Star us on GitHub, join the Discord,
              or open a PR.
            </p>
            <div className="flex gap-3 mt-3" role="group" aria-label="Community links">
              <Button asChild size="lg">
                <a
                  href="https://github.com/nizh0/Utterance"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View Utterance on GitHub"
                >
                  <GitHubIcon size={16} />
                  GitHub
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a
                  href="https://discord.gg/kb4zMHNtEV"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join the Utterance Discord"
                >
                  <DiscordIcon size={16} />
                  Discord
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
