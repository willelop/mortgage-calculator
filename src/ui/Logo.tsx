import React from 'react';

/** Inline SVG logo: house with a rising net-worth line (ledger/ink style). */
export function Logo({ size = 44 }: { size?: number }): JSX.Element {
  return (
    <svg
      className="logo"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Buy vs Rent logo"
    >
      {/* roof — follows the theme ink color */}
      <path d="M6 30 L32 8 L58 30" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
      {/* walls */}
      <path d="M14 30 v26 h36 v-26" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="square" strokeLinejoin="miter" />
      {/* rising line chart inside — vermillion accent */}
      <path d="M20 48 C26 46 27 42 31 40 C35 38 36 33 44 30" fill="none" stroke="#cc3f00" strokeWidth="4" strokeLinecap="square" />
      {/* vermillion dot doubles as a ledger correction mark */}
      <rect x="40.6" y="26.6" width="6.8" height="6.8" fill="#cc3f00" />
    </svg>
  );
}
