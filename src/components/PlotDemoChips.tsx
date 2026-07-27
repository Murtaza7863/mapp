import { useEffect, useState } from "react";

import { PLOT_DEMO_PROMPTS } from "../lib/plot-demo-prompts";

interface Props {
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function PlotDemoChips({ onSelect, disabled }: Props) {
  const [activeWow, setActiveWow] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWow) return;
    const t = window.setTimeout(() => setActiveWow(null), 4000);
    return () => window.clearTimeout(t);
  }, [activeWow]);

  return (
    <div className="plot-demo-chips">
      <p className="plot-demo-label">Try Plot AI</p>
      <div className="plot-demo-row">
        {PLOT_DEMO_PROMPTS.map((demo) => (
          <button
            key={demo.label}
            type="button"
            disabled={disabled}
            className="plot-demo-chip"
            title={demo.wow}
            onClick={() => {
              setActiveWow(demo.wow);
              onSelect(demo.text);
            }}
          >
            {demo.label}
          </button>
        ))}
      </div>
      {activeWow && (
        <p className="plot-demo-wow" aria-live="polite">
          {activeWow}
        </p>
      )}
    </div>
  );
}
