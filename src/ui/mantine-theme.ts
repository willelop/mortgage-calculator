import { MantineThemeOverride } from '@mantine/core';

/**
 * Mantine theme: "Modern sleek" — neutral, restrained, precise.
 * One emerald accent, hairline borders, small radii, quiet shadows.
 * Pairs with the tokens in src/styles.css.
 */
export const mantineTheme: MantineThemeOverride = {
  colors: {
    brand: [
      '#e6f4ee',
      '#c2e2d3',
      '#9ccfb7',
      '#77bb9a',
      '#54a97f',
      '#3c986c',
      '#2f8d61',
      '#278357',
      '#1f744b',
      '#175c3b',
    ],
  },
  primaryColor: 'brand',
  primaryShade: 8,
  defaultRadius: 'md',
  radius: { xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px' },
  fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  headings: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    fontWeight: '600',
  },
  defaultGradient: { from: '#2f8d61', to: '#1f744b', deg: 180 },
};
