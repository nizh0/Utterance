"use client";

import { useCallback, useRef, useState } from "react";

interface LogEntry {
  id: number;
  event: string;
  className: string;
  detail: string;
}

export function Demo() {
  const [listening, setListening] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const detectorRef = useRef<import("../../src/utterance").Utterance | null>(null);
  const idRef = useRef(0);

  const addEntry = useCallback((event: string, className: string, detail: string) => {
    setEntries((prev) => [
      { id: ++idRef.current, event, className, detail },
      ...prev,
    ]);
  }, []);

  const handleStart = useCallback(async () => {
    const { Utterance } = await import("../../src/utterance");

    const detector = new Utterance({ sensitivity: 0.5 });

    detector.on("speechStart", (e) => {
      addEntry("speechStart", "text-green-600", `at ${new Date(e.timestamp).toLocaleTimeString()}`);
    });

    detector.on("pause", (e) => {
      addEntry("pause", "text-yellow-600", `duration: ${e.duration}ms, confidence: ${e.confidence.toFixed(2)}`);
    });

    detector.on("turnEnd", (e) => {
      addEntry("turnEnd", "text-blue-600", `confidence: ${e.confidence.toFixed(2)}, duration: ${e.duration}ms`);
    });

    detector.on("interrupt", (e) => {
      addEntry("interrupt", "text-red-600", `at ${new Date(e.timestamp).toLocaleTimeString()}`);
    });

    setEntries([]);
    await detector.start();
    detectorRef.current = detector;
    setListening(true);
    addEntry("system", "text-fd-muted-foreground", "Listening...");
  }, [addEntry]);

  const handleStop = useCallback(() => {
    detectorRef.current?.stop();
    detectorRef.current = null;
    setListening(false);
    addEntry("system", "text-fd-muted-foreground", "Stopped.");
  }, [addEntry]);

  return (
    <div>
      <div className="flex gap-3">
        <button
          onClick={handleStart}
          disabled={listening}
          className="rounded-lg bg-fd-primary px-6 py-3 font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start Listening
        </button>
        <button
          onClick={handleStop}
          disabled={!listening}
          className="rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Stop
        </button>
      </div>

      <div className="mt-6 min-h-[200px] max-h-[400px] overflow-y-auto rounded-lg border border-fd-border bg-fd-card p-4 font-mono text-sm">
        {entries.length === 0 && (
          <p className="text-fd-muted-foreground italic">
            Click &quot;Start Listening&quot; and speak into your microphone.
          </p>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="border-b border-fd-border py-1 last:border-b-0"
          >
            <span className={`font-semibold ${entry.className}`}>
              [{entry.event}]
            </span>{" "}
            {entry.detail}
          </div>
        ))}
      </div>
    </div>
  );
}
