import type { Metadata } from "next";
import { Demo } from "./demo";

export const metadata: Metadata = {
  title: "Live Demo",
  description:
    "Try Utterance in your browser. Speak into your microphone and see real-time speech turn detection, pause detection, and interrupt events — all running client-side.",
  alternates: {
    canonical: "https://utterance.dev/demo",
  },
  openGraph: {
    title: "Live Demo — Utterance",
    description:
      "Interactive demo of client-side voice turn detection. See speechStart, pause, turnEnd, and interrupt events in real time.",
    url: "https://utterance.dev/demo",
  },
};

export default function DemoPage() {
  return (
    <section className="demo-dashboard">
      <Demo />
    </section>
  );
}
