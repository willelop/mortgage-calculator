const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurLong = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: 'compact' });

export function fmtEur(x: number): string {
  return eur.format(Math.round(x));
}

export function fmtEurCompact(x: number): string {
  if (Math.abs(x) >= 100_000) return eurLong.format(x);
  return eur.format(Math.round(x));
}

export function fmtPct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)} %`;
}

export function fmtSignedEur(x: number): string {
  const sign = x > 0 ? '+' : '';
  return sign + eur.format(Math.round(x));
}
