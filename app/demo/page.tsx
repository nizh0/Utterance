import type { Metadata } from "next";
import { Demo } from "./demo";

export const metadata: Metadata = {
  title: "Live Demo — Utterance",
  description: "Try Utterance in your browser. Speak into your microphone and see real-time turn detection events.",
};

export default function DemoPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Live Demo</h1>
      <p className="mb-8 text-fd-muted-foreground">
        Speak into your microphone and see real-time turn detection events.
      </p>
      <Demo />
    </main>
  );
}
