import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ParamState, defaultState, switchOn } from './engine/params';
import { runScenario, ScenarioResult } from './engine/simulate';
import { runMonteCarlo, McResult } from './engine/monte-carlo';
import { sensitivityAnalysis, SensitivityResult } from './engine/sensitivity';
import { ParamForm } from './ui/ParamForm';
import { Results } from './ui/Results';
import {
  applyPreset, PRESETS, fromLocation, toShareUrl,
  localStorageNames, localStorageSave, localStorageLoad, localStorageDelete,
} from './engine/state-io';

export default function App(): JSX.Element {
  const [state, setState] = useState<ParamState>(() => fromLocation() ?? defaultState());
  const [nominal, setNominal] = useState<ScenarioResult | null>(null);
  const [mc, setMc] = useState<McResult | null>(null);
  const [sens, setSens] = useState<SensitivityResult | null>(null);
  const [mcRuns, setMcRuns] = useState(1000);
  const [seed, setSeed] = useState(42);
  const [running, setRunning] = useState<'nominal' | 'mc' | null>(null);
  const [copied, setCopied] = useState(false);
  const [preset, setPreset] = useState('');

  useEffect(() => {
    // Run the nominal scenario once on load so the user sees something immediately.
    setNominal(runScenario(state));
    setSens(sensitivityAnalysis(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const freedCashOn = switchOn(state, 'freed_cash_invested');

  const runNominal = useCallback(() => {
    setRunning('nominal');
    setTimeout(() => {
      setNominal(runScenario(state));
      setSens(sensitivityAnalysis(state));
      setRunning(null);
    }, 10);
  }, [state]);

  const runMc = useCallback(() => {
    setRunning('mc');
    setTimeout(() => {
      try {
        const res = runMonteCarlo(state, { runs: mcRuns, seed });
        setMc(res);
        setNominal(runScenario(state));
        setSens(sensitivityAnalysis(state));
      } finally {
        setRunning(null);
      }
    }, 10);
  }, [state, mcRuns, seed]);

  const enrolledCount = useMemo(
    () => Object.values(state.mc).filter((m) => m.enabled).length,
    [state.mc],
  );

  const share = useCallback(async () => {
    const url = toShareUrl(state);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }, [state]);

  const applyPresetByName = (name: string) => {
    setPreset(name);
    if (!name) return;
    if (name.startsWith('__local:')) {
      loadScenario(name.slice('__local:'.length));
      return;
    }
    const p = PRESETS.find((x) => x.name === name);
    if (p) setState((s) => applyPreset(s, p));
  };

  const saveScenario = () => {
    const name = window.prompt('Scenario name:', preset.startsWith('__local:') ? preset.slice(8) : preset || 'My scenario');
    if (name) {
      localStorageSave(name, state);
      setPreset(`__local:${name}`);
    }
  };

  const loadScenario = (name: string) => {
    const s = localStorageLoad(name);
    if (s) setState(s);
  };

  return (
    <div className="app">
      <header>
        <h1>Buy vs. Rent — Mortgage Calculator <span className="de">(Germany)</span></h1>
        <p className="subtitle">
          Deterministic + Monte-Carlo analysis. All data stays in your browser.
        </p>
        <div className="toolbar">
          <label>
            Preset
            <select value={preset} onChange={(e) => applyPresetByName(e.target.value)}>
              <option value="">— choose —</option>
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
              <optgroup label="Saved scenarios">
                {localStorageNames().map((n) => (
                  <option key={n} value={`__local:${n}`}>{n}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <button onClick={share}>🔗 Share link</button>
          <button onClick={saveScenario}>💾 Save</button>
          <button
            className="danger"
            onClick={() => {
              localStorageNames().forEach(localStorageDelete);
            }}
          >
            🗑 Clear saved
          </button>
          <button onClick={() => setState(defaultState())}>↺ Reset to defaults</button>
        </div>
        {copied && <div className="toast">Link copied to clipboard.</div>}
      </header>

      {!freedCashOn && (
        <div className="warning">
          ⚠️ <strong>“Invest freed cash flow while renting” is switched off.</strong> The renting branch
          no longer invests the money it saves compared to owning — results will be strongly biased
          towards buying.
        </div>
      )}

      <div className="runs-bar">
        <button className="primary" onClick={runNominal} disabled={running !== null}>
          {running === 'nominal' ? 'Running…' : '1 ▶ Run nominal scenario'}
        </button>
        <span className="gap" />
        <input
          type="number"
          min={100}
          max={10000}
          step={100}
          value={mcRuns}
          onChange={(e) => setMcRuns(Math.max(100, Math.min(10000, parseInt(e.target.value || '1000', 10))))}
          title="Number of Monte Carlo runs"
        />
        <label className="seed">
          seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value || '42', 10))}
          />
        </label>
        <button className="primary" onClick={runMc} disabled={running !== null}>
          {running === 'mc' ? `Simulating…` : `2 ▶ Run Monte Carlo (${mcRuns})`}
        </button>
        <span className="hint">{enrolledCount} parameter(s) enrolled</span>
      </div>

      <main className="grid">
        <div className="col-params">
          <ParamForm state={state} onChange={setState} />
        </div>
        <div className="col-results">
          <Results nominal={nominal} mc={mc} sens={sens} />
          <section className="card assumptions">
            <h2>Model assumptions & limits</h2>
            <ul>
              <li>Net worth comparison assumes both branches have the same income; the entire difference in monthly cost of buying vs. renting is invested (or withdrawn) in the renting branch — see plan/app-plan.md §2.5.</li>
              <li>Investment taxes model Abgeltungsteuer with Teilfreistellung and Sparerpauschbetrag at withdrawal/liquidation; no Vorabpauschale.</li>
              <li>Owner-occupied property capital gains are tax-free after §23 EStG's 10-year holding period (toggleable).</li>
              <li>No income tax effects (e.g. no depreciation, no tax deductibility — self-use only).</li>
              <li>Check the parameter tooltips in the form for details on each assumption.</li>
            </ul>
          </section>
        </div>
      </main>

      <footer>
        <span>plan/app-plan.md v0.1 — pure TypeScript, GitHub Pages-ready. No data leaves your browser.</span>
      </footer>
    </div>
  );
}
