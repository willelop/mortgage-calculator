import React, { useCallback, useEffect, useRef, useState } from 'react';
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
 *  Sizing is container-driven and deferred: a chart is only drawn when its container
 *  actually has width (drawing while display:none makes Plotly fall back to its 700px
 *  default — which overflows phone screens), and a ResizeObserver re-draws whenever the
 *  container appears or changes size (tab switch, rotation, compare column). */
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

  const render = useCallback((plotly: PlotlyModule) => {
    const el = ref.current;
    if (!el || el.clientWidth <= 0) return; // hidden — the ResizeObserver re-calls us when visible
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plotly.react(el, data as any[], themed as any, { responsive: true, displayModeBar: false });
  }, [data, layout, key, compact]);

  // load the (cached) module once, then render
  useEffect(() => {
    let alive = true;
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      plotlyRef.current = Plotly;
      if (alive) render(Plotly);
    });
    return () => {
      alive = false;
    };
  }, [render]);

  // re-draw whenever the container appears or its size changes
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (plotlyRef.current) render(plotlyRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [render]);

  return (
    <div style={{ position: 'relative', maxWidth: '100%' }}>
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
