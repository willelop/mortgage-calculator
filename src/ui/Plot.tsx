import React, { useEffect, useRef, useState } from 'react';
import { chartColors } from '../theme';

interface PlotProps {
  data: unknown[];
  layout: Record<string, unknown>;
  height?: number;
  /** Accessible name (roadmap 3c): shown as the figure's role="img" label. */
  ariaLabel?: string;
  /** Longer text alternative, visually hidden, linked via aria-describedby. */
  ariaDescription?: string;
}

type PlotlyModule = {
  newPlot(el: HTMLElement, data: unknown[], layout: unknown, config?: unknown): Promise<unknown>;
  react(el: HTMLElement, data: unknown[], layout: unknown, config?: unknown): Promise<unknown>;
  purge(el: HTMLElement): void;
  Plots: { resize(el: HTMLElement): void };
};

/** Thin wrapper around plotly.js-dist-min, dynamically imported to keep the bundle small.
 *  Layout is theme-aware: paper/plot backgrounds are transparent and font/grid colors
 *  come from the active CSS variables, so charts follow the light/dark toggle.
 *  Sizing is container-driven: a ResizeObserver re-fits the chart whenever its box
 *  changes (tab switch from hidden → visible, phone rotation, compare column), so no
 *  synthetic window-resize events are needed anywhere else in the app. */
export function Plot({ data, layout, height = 380, ariaLabel, ariaDescription }: PlotProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const plotlyRef = useRef<PlotlyModule | null>(null);
  const descId = React.useId();
  const key = JSON.stringify(data) + JSON.stringify(layout) + document.documentElement.dataset.theme;

  // phones: cap the chart height so a figure never exceeds the viewport;
  // reactive to rotation via matchMedia instead of a render-time snapshot
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const onChange = (e: MediaQueryListEvent) => setCompact(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const effectiveHeight = compact ? Math.min(height, 300) : height;

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    if (!el) return;
    const c = chartColors();
    const base = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: c.font, size: compact ? 10 : 12 },
      xaxis: { gridcolor: c.grid, linecolor: c.line, zerolinecolor: c.line, ...(compact ? { nticks: 6 } : {}) },
      yaxis: { gridcolor: c.grid, linecolor: c.line, zerolinecolor: c.line, ...(compact ? { nticks: 6 } : {}) },
    };
    const themed: Record<string, unknown> = { ...base, ...layout };
    // merge (not replace) per-chart axis options so the compact defaults survive
    themed.xaxis = { ...base.xaxis, ...(layout.xaxis as Record<string, unknown> | undefined) };
    themed.yaxis = { ...base.yaxis, ...(layout.yaxis as Record<string, unknown> | undefined) };
    // phones: tighter margins regardless of the chart's desktop margin
    if (compact) themed.margin = { l: 46, r: 12, t: 10, b: 38 };
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      plotlyRef.current = Plotly;
      if (!alive || !ref.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Plotly.react(ref.current, data as any[], themed as any, { responsive: true, displayModeBar: false });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, compact]);

  // re-fit whenever the container's size changes (hidden → visible tab, rotation,
  // compare column appearing) — the event-based hack in App.tsx could not cover these
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastW = -1;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0 && w !== lastW && plotlyRef.current) {
        lastW = w;
        plotlyRef.current.Plots.resize(el);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={ref}
        style={{ height: effectiveHeight }}
        role={ariaLabel ? 'img' : undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescription ? descId : undefined}
      />
      {/* visually hidden text alternative for screen readers (roadmap 3c) */}
      {ariaDescription && (
        <p
          id={descId}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            margin: -1,
            padding: 0,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {ariaDescription}
        </p>
      )}
    </div>
  );
}
