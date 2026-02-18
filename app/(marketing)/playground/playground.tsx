"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Settings, X, Trash2, ArrowLeft, Cpu } from "lucide-react";
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

type ModelSource = "cdn" | "bundled" | "none";

const modelSourceLabels: Record<ModelSource, string> = {
  cdn: "ONNX (CDN)",
  bundled: "ONNX (Bundled)",
  none: "EnergyVAD (no model)",
};

const modelSourceDescriptions: Record<ModelSource, string> = {
  cdn: "170 KB int8 model from CDN",
  bundled: "170 KB int8 model from npm",
  none: "Simple energy-based detection",
};

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
  const [modelSource, setModelSource] = useState<ModelSource>("cdn");
  const [activeModel, setActiveModel] = useState<ModelSource | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({
    speechStart: 0,
    pause: 0,
    turnEnd: 0,
    interrupt: 0,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    setEntries([]);
    setCounts({ speechStart: 0, pause: 0, turnEnd: 0, interrupt: 0 });

    const modelLabel = modelSourceLabels[modelSource];
    addEntry("system", `Loading ${modelLabel}\u2026`);

    try {
      const { Utterance } = await import("@utterance/core");

      // Map model source to modelPath option
      const modelPath = modelSource === "none"
        ? "disabled"
        : modelSource;

      const detector = new Utterance({
        sensitivity,
        pauseTolerance,
        modelPath,
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

      await detector.start();
      detectorRef.current = detector;
      setListening(true);
      setActiveModel(modelSource);
      addEntry(
        "system",
        modelSource === "none"
          ? "EnergyVAD active \u2014 microphone active, start speaking\u2026"
          : `Model loaded (${modelSourceDescriptions[modelSource]}) \u2014 start speaking\u2026`
      );
    } catch (err) {
      addEntry("system", `Failed to start: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [addEntry, sensitivity, pauseTolerance, modelSource]);

  const handleStop = useCallback(() => {
    detectorRef.current?.stop();
    detectorRef.current = null;
    setListening(false);
    setActiveModel(null);
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

      {/* Model info bar */}
      <div className="pg-model-bar">
        <Cpu size={12} />
        <span className="pg-model-label">
          {activeModel
            ? modelSourceLabels[activeModel]
            : modelSourceLabels[modelSource]}
        </span>
        <span className="pg-model-sep" />
        <span className="pg-model-detail">
          {activeModel
            ? modelSourceDescriptions[activeModel]
            : modelSourceDescriptions[modelSource]}
        </span>
        {activeModel && (
          <>
            <span className="pg-model-sep" />
            <span className="pg-model-status pg-model-status--active">
              active
            </span>
          </>
        )}
        {loading && (
          <>
            <span className="pg-model-sep" />
            <span className="pg-model-status pg-model-status--loading">
              loading
            </span>
          </>
        )}
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
            {/* Model source */}
            <div className="pg-control">
              <label>
                <span>Model</span>
                <span className="pg-control-value">
                  {modelSourceLabels[modelSource]}
                </span>
              </label>
              <div className="pg-model-options">
                {(["cdn", "bundled", "none"] as ModelSource[]).map((src) => (
                  <button
                    key={src}
                    type="button"
                    className={`pg-model-option ${modelSource === src ? "pg-model-option--active" : ""}`}
                    onClick={() => setModelSource(src)}
                    disabled={listening}
                  >
                    <span className="pg-model-option-label">
                      {modelSourceLabels[src]}
                    </span>
                    <span className="pg-model-option-desc">
                      {modelSourceDescriptions[src]}
                    </span>
                  </button>
                ))}
              </div>
              {listening && (
                <span className="pg-control-hint">Stop to change</span>
              )}
            </div>
            {/* Sensitivity */}
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
            {/* Pause tolerance */}
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
          disabled={loading}
          className={`pg-action-btn ${listening ? "pg-action-btn--active" : ""}`}
        >
          {loading ? (
            "Loading model\u2026"
          ) : listening ? (
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
