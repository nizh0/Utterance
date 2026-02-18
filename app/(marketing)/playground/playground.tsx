"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Settings, X, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
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

export function Playground() {
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  const detectorRef = useRef<import("@utterance/core").Utterance | null>(null);
  const idRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

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
    const { Utterance } = await import("@utterance/core");

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

  // Close settings on click outside
  useEffect(() => {
    if (!settingsOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(e.target as Node) &&
        settingsBtnRef.current &&
        !settingsBtnRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [settingsOpen]);

  return (
    <div className="pg">
      {/* Header bar */}
      <div className="pg-header">
        <div className="pg-header-left">
          <Link href="/" className="pg-back" aria-label="Back to home">
            <ArrowLeft size={14} />
          </Link>
          <span className="pg-title">event log</span>
          <div className="pg-stats">
            {eventLabels.map((e) => (
              <span
                key={e.key}
                className="pg-stat-badge"
              >
                <span
                  className="pg-stat-dot"
                  style={{ backgroundColor: eventColors[e.key] }}
                />
                {e.label}
                <span className="pg-stat-count">{counts[e.key] || 0}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="pg-header-right">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleClear}
            aria-label="Clear event log"
            className="text-muted-foreground hover:text-white"
          >
            <Trash2 size={14} />
          </Button>
          <Button
            ref={settingsBtnRef}
            variant="ghost"
            size="icon-xs"
            onClick={() => setSettingsOpen(!settingsOpen)}
            aria-label="Toggle settings"
            className={`text-muted-foreground hover:text-white ${settingsOpen ? "pg-settings-active" : ""}`}
          >
            <Settings size={14} />
          </Button>
        </div>
      </div>

      {/* Event log */}
      <div className="pg-log">
        {entries.length === 0 && (
          <div className="pg-log-empty">
            <Mic size={32} className="pg-log-empty-icon" />
            <p>
              Click &quot;Start Listening&quot; and speak into your microphone
            </p>
            <p className="pg-log-empty-sub">
              Events will appear here in real time
            </p>
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="pg-log-entry">
            <span className="pg-log-time">{entry.timestamp}</span>
            <span className="pg-log-event" style={{ color: entry.color }}>
              {entry.event}
            </span>
            <span className="pg-log-detail">{entry.detail}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* Settings popover */}
      {settingsOpen && (
        <div ref={settingsRef} className="pg-settings">
          <div className="pg-settings-header">
            <span>Settings</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close settings"
              className="text-muted-foreground hover:text-white"
            >
              <X size={14} />
            </Button>
          </div>
          <div className="pg-settings-body">
            <div className="pg-control">
              <label>
                <span>Sensitivity</span>
                <span className="pg-control-value">
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
                className="mt-1"
              />
              {listening && (
                <span className="pg-control-hint">Stop to change</span>
              )}
            </div>
            <div className="pg-control">
              <label>
                <span>Pause tolerance</span>
                <span className="pg-control-value">{pauseTolerance}ms</span>
              </label>
              <Slider
                min={200}
                max={5000}
                step={100}
                value={[pauseTolerance]}
                onValueChange={(v) => setPauseTolerance(v[0])}
                disabled={listening}
                className="mt-1"
              />
              {listening && (
                <span className="pg-control-hint">Stop to change</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating action bar */}
      <div className="pg-action-bar">
        <div className="pg-action-fade" />
        <Button
          onClick={listening ? handleStop : handleStart}
          variant={listening ? "destructive" : "default"}
          size="lg"
          className={`pg-action-btn ${listening ? "pg-action-btn--active" : ""}`}
        >
          {listening ? (
            <>
              <Square size={16} />
              Stop
            </>
          ) : (
            <>
              <Mic size={16} />
              Start Listening
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
