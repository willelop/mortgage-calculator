import React from 'react';
import { ScenarioResult } from '../engine/simulate';
import { AmortYear } from '../engine/mortgage';
import { McResult } from '../engine/monte-carlo';
import { SensitivityResult } from '../engine/sensitivity';
import { fmtEur, fmtSignedEur, fmtPct } from '../format';
import { Plot } from './Plot';
import { downloadCsv } from './csv';

interface Props {
  nominal: ScenarioResult | null;
  mc: McResult | null;
  sens: SensitivityResult | null;
  inflationPct: number;
}

const COLORS = {
  buy: '#1a7f4b',
  rent: '#c05621',
};

export function Results({ nominal, mc, sens, inflationPct }: Props): JSX.Element | null {
  const [realTerms, setRealTerms] = React.useState(false);

  /** deflate a value at year index i when real terms are selected */
  const deflate = React.useCallback(
    (v: number, i: number) => (realTerms ? v / Math.pow(1 + inflationPct / 100, i) : v),
    [realTerms, inflationPct],
  );

  if (!nominal) return null;
  const H = nominal.horizon;
  const inf = inflationPct / 100;

  const termsNote = realTerms ? `real terms (today's €, ${fmtPct(inf)} p.a.)` : 'nominal terms';

  const nwBuyShown = nominal.nwBuy.map(deflate);
  const nwRentShown = nominal.nwRent.map(deflate);

  return (
    <div className="results">
      <section className="card">
        <div className="card-head">
          <h2>Nominal scenario — net worth ({termsNote})</h2>
          <label className="terms-toggle" title="Divide all amounts by inflation since today">
            <input
              type="checkbox"
              checked={realTerms}
              onChange={(e) => setRealTerms(e.target.checked)}
            />
            show in real terms (today's €)
          </label>
        </div>
        <div className="keynumbers">
          <Stat label={`Property + investments (buy, ${termsNote})`} value={fmtEur(nominal.nwBuy[nominal.nwBuy.length - 1] / Math.pow(1 + inf, realTerms ? H : 0))} />
          <Stat label={`Portfolio + kaution (rent, ${termsNote})`} value={fmtEur(nominal.nwRent[nominal.nwRent.length - 1] / Math.pow(1 + inf, realTerms ? H : 0))} />
          <Stat
            label={`Difference (buy − rent, ${termsNote})`}
            value={fmtSignedEur(nominal.terminalDiff / Math.pow(1 + inf, realTerms ? H : 0))}
            highlight={nominal.terminalDiff >= 0 ? 'good' : 'bad'}
          />
          <Stat label="Break-even year (buy ≥ rent)" value={nominal.breakEvenYear ? `year ${nominal.breakEvenYear}` : 'not within horizon'} />
          <Stat label="Total mortgage interest" value={fmtEur(nominal.totalInterest)} />
          {nominal.loanAmount > 0 && (
            <Stat
              label={`Restschuld after fixed period (year ${nominal.fixationYear})`}
              value={fmtEur(nominal.restschuldAtFixation)}
            />
          )}
          {nominal.loanAmount > 0 && (
            <Stat
              label={nominal.paymentMode ? 'Implied Anfangstilgung (from payment)' : 'Anfangstilgung'}
              value={` ${fmtPct(nominal.effectiveTilgungPct / 100)} · ${fmtEur(nominal.effectiveMonthlyPayment)}/mo`}
            />
          )}
          <Stat label="Transaction costs" value={fmtEur(nominal.transactionCosts)} />
        </div>
        <Plot
          data={[
            {
              x: nominal.years,
              y: nwBuyShown,
              name: 'Buy',
              mode: 'lines',
              line: { color: COLORS.buy, width: 3 },
            },
            {
              x: nominal.years,
              y: nwRentShown,
              name: 'Rent',
              mode: 'lines',
              line: { color: COLORS.rent, width: 3 },
            },
          ]}
          layout={{
            margin: { l: 70, r: 20, t: 10, b: 50 },
            xaxis: { title: 'Year' },
            yaxis: { title: `Net worth (€${realTerms ? ", today's purchasing power" : ''})`, tickformat: ',.0f' },
            legend: { orientation: 'h' },
            hovermode: 'x',
          }}
        />
      </section>

      {nominal.loanAmount > 0 && <AmortizationSection amort={nominal.amortization} nominal={nominal} />}

      <section className="card">
        <h2>Cumulative cost of staying</h2>
        <Plot
          data={[
            {
              x: nominal.years,
              y: nominal.buyCumCost,
              name: 'Buy (all costs)',
              mode: 'lines',
              stackgroup: undefined,
              line: { color: COLORS.buy },
              fill: 'tozeroy',
            },
            {
              x: nominal.years,
              y: nominal.rentCumCost,
              name: 'Rent (all costs)',
              mode: 'lines',
              line: { color: COLORS.rent },
              fill: 'tozeroy',
            },
          ]}
          layout={{
            margin: { l: 70, r: 20, t: 10, b: 50 },
            xaxis: { title: 'Year' },
            yaxis: { title: 'Cumulative cost (€)', tickformat: ',.0f' },
            legend: { orientation: 'h' },
            hovermode: 'x',
          }}
        />
      </section>

      {mc && <MonteCarloResults mc={mc} deflate={deflate} realTerms={realTerms} inflationPct={inflationPct} />}

      {sens && sens.rows.length > 0 && (
        <section className="card">
          <h2>Sensitivity — what moves the buy−rent outcome most</h2>
          <p className="muted">
            One-at-a-time: each parameter set to its low / high end (MC range if enrolled,
            otherwise ± 10 %), everything else nominal. Baseline difference: {fmtSignedEur(sens.baseDiff)}.
          </p>
          <Plot
            height={Math.max(240, Math.min(sens.rows.length, 14) * 34)}
            data={[
              {
                type: 'bar',
                orientation: 'h',
                y: sens.rows.map((r) => r.label),
                x: sens.rows.map((r) => r.diffAtLow),
                name: 'at low end',
                marker: { color: '#c05621' },
              },
              {
                type: 'bar',
                orientation: 'h',
                y: sens.rows.map((r) => r.label),
                x: sens.rows.map((r) => r.diffAtHigh),
                name: 'at high end',
                marker: { color: '#1a7f4b' },
              },
            ]}
            layout={{
              barmode: 'overlay',
              opacity: 0.85,
              margin: { l: 260, r: 20, t: 10, b: 50 },
              xaxis: { title: 'Terminal net worth difference, buy − rent (€)', tickformat: ',.0f' },
              yaxis: { automargin: true },
              legend: { orientation: 'h' },
            }}
          />
        </section>
      )}
    </div>
  );
}

function MonteCarloResults({
  mc,
  deflate,
  realTerms,
  inflationPct,
}: {
  mc: McResult;
  deflate: (v: number, i: number) => number;
  realTerms: boolean;
  inflationPct: number;
}): JSX.Element {
  const years = mc.years;
  const H = years.length - 1;
  const termsNote = realTerms ? `real terms (today's €, ${fmtPct(inflationPct / 100)} p.a.)` : 'nominal terms';
  return (
    <>
      <section className="card">
        <h2>Monte Carlo — {mc.runs.toLocaleString('de-DE')} simulated futures ({termsNote})</h2>
        <div className="keynumbers">
          <Stat label="Property: buy ends richer" value={fmtPct(mc.probBuyBeats)} highlight={mc.probBuyBeats >= 0.5 ? 'good' : 'bad'} />
          <Stat label="Buy overtakes rent within horizon" value={fmtPct(mc.probBreakeven)} />
          <Stat label="Median break-even year" value={mc.medianBreakEven !== null ? `year ${mc.medianBreakEven}` : '—'} />
          <Stat label="Median terminal diff (buy − rent)" value={fmtSignedEur(deflate(mc.diffBands.p50[years.length - 1], H))} />
          <Stat label="10th–90th pctl terminal diff" value={`${fmtEur(deflate(mc.diffBands.p10[years.length - 1], H))} … ${fmtEur(deflate(mc.diffBands.p90[years.length - 1], H))}`} />
        </div>
        <FanChart mc={mc} deflate={deflate} realTerms={realTerms} />
      </section>

      <section className="card">
        <h2>Terminal wealth difference (buy − rent)</h2>
        <Plot
          data={[
            {
              x: mc.terminalDiff.map((v) => deflate(v, H)),
              type: 'histogram',
              nbinsx: 60,
              marker: { color: '#4a6fa5' },
            },
          ]}
          layout={{
            margin: { l: 70, r: 20, t: 10, b: 50 },
            xaxis: { title: 'Difference at horizon (€)', tickformat: ',.0f' },
            yaxis: { title: 'Runs' },
            bargap: 0.05,
          }}
        />
      </section>

    </>
  );
}

function FanChart({
  mc,
  deflate,
  realTerms,
}: {
  mc: McResult;
  deflate: (v: number, i: number) => number;
  realTerms: boolean;
}): JSX.Element {
  const years = mc.years;
  const def = (arr: number[]) => arr.map(deflate);

  const bandFill = (upper: number[], lower: number[], name: string, color: string) => ({
    x: years,
    y: upper.map(deflate),
    name,
    type: 'scatter',
    mode: 'lines',
    line: { width: 0 },
    fill: 'tonexty' as const,
    fillcolor: color,
    showlegend: false,
    hoverinfo: 'skip' as const,
  });
  const bandStart = (lower: number[], name: string, color: string) => ({
    x: years,
    y: lower.map(deflate),
    name,
    type: 'scatter',
    mode: 'lines',
    line: { width: 0 },
    fill: 'tozeroy' as const,
    fillcolor: color,
    showlegend: false,
    hoverinfo: 'skip' as const,
  });

  return (
    <Plot
      height={460}
      data={[
        // buy bands
        bandStart(mc.buyBands.p10, 'buy 10–90', 'rgba(26,127,75,0.15)'),
        bandFill(mc.buyBands.p90, mc.buyBands.p10, 'buy 10–90', 'rgba(26,127,75,0.15)'),
        bandFill(mc.buyBands.p75, mc.buyBands.p25, 'buy 25–75', 'rgba(26,127,75,0.3)'),
        bandFill(mc.buyBands.p50, mc.buyBands.p25, 'buy median', 'rgba(26,127,75,0.3)'),
        // rent bands
        bandStart(mc.rentBands.p10, 'rent 10–90', 'rgba(192,86,33,0.12)'),
        bandFill(mc.rentBands.p90, mc.rentBands.p10, 'rent 10–90', 'rgba(192,86,33,0.12)'),
        bandFill(mc.rentBands.p75, mc.rentBands.p25, 'rent 25–75', 'rgba(192,86,33,0.25)'),
        bandFill(mc.rentBands.p50, mc.rentBands.p25, 'rent median', 'rgba(192,86,33,0.25)'),
        // medians on top
        {
          x: years,
          y: def(mc.buyBands.p50),
          name: 'Buy (median)',
          type: 'scatter',
          mode: 'lines',
          line: { color: COLORS.buy, width: 2 },
        },
        {
          x: years,
          y: def(mc.rentBands.p50),
          name: 'Rent (median)',
          type: 'scatter',
          mode: 'lines',
          line: { color: COLORS.rent, width: 2 },
        },
      ]}
      layout={{
        margin: { l: 70, r: 20, t: 10, b: 50 },
        xaxis: { title: 'Year' },
        yaxis: { title: `Net worth (€${realTerms ? ", today's purchasing power" : ''})`, tickformat: ',.0f' },
        legend: { orientation: 'h' },
        hovermode: 'x',
      }}
    />
  );
}

const AMORT_COLORS = {
  interest: '#c05621',
  principal: '#1a7f4b',
  sonder: '#4a6fa5',
};

/** Yearly amortization: % of each year's payment going to interest vs principal,
 *  plus the full yearly table (payments, interest, regular amortization,
 *  Sondertilgung, remaining balance). Rows stop when the loan is repaid. */
function AmortizationSection({ amort, nominal }: { amort: AmortYear[]; nominal: ScenarioResult }): JSX.Element {
  const rows = React.useMemo(() => {
    const active = amort.filter((r) => r.payment > 0.005 || r.balanceEnd > 0.005);
    return active.length > 0 ? active : amort;
  }, [amort]);

  const exportAmortCsv = () =>
    downloadCsv(
      'amortization.csv',
      ['Year', 'Payment EUR', 'Interest EUR', 'Amortization EUR', 'Sondertilgung EUR', 'Balance year-end EUR'],
      rows.map((r) => [r.year, r.payment.toFixed(2), r.interest.toFixed(2), r.principal.toFixed(2), r.sondertilgung.toFixed(2), r.balanceEnd.toFixed(2)]),
    );

  const exportAllCsv = () =>
    downloadCsv(
      'buy-vs-rent-yearly.csv',
      ['Year', 'Net worth buy EUR', 'Net worth rent EUR', 'Property value EUR', 'Loan balance EUR', 'Buy cumulative cost EUR', 'Rent cumulative cost EUR'],
      nominal.years.map((y, i) => [
        y,
        nominal.nwBuy[i].toFixed(2),
        nominal.nwRent[i].toFixed(2),
        nominal.propertyValue[i].toFixed(2),
        nominal.loanBalance[i].toFixed(2),
        nominal.buyCumCost[i].toFixed(2),
        nominal.rentCumCost[i].toFixed(2),
      ]),
    );

  const pct = (v: number, total: number) => (total > 0 ? (v / total) * 100 : 0);
  const x = rows.map((r) => r.year);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Amortization — interest vs principal</h2>
        <div className="csv-actions">
          <button onClick={exportAmortCsv}>⬇ CSV: amortization</button>
          <button onClick={exportAllCsv}>⬇ CSV: all yearly data</button>
        </div>
      </div>
      <p className="muted">
        Share of each year's mortgage payment that goes to interest vs. amortization
        (regular annuity repayment and Sondertilgung). Early on the payment is mostly
        interest; the share shifts towards principal over time.
      </p>
      <Plot
        data={[
          {
            x,
            y: rows.map((r) => pct(r.interest, r.payment)),
            name: 'Interest',
            type: 'bar',
            marker: { color: AMORT_COLORS.interest },
          },
          {
            x,
            y: rows.map((r) => pct(r.principal, r.payment)),
            name: 'Amortization (annuity)',
            type: 'bar',
            marker: { color: AMORT_COLORS.principal },
          },
          {
            x,
            y: rows.map((r) => pct(r.sondertilgung, r.payment)),
            name: 'Sondertilgung',
            type: 'bar',
            marker: { color: AMORT_COLORS.sonder },
          },
        ]}
        layout={{
          barmode: 'stack',
          bargap: 0.2,
          margin: { l: 60, r: 20, t: 10, b: 50 },
          xaxis: { title: 'Year' },
          yaxis: { title: '% of yearly payment', range: [0, 100], ticksuffix: '%' },
          legend: { orientation: 'h' },
          hovermode: 'x',
        }}
      />
      <div className="amort-table-wrap">
        <table className="amort-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Payment</th>
              <th>Interest</th>
              <th>Amortization</th>
              <th>Sondertilgung</th>
              <th>Balance (end of year)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year}>
                <td>{r.year}</td>
                <td>{fmtEur(r.payment)}</td>
                <td className="amort-neg">{fmtEur(r.interest)}</td>
                <td className="amort-pos">{fmtEur(r.principal)}</td>
                <td className="amort-sonder">{fmtEur(r.sondertilgung)}</td>
                <td>{fmtEur(r.balanceEnd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'good' | 'bad';
}): JSX.Element {
  return (
    <div className={`stat ${highlight ?? ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
