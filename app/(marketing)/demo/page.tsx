import type { Metadata } from "next";
import { Demo } from "./demo";

export const metadata: Metadata = {
  title: "Live Demo — Utterance",
  description:
    "Try Utterance in your browser. Speak into your microphone and see real-time turn detection events.",
};

export default function DemoPage() {
  return (
    <section className="demo-dashboard">
      <Demo />
    </section>
  );
}
