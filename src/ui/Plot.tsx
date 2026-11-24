import React, { useEffect, useRef } from 'react';

interface PlotProps {
  data: unknown[];
  layout: Record<string, unknown>;
  height?: number;
}

/** Thin wrapper around plotly.js-dist-min, dynamically imported to keep the bundle small. */
export function Plot({ data, layout, height = 380 }: PlotProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(data) + JSON.stringify(layout);

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    if (!el) return;
    import('plotly.js-dist-min').then(({ default: Plotly }) => {
      if (!alive || !ref.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Plotly.react(ref.current, data as any[], layout as any, { responsive: true, displayModeBar: false });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={ref} style={{ height }} />;
}
