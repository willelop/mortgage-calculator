import React from 'react';
import { fmtEur } from '../format';

export interface SonderWarning { extra: number; cap: number; capPct: number }
export interface PaymentWarning { interestOnly: number; mp: number }

interface Props {
  lang: 'de' | 'en';
  freedCashOn: boolean;
  sonderWarning: SonderWarning | null;
  paymentWarning: PaymentWarning | null;
}

/** The three model-guardrail warnings between header and runs bar (roadmap 5a). */
export function Warnings({ lang, freedCashOn, sonderWarning, paymentWarning }: Props): JSX.Element {
  const de = lang === 'de';
  return (
    <>
      {!freedCashOn && (
        <div className="warning">
          ⚠️ <strong>“{de ? 'Gesparte Differenz mietend anlegen' : 'Invest freed cash flow while renting'}” {de ? 'ist ausgeschaltet.' : 'is switched off.'}</strong>{' '}
          {de
            ? 'Der Mietzweig legt die gesparte Differenz gegenüber dem Kaufen nicht mehr an — die Ergebnisse fallen stark kaufsfreundlich verzerrt aus.'
            : 'The renting branch no longer invests the money it saves compared to owning — results will be strongly biased towards buying.'}
        </div>
      )}

      {sonderWarning && (
        <div className="warning">
          ⚠️ <strong>{de ? 'Sondertilgung über der üblichen Konditionsobergrenze.' : 'Sondertilgung above the usual contract cap.'}</strong>{' '}
          {de ? 'Du setzt' : 'You set'} {fmtEur(sonderWarning.extra)}/{de ? 'Jahr' : 'year'}, {de ? `aber deine Sondertilgungs-Klausel erlaubt höchstens ${sonderWarning.capPct} % des ursprünglichen Darlehens ≈` : `but your Sondertilgung clause allows at most ${sonderWarning.capPct} % of the original loan ≈`} {fmtEur(sonderWarning.cap)}/{de ? 'Jahr' : 'year'}.{' '}
          {de ? 'Werte über der Grenze werden Banken kaum genehmigen.' : 'Runs above the cap are unlikely to be granted.'}
        </div>
      )}

      {paymentWarning && (
        <div className="warning">
          ⚠️ <strong>{de ? 'Die Monatsrate deckt die anfänglichen Zinsen nicht.' : "The monthly payment does not cover the initial interest."}</strong>{' '}
          {de ? 'Bei deinem aktuellen Darlehen betragen die Zinsen allein ≈' : 'At your current loan the interest alone is ≈'} {fmtEur(paymentWarning.interestOnly)}{de ? '/Monat' : '/month'}, {de ? 'aber du setzt' : 'but you set'} {fmtEur(paymentWarning.mp)}{de ? '/Monat — das Darlehen würde nie getilgt (und die Bank würde es nicht vergeben). Erhöhe Rate oder Eigenkapital.' : "/month — the loan would never amortize (and the bank wouldn't grant it). Raise the payment or the equity."}
        </div>
      )}
    </>
  );
}
