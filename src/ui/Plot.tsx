import React, { useEffect, useRef } from 'react';
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

/** Thin wrapper around plotly.js-dist-min, dynamically imported to keep the bundle small.
 *  Layout is theme-aware: paper/plot backgrounds are transparent and font/grid colors
 *  come from the active CSS variables, so charts follow the light/dark toggle. */
export function Plot({ data, layout, height = 380, ariaLabel, ariaDescription }: PlotProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const descId = React.useId();
  const key = JSON.stringify(data) + JSON.stringify(layout) + document.documentElement.dataset.theme;
  // phones: cap the chart height so a figure never exceeds the viewport
  const compact = typeof window !== 'undefined' && window.innerWidth < 720;
  const effectiveHeight = compact ? Math.min(height, 300) : height;

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    if (!el) return;
    const c = chartColors();
    const themed = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: c.font },
      xaxis: { gridcolor: c.grid, linecolor: c.line, zerolinecolor: c.line },
      yaxis: { gridcolor: c.grid, linecolor: c.line, zerolinecolor: c.line },
      ...layout,
    };
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      if (!alive || !ref.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Plotly.react(ref.current, data as any[], themed as any, { responsive: true, displayModeBar: false });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

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
