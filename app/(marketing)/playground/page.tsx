import type { Metadata } from "next";
import { Playground } from "./playground";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Try Utterance in your browser. Speak into your microphone and see real-time speech turn detection, pause detection, and interrupt events — all running client-side.",
  alternates: {
    canonical: "https://utterance.dev/playground",
  },
  openGraph: {
    title: "Playground — Utterance",
    description:
      "Interactive playground for client-side voice turn detection. See speechStart, pause, turnEnd, and interrupt events in real time.",
    url: "https://utterance.dev/playground",
  },
};

export default function PlaygroundPage() {
  return (
    <section className="pg-root">
      <Playground />
    </section>
  );
}
