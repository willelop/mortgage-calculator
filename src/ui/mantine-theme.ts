import { MantineThemeOverride } from '@mantine/core';

/**
 * Mantine theme: "Modern sleek" — neutral, restrained, precise.
 * One purple accent, hairline borders, small radii, quiet shadows.
 * Pairs with the tokens in src/styles.css.
 */
export const mantineTheme: MantineThemeOverride = {
  colors: {
    brand: [
      '#f5f0fc',
      '#e9defa',
      '#d2bdf4',
      '#b99bee',
      '#9e77e6',
      '#8b5ee0',
      '#7d4edb',
      '#7040c7',
      '#5e34a8',
      '#4a2884',
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
  defaultGradient: { from: '#7d4edb', to: '#5e34a8', deg: 180 },
};
