import React from 'react';
import { ScenarioResult } from '../engine/simulate';
import { SensitivityResult } from '../engine/sensitivity';
import { fmtEur, fmtSignedEur, fmtPct } from '../format';
import { useLang } from '../i18n';

interface Props {
  nominal: ScenarioResult;
  sens: SensitivityResult | null;
  inflationPct: number;
}

/**
 * Entscheidungsvorlage (roadmap 4a): a print-only one-pager. Hidden on
 * screen; under `@media print` it is prepended to the printed output so a
 * "Print / PDF" produces a shareable decision sheet with the headline
 * numbers, the deltas that matter, and the strongest sensitivities.
 */
export function PrintOnePager({ nominal, sens, inflationPct }: Props): JSX.Element | null {
  const lang = useLang();
  const de = lang === 'de';

  const last = nominal.nwBuy.length - 1;
  const buy = nominal.nwBuy[last];
  const rent = nominal.nwRent[last];
  const top3 = sens
    ? [...sens.rows].sort((a, b) => b.impact - a.impact).slice(0, 3)
    : [];

  const Row = ({ label, value }: { label: string; value: string }) => (
    <tr className="pop-row">
      <td>{label}</td>
      <td><strong>{value}</strong></td>
    </tr>
  );

  return (
    <section className="print-onepager" aria-hidden="true">
      {/* styled paragraph, not an <h1>: the page already has one and this block is print-only */}
      <p className="pop-title">{de ? 'Entscheidungsvorlage — Kaufen oder mieten?' : 'Decision sheet — buy or rent?'}</p>
      <p className="pop-date">
        {de ? 'Stand' : 'As of'} {new Date().toLocaleDateString(de ? 'de-DE' : 'en-GB')}
        {' · '}
        {de ? 'nominales Szenario, heutige €' : 'nominal scenario, today’s €'}
        {' · '}
        {fmtPct(inflationPct / 100)} {de ? 'Inflation' : 'inflation'}
      </p>

      <table>
        <thead>
          <tr>
            <th>{de ? 'Kennzahl' : 'Metric'}</th>
            <th>{de ? 'Wert' : 'Value'}</th>
          </tr>
        </thead>
        <tbody>
          <Row label={de ? 'Nettovermögen Kaufen (Ende Horizont)' : 'Net worth — buy (end of horizon)'} value={fmtEur(buy)} />
          <Row label={de ? 'Nettovermögen Mieten (Ende Horizont)' : 'Net worth — rent (end of horizon)'} value={fmtEur(rent)} />
          <Row label={de ? 'Differenz (Kaufen − Mieten)' : 'Difference (buy − rent)'} value={fmtSignedEur(nominal.terminalDiff)} />
          <Row
            label={de ? 'Break-even-Jahr' : 'Break-even year'}
            value={nominal.breakEvenYear !== null ? `${nominal.breakEvenYear}` : de ? 'nicht im Horizont' : 'not within horizon'}
          />
          <Row label={de ? 'Monatliche Rate an die Bank' : 'Monthly payment to the bank'} value={fmtEur(nominal.effectiveMonthlyPayment)} />
          <Row label={de ? 'Gesamte Zinslast' : 'Total mortgage interest'} value={fmtEur(nominal.totalInterest)} />
          <Row label={de ? 'Kaufnebenkosten (einmalig)' : 'Transaction costs (one-off)'} value={fmtEur(nominal.transactionCosts)} />
          {nominal.loanAmount > 0 && (
            <Row
              label={de ? `Restschuld nach Zinsbindung (Jahr ${nominal.fixationYear})` : `Restschuld after fixed period (year ${nominal.fixationYear})`}
              value={fmtEur(nominal.restschuldAtFixation)}
            />
          )}
        </tbody>
      </table>

      {top3.length > 0 && (
        <>
          <h2>{de ? 'Die drei größten Hebel' : 'The three biggest levers'}</h2>
          <table>
            <thead>
              <tr>
                <th>{de ? 'Parameter' : 'Parameter'}</th>
                <th>{de ? 'Schwankung des Ergebnisses' : 'Outcome swing'}</th>
              </tr>
            </thead>
            <tbody>
              {top3.map((r) => (
                <tr className="pop-row" key={r.key}>
                  <td>{r.label}</td>
                  <td><strong>{fmtEur(r.impact)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="pop-foot">
        {de
          ? 'Erstellt mit dem Buy-vs-Rent-Rechner (Open Source). Alle Werte sind Modellannahmen, keine Beratung.'
          : 'Created with the buy-vs-rent calculator (open source). All values are model assumptions, not advice.'}
      </p>
    </section>
  );
}
