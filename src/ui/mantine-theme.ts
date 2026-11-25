import { MantineThemeOverride } from '@mantine/core';

/**
 * Mantine theme: "Kontrollblatt" design — Swiss-ledger print look.
 * Square corners, vermillion actions, ink as the framing color,
 * serif display headings. Pairs with the tokens in src/styles.css.
 */
export const mantineTheme: MantineThemeOverride = {
  colors: {
    brand: [
      '#fbeadd',
      '#f5cfae',
      '#efb183',
      '#e8915c',
      '#e07648',
      '#d85f38',
      '#d14a19',
      '#cc3f00',
      '#b23700',
      '#8f2c00',
    ],
  },
  primaryColor: 'brand',
  primaryShade: 7,
  defaultRadius: 0,
  radius: { xs: '0', sm: '0', md: '0', lg: '0', xl: '0' },
  fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  headings: {
    fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
    fontWeight: '700',
  },
};
