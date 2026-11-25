import React from 'react';

/** Inline SVG logo: house with a rising net-worth line. */
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
      <defs>
        <linearGradient id="logo-roof" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#27b370" />
          <stop offset="100%" stopColor="#0e8a54" />
        </linearGradient>
      </defs>
      {/* roof */}
      <path d="M6 30 L32 8 L58 30" fill="none" stroke="url(#logo-roof)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {/* walls — currentColor follows the theme text color */}
      <path d="M14 30 v26 h36 v-26" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* rising line chart inside */}
      <path d="M20 48 C26 46 27 42 31 40 C35 38 36 33 44 30" fill="none" stroke="#c05e21" strokeWidth="4" strokeLinecap="round" />
      <circle cx="44" cy="30" r="3.4" fill="#c05e21" />
    </svg>
  );
}
