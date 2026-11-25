import { MantineThemeOverride } from '@mantine/core';

/** Shared Mantine theme: brand green + system font, matching `src/styles.css`. */
export const mantineTheme: MantineThemeOverride = {
  colors: {
    brand: [
      '#e6f5ee',
      '#bfdccf',
      '#92bfae',
      '#67a28e',
      '#418870',
      '#2b745d',
      '#256b55',
      '#0e8a54',
      '#0e8a54',
      '#0b6f43',
    ],
  },
  primaryColor: 'brand',
  defaultRadius: 'md',
  headings: { fontWeight: '600' },
  fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
};
