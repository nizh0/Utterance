"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Trash2,
  ArrowLeft,
  Cpu,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

/* ── types ─────────────────────────────────────────────── */

interface LogEntry {
  id: number;
  event: string;
  detail: string;
  timestamp: string;
}

type ModelSource = "cdn" | "bundled" | "none";
type EventType = "speechStart" | "pause" | "turnEnd" | "interrupt";

const modelSourceLabels: Record<ModelSource, string> = {
  cdn: "V1 · CDN",
  bundled: "V1 · Bundled",
  none: "EnergyVAD",
};

const modelSourceDescriptions: Record<ModelSource, string> = {
  cdn: "170 KB model loaded from CDN",
  bundled: "170 KB model from npm package",
  none: "Simple energy-based detection",
};

const eventLabels = [
  { key: "speechStart", label: "speech" },
  { key: "pause", label: "pause" },
  { key: "turnEnd", label: "turn end" },
  { key: "interrupt", label: "interrupt" },
];

/* ── spider chart constants ───────────────────────────── */

const AXES: { key: EventType; label: string; angle: number }[] = [
  { key: "speechStart", label: "SPEECH",    angle: -Math.PI / 2 },      // top
  { key: "pause",       label: "PAUSE",     angle: 0 },                 // right
  { key: "turnEnd",     label: "TURN END",  angle: Math.PI / 2 },       // bottom
  { key: "interrupt",   label: "INTERRUPT",  angle: Math.PI },           // left
];

const GRID_LEVELS = [0.25, 0.5, 0.75, 1.0];
const EVENT_BUMP: Record<EventType, number> = {
  speechStart: 0.4,
  pause: 0.5,
  turnEnd: 0.6,
  interrupt: 0.7,
};
const DECAY_PER_SEC = 0.15; // exponential decay base per second
const SVG_SIZE = 400;
const CENTER = SVG_SIZE / 2;
const RADIUS = 150;
const LABEL_OFFSET = 22;
const THROTTLE_MS = 33; // ~30fps render throttle

/* ── spider chart hook ────────────────────────────────── */

function useSpiderChart(listening: boolean) {
  const valuesRef = useRef<Record<EventType, number>>({
    speechStart: 0,
    pause: 0,
    turnEnd: 0,
    interrupt: 0,
  });
  const listeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);
  const lastRenderRef = useRef(0);

  /* tick state to trigger re-renders at throttled rate */
  const [, setTick] = useState(0);

  /* public: fire an event → bump axis value */
  const pushEvent = useCallback((eventType: EventType) => {
    if (!listeningRef.current) return;
    const v = valuesRef.current;
    v[eventType] = Math.min(1, v[eventType] + EVENT_BUMP[eventType]);
  }, []);

  /* public: toggle speaking state */
  const setSpeaking = useCallback((v: boolean) => {
    isSpeakingRef.current = v;
  }, []);

  /* sync listening ref + reset values */
  useEffect(() => {
    listeningRef.current = listening;
    if (listening) {
      valuesRef.current = { speechStart: 0, pause: 0, turnEnd: 0, interrupt: 0 };
    } else {
      isSpeakingRef.current = false;
    }
  }, [listening]);

  /* animation loop: decay values + throttled re-render */
  useEffect(() => {
    let running = true;
    lastFrameRef.current = performance.now();
    lastRenderRef.current = 0;

    const loop = (now: number) => {
      if (!running) return;

      const rawDt = (now - lastFrameRef.current) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastFrameRef.current = now;

      /* decay all values */
      const v = valuesRef.current;
      const decay = Math.pow(DECAY_PER_SEC, dt);
      let anyNonZero = false;
      for (const key of AXES) {
        if (v[key.key] > 0.001) {
          v[key.key] *= decay;
          if (v[key.key] < 0.001) v[key.key] = 0;
          anyNonZero = true;
        }
      }

      /* subtle ambient pulse while speaking */
      if (isSpeakingRef.current && listeningRef.current) {
        v.speechStart = Math.min(1, v.speechStart + 0.002);
        anyNonZero = true;
      }

      /* throttled re-render */
      if (anyNonZero && now - lastRenderRef.current > THROTTLE_MS) {
        lastRenderRef.current = now;
        setTick((t) => t + 1);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { values: valuesRef.current, pushEvent, setSpeaking };
}

/* ── spider chart SVG component ───────────────────────── */

function SpiderChart({ values }: { values: Record<EventType, number> }) {
  /* compute vertex positions for each axis */
  const vertices = AXES.map((axis) => {
    const v = values[axis.key];
    return {
      key: axis.key,
      label: axis.label,
      angle: axis.angle,
      x: CENTER + v * RADIUS * Math.cos(axis.angle),
      y: CENTER + v * RADIUS * Math.sin(axis.angle),
      value: v,
    };
  });

  /* build polygon path: M x0,y0 L x1,y1 ... Z */
  const pathD =
    vertices
      .map((v, i) => `${i === 0 ? "M" : "L"} ${v.x.toFixed(2)},${v.y.toFixed(2)}`)
      .join(" ") + " Z";

  return (
    <svg
      className="pg-spider"
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Grid rings */}
      {GRID_LEVELS.map((level) => (
        <circle
          key={level}
          cx={CENTER}
          cy={CENTER}
          r={level * RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={0.5}
        />
      ))}

      {/* Axis lines */}
      {AXES.map((axis) => (
        <line
          key={axis.key}
          x1={CENTER}
          y1={CENTER}
          x2={CENTER + RADIUS * Math.cos(axis.angle)}
          y2={CENTER + RADIUS * Math.sin(axis.angle)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.5}
        />
      ))}

      {/* Data polygon fill */}
      <path
        d={pathD}
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Vertex dots */}
      {vertices.map((v) => (
        <circle
          key={v.key}
          cx={v.x}
          cy={v.y}
          r={v.value > 0.01 ? 3 : 1.5}
          fill={`rgba(255,255,255,${Math.max(0.15, v.value * 0.7).toFixed(3)})`}
        />
      ))}

      {/* Axis labels */}
      {AXES.map((axis) => {
        const lx = CENTER + (RADIUS + LABEL_OFFSET) * Math.cos(axis.angle);
        const ly = CENTER + (RADIUS + LABEL_OFFSET) * Math.sin(axis.angle);
        const activeVal = values[axis.key];
        const alpha = 0.12 + activeVal * 0.4;

        return (
          <text
            key={axis.key}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fill={`rgba(255,255,255,${alpha.toFixed(3)})`}
            fontSize={9}
            fontFamily="'JetBrains Mono', monospace"
            fontWeight={500}
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ── main component ────────────────────────────────────── */

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

  const { values, pushEvent, setSpeaking } = useSpiderChart(listening);

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
        { id: ++idRef.current, event, detail, timestamp },
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

      const modelPath = modelSource === "none" ? "disabled" : modelSource;

      const detector = new Utterance({
        sensitivity,
        pauseTolerance,
        modelPath,
      });

      detector.on("speechStart", () => {
        addEntry("speechStart", "Speech detected");
        setSpeaking(true);
        pushEvent("speechStart");
      });

      detector.on("pause", (e) => {
        addEntry(
          "pause",
          `Duration: ${e.duration}ms · Confidence: ${e.confidence.toFixed(2)}`,
        );
        setSpeaking(false);
        pushEvent("pause");
      });

      detector.on("turnEnd", (e) => {
        addEntry(
          "turnEnd",
          `Confidence: ${e.confidence.toFixed(2)} · Duration: ${e.duration}ms`,
        );
        setSpeaking(false);
        pushEvent("turnEnd");
      });

      detector.on("interrupt", () => {
        addEntry("interrupt", "User interrupted");
        setSpeaking(true);
        pushEvent("interrupt");
      });

      await detector.start();
      detectorRef.current = detector;
      setListening(true);
      setActiveModel(modelSource);
      addEntry(
        "system",
        modelSource === "none"
          ? "EnergyVAD active — start speaking\u2026"
          : "Model loaded — start speaking\u2026",
      );
    } catch (err) {
      addEntry(
        "system",
        `Failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  }, [addEntry, sensitivity, pauseTolerance, modelSource, pushEvent, setSpeaking]);

  const handleStop = useCallback(() => {
    detectorRef.current?.stop();
    detectorRef.current = null;
    setListening(false);
    setActiveModel(null);
    setSpeaking(false);
    addEntry("system", "Stopped.");
  }, [addEntry, setSpeaking]);

  const handleClear = useCallback(() => {
    setEntries([]);
    setCounts({ speechStart: 0, pause: 0, turnEnd: 0, interrupt: 0 });
  }, []);

  return (
    <div className="pg">
      {/* ── Header bar ─────────────────────────────── */}
      <div className="pg-header">
        <div className="pg-header-left">
          <Link href="/" className="pg-back" aria-label="Back to home">
            <ArrowLeft size={14} />
          </Link>
          <span className="pg-title">playground</span>

          {/* Model badge */}
          <span className="pg-model-chip">
            <Cpu size={10} />
            {activeModel
              ? modelSourceLabels[activeModel]
              : modelSourceLabels[modelSource]}
            {listening && <span className="pg-model-dot" />}
          </span>
        </div>
        <div className="pg-header-right">
          <div className="pg-stats">
            {eventLabels.map((e) => (
              <span key={e.key} className="pg-stat-badge">
                <span className="pg-stat-count">{counts[e.key] || 0}</span>
                <span className="pg-stat-label">{e.label}</span>
              </span>
            ))}
          </div>
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
            variant="ghost"
            size="icon-xs"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            className="pg-settings-toggle text-muted-foreground hover:text-white"
          >
            <Settings size={14} />
          </Button>
        </div>
      </div>

      {/* ── Main area: sidebar + chart ─────────────── */}
      <div className="pg-body">
        {/* Event log sidebar */}
        <div className="pg-sidebar">
          <div className="pg-sidebar-head">
            <span className="pg-sidebar-title">Events</span>
          </div>
          <div className="pg-log">
            {entries.length === 0 && (
              <div className="pg-log-empty">
                <p>Events appear here as you speak</p>
              </div>
            )}
            {entries.map((entry) => (
              <div key={entry.id} className="pg-log-entry">
                <span className="pg-log-time">{entry.timestamp}</span>
                <span className="pg-log-event">{entry.event}</span>
                <span className="pg-log-detail">{entry.detail}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* Center: spider chart */}
        <div className="pg-viz">
          <SpiderChart values={values} />
        </div>

        {/* Settings backdrop (mobile) */}
        {settingsOpen && (
          <div
            className="pg-settings-backdrop"
            onClick={() => setSettingsOpen(false)}
          />
        )}

        {/* Settings sidebar (right) */}
        <div className={`pg-settings ${settingsOpen ? "pg-settings--open" : ""}`}>
          <div className="pg-settings-header">
            <span>Settings</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close settings"
              className="pg-settings-close text-muted-foreground hover:text-white"
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
      </div>

      {/* ── Floating action bar ────────────────────── */}
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
