import React, { useEffect, useRef } from 'react';
import { chartColors } from '../theme';

interface PlotProps {
  data: unknown[];
  layout: Record<string, unknown>;
  height?: number;
}

/** Thin wrapper around plotly.js-dist-min, dynamically imported to keep the bundle small.
 *  Layout is theme-aware: paper/plot backgrounds are transparent and font/grid colors
 *  come from the active CSS variables, so charts follow the light/dark toggle. */
export function Plot({ data, layout, height = 380 }: PlotProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(data) + JSON.stringify(layout) + document.documentElement.dataset.theme;

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

  return <div ref={ref} style={{ height }} />;
}
