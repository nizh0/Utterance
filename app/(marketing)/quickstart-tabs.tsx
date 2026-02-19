"use client";

import { useState } from "react";
import { CopyButton } from "../copy-button";
import { SyntaxHighlight } from "../syntax-highlight";

function NpmIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0h-2.666V8.667h2.666v5.331zm12 0h-1.332v-4h-1.338v4h-1.33v-4h-1.336v4H16v-5.331h6.666v5.331zM11.333 8.667h1.334v4h-1.334V8.667z" />
    </svg>
  );
}

function PyPiIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M9.585 11.692h4.328s2.432.039 2.432-2.35V5.391S16.714 3 11.936 3C7.362 3 7.647 4.874 7.647 4.874l.006 1.942h4.357v.58H7.083S4.738 7.099 4.738 11.505s2.04 4.248 2.04 4.248h1.218v-2.04s-.066-2.04 1.589-2.021zm-.39-5.14a.786.786 0 1 1 .003-1.571.786.786 0 0 1-.003 1.572zm8.68 1.346h-1.217v2.04s.065 2.04-1.59 2.021h-4.327s-2.432-.04-2.432 2.35v3.951s-.37 2.391 4.409 2.391c4.573 0 4.288-1.874 4.288-1.874l-.006-1.943h-4.357v-.58h4.927s2.345.298 2.345-4.109-2.04-4.248-2.04-4.248zm-3.896 9.24a.786.786 0 1 1-.002 1.57.786.786 0 0 1 .002-1.57z" />
    </svg>
  );
}

const jsCode = `import { Utterance } from "@utterance/core";

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

const pyCode = `from utterance import Utterance
import numpy as np

# Initialize detector (downloads model automatically)
detector = Utterance()

# Your audio features — shape: (1, 100, 40)
features = np.random.randn(1, 100, 40).astype(np.float32)

# Run inference
result = detector.predict(features)

print("Speaking:", result["speaking"])
print("Thinking Pause:", result["thinking_pause"])
print("Turn Complete:", result["turn_complete"])`;

const tabs = [
  {
    id: "npm",
    label: "npm",
    icon: NpmIcon,
    install: "npm install @utterance/core",
    filename: "index.ts",
    code: jsCode,
  },
  {
    id: "pip",
    label: "PyPI",
    icon: PyPiIcon,
    install: "pip install utterance-core",
    filename: "main.py",
    code: pyCode,
  },
] as const;

export function QuickStartTabs() {
  const [active, setActive] = useState<string>("npm");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="landing-quickstart">
      <figure className="qs-block" aria-label="Code example">
        {/* Header: traffic lights + tabs + filename */}
        <div className="qs-header">
          <div className="qs-header-left">
            <div className="landing-code-dot landing-code-dot--red" />
            <div className="landing-code-dot landing-code-dot--yellow" />
            <div className="landing-code-dot landing-code-dot--green" />
          </div>
          <div className="qs-header-tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active === tab.id}
                className={`qs-tab ${active === tab.id ? "qs-tab-active" : ""}`}
                onClick={() => setActive(tab.id)}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
          <span className="qs-filename">{current.filename}</span>
        </div>

        {/* Install command row */}
        <div className="qs-install-bar">
          <span className="qs-install-prompt">$</span>
          <code className="qs-install-cmd">{current.install}</code>
          <CopyButton text={current.install} />
        </div>

        {/* Code */}
        <pre className="landing-code-pre" aria-label="Utterance usage example code">
          <SyntaxHighlight code={current.code} />
        </pre>
      </figure>
    </div>
  );
}
