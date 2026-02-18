"use client";

import { useCallback, useRef, useState } from "react";
import { Mic, Square, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface LogEntry {
  id: number;
  event: string;
  color: string;
  detail: string;
  timestamp: string;
}

const eventColors: Record<string, string> = {
  speechStart: "#28c840",
  pause: "#febc2e",
  turnEnd: "#61afef",
  interrupt: "#ff5f57",
  system: "rgb(133, 133, 133)",
};

const eventLabels = [
  { key: "speechStart", label: "speechStart" },
  { key: "pause", label: "pause" },
  { key: "turnEnd", label: "turnEnd" },
  { key: "interrupt", label: "interrupt" },
];

export function Demo() {
  const [listening, setListening] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [pauseTolerance, setPauseTolerance] = useState(1500);
  const [counts, setCounts] = useState<Record<string, number>>({
    speechStart: 0,
    pause: 0,
    turnEnd: 0,
    interrupt: 0,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const detectorRef = useRef<import("../../../src/utterance").Utterance | null>(
    null
  );
  const idRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addEntry = useCallback((event: string, detail: string) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setEntries((prev) => {
      const next = [
        ...prev,
        {
          id: ++idRef.current,
          event,
          color: eventColors[event] || "rgb(133, 133, 133)",
          detail,
          timestamp,
        },
      ];
      return next.length > 500 ? next.slice(-500) : next;
    });
    if (event !== "system") {
      setCounts((prev) => ({ ...prev, [event]: (prev[event] || 0) + 1 }));
    }
    setTimeout(() => {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  const handleStart = useCallback(async () => {
    const { Utterance } = await import("../../../src/utterance");

    const detector = new Utterance({
      sensitivity,
      pauseTolerance,
    });

    detector.on("speechStart", () => {
      addEntry("speechStart", "Speech detected");
    });

    detector.on("pause", (e) => {
      addEntry(
        "pause",
        `Duration: ${e.duration}ms \u00b7 Confidence: ${e.confidence.toFixed(2)}`
      );
    });

    detector.on("turnEnd", (e) => {
      addEntry(
        "turnEnd",
        `Confidence: ${e.confidence.toFixed(2)} \u00b7 Duration: ${e.duration}ms`
      );
    });

    detector.on("interrupt", () => {
      addEntry("interrupt", "User interrupted");
    });

    setEntries([]);
    setCounts({ speechStart: 0, pause: 0, turnEnd: 0, interrupt: 0 });
    await detector.start();
    detectorRef.current = detector;
    setListening(true);
    addEntry("system", "Microphone active \u2014 start speaking...");
  }, [addEntry, sensitivity, pauseTolerance]);

  const handleStop = useCallback(() => {
    detectorRef.current?.stop();
    detectorRef.current = null;
    setListening(false);
    addEntry("system", "Stopped listening.");
  }, [addEntry]);

  const handleClear = useCallback(() => {
    setEntries([]);
    setCounts({ speechStart: 0, pause: 0, turnEnd: 0, interrupt: 0 });
  }, []);

  return (
    <div className="dash">
      {/* Mobile sidebar toggle */}
      <Button
        variant="outline"
        size="sm"
        className="dash-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Settings size={14} />
        Controls
      </Button>

      {/* Main event console */}
      <div className="dash-main">
        <div className="dash-console">
          <div className="dash-console-header">
            <div className="dash-console-title">
              <span className="landing-code-filename">event log</span>
            </div>
            <div className="dash-console-actions">
              <span className="dash-entry-count">
                {entries.filter((e) => e.event !== "system").length} events
              </span>
              <Button
                variant="outline"
                size="xs"
                className="text-xs font-mono"
                onClick={handleClear}
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="dash-console-body">
            {entries.length === 0 && (
              <p className="dash-log-placeholder">
                Click &quot;Start Listening&quot; and speak into your microphone
                to see events appear here.
              </p>
            )}
            {entries.map((entry) => (
              <div key={entry.id} className="dash-log-entry">
                <span className="dash-log-time">{entry.timestamp}</span>
                <span className="dash-log-event">{entry.event}</span>
                <span className="dash-log-detail">{entry.detail}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`dash-sidebar ${sidebarOpen ? "dash-sidebar--open" : ""}`}
      >
        {/* Status */}
        <div className="dash-section">
          <div className="dash-status">
            <span
              className={`dash-status-dot ${listening ? "dash-status-dot--active" : ""}`}
            />
            <span>{listening ? "Listening" : "Stopped"}</span>
          </div>
        </div>

        {/* Start / Stop */}
        <div className="dash-section">
          <Button
            onClick={listening ? handleStop : handleStart}
            variant={listening ? "destructive" : "default"}
            className="w-full"
            size="lg"
          >
            {listening ? (
              <>
                <Square size={16} /> Stop
              </>
            ) : (
              <>
                <Mic size={16} /> Start Listening
              </>
            )}
          </Button>
        </div>

        {/* Configuration */}
        <div className="dash-section">
          <div className="dash-section-label">Configuration</div>
          <div className="dash-control">
            <label>
              <span>Sensitivity</span>
              <span className="dash-control-value">
                {sensitivity.toFixed(2)}
              </span>
            </label>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[sensitivity]}
              onValueChange={(v) => setSensitivity(v[0])}
              disabled={listening}
              className="mt-2"
            />
            {listening && (
              <span className="dash-control-hint">Stop to change</span>
            )}
          </div>
          <div className="dash-control">
            <label>
              <span>Pause tolerance</span>
              <span className="dash-control-value">{pauseTolerance}ms</span>
            </label>
            <Slider
              min={200}
              max={5000}
              step={100}
              value={[pauseTolerance]}
              onValueChange={(v) => setPauseTolerance(v[0])}
              disabled={listening}
              className="mt-2"
            />
            {listening && (
              <span className="dash-control-hint">Stop to change</span>
            )}
          </div>
        </div>

        {/* Events legend */}
        <div className="dash-section">
          <div className="dash-section-label">Events</div>
          <div className="dash-legend">
            {eventLabels.map((e) => (
              <div key={e.key} className="dash-legend-item">
                <span
                  className="dash-legend-dot"
                  style={{ backgroundColor: eventColors[e.key] }}
                />
                {e.label}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="dash-section">
          <div className="dash-section-label">Stats</div>
          <div className="dash-stats-grid">
            {eventLabels.map((e) => (
              <div key={e.key} className="dash-stat">
                <span
                  className="dash-stat-count"
                  style={{ color: eventColors[e.key] }}
                >
                  {counts[e.key] || 0}
                </span>
                <span className="dash-stat-label">{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
