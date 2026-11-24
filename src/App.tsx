import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ParamState, defaultState, switchOn, num } from './engine/params';
import { runScenario, ScenarioResult, loanAmountFor } from './engine/simulate';
import { runMonteCarlo, McResult } from './engine/monte-carlo';
import { sensitivityAnalysis, SensitivityResult } from './engine/sensitivity';
import { ParamForm } from './ui/ParamForm';
import { Results } from './ui/Results';
import { Logo } from './ui/Logo';
import { fmtEur } from './format';
import {
  applyPreset, PRESETS, fromLocation, toShareUrl,
  localStorageNames, localStorageSave, localStorageLoad, localStorageDelete,
  autosaveState, loadAutosave,
} from './engine/state-io';

export default function App(): JSX.Element {
  const restoredRef = useRef(false);
  const [state, setState] = useState<ParamState>(() => {
    // Priority: shared URL → last session (autosave) → defaults
    const fromUrl = fromLocation();
    if (fromUrl) return fromUrl;
    const last = loadAutosave();
    if (last) {
      restoredRef.current = true;
      return last;
    }
    return defaultState();
  });
  const [nominal, setNominal] = useState<ScenarioResult | null>(null);
  const [mc, setMc] = useState<McResult | null>(null);
  const [sens, setSens] = useState<SensitivityResult | null>(null);
  const [mcRuns, setMcRuns] = useState(1000);
  const [seed, setSeed] = useState(42);
  const [running, setRunning] = useState<'nominal' | 'mc' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [preset, setPreset] = useState('');
  const [mcProgress, setMcProgress] = useState<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  // autosave: persist every state change (debounced) so the next visit restores it
  const autosaveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => autosaveState(state), 250);
    return () => window.clearTimeout(autosaveTimer.current);
  }, [state]);

  // restore notice — only on first mount after loading from the autosave slot
  const [mountedOnce, setMountedOnce] = useState(false);
  useEffect(() => {
    if (mountedOnce) return;
    setMountedOnce(true);
    if (restoredRef.current) showToast('Restored your last session.');
  }, [mountedOnce, showToast]);

  // latest state for use inside long-lived worker callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);

  const getWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL('./mc-worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type: string; id: number; fraction?: number; result?: McResult; error?: string };
      if (msg.type === 'progress') {
        if (msg.id === runIdRef.current) setMcProgress(msg.fraction ?? 0);
        return;
      }
      if (msg.type === 'done') {
        if (msg.id === runIdRef.current) {
          setMc(msg.result ?? null);
          setNominal(runScenario(stateRef.current));
          setSens(sensitivityAnalysis(stateRef.current));
        }
        setMcProgress(null);
        setRunning(null);
        return;
      }
      if (msg.type === 'error') {
        if (msg.error && msg.error !== 'cancelled') {
          window.alert(`Monte Carlo failed: ${msg.error}`);
        }
        setMcProgress(null);
        setRunning(null);
      }
    };
    w.onerror = () => {
      setMcProgress(null);
      setRunning(null);
    };
    workerRef.current = w;
    return w;
  }, []);

  useEffect(() => {
    // Run the nominal scenario once on load so the user sees something immediately.
    setNominal(runScenario(state));
    setSens(sensitivityAnalysis(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const freedCashOn = switchOn(state, 'freed_cash_invested');

  const sonderWarning = useMemo(() => {
    const loan = loanAmountFor(state);
    if (loan <= 0) return null;
    const cap = 0.05 * loan;
    const extra = (loan * num(state, 'sondertilgung_pct')) / 100 + num(state, 'sondertilgung_eur');
    return extra > cap * 1.005 ? { extra, cap } : null;
  }, [state]);

  const runNominal = useCallback(() => {
    setRunning('nominal');
    setTimeout(() => {
      setNominal(runScenario(state));
      setSens(sensitivityAnalysis(state));
      setRunning(null);
    }, 10);
  }, [state]);

  const runMc = useCallback(() => {
    // Sync fallback (no Worker support): run inline as before.
    if (typeof Worker === 'undefined') {
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
      return;
    }
    setRunning('mc');
    setMcProgress(0);
    const id = ++runIdRef.current;
    getWorker().postMessage({ type: 'run', id, state, runs: mcRuns, seed });
  }, [state, mcRuns, seed, getWorker]);

  const cancelMc = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    runIdRef.current++;
    setRunning(null);
    setMcProgress(null);
  }, []);

  const enrolledCount = useMemo(
    () => Object.values(state.mc).filter((m) => m.enabled).length,
    [state.mc],
  );

  const share = useCallback(async () => {
    const url = toShareUrl(state);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard.');
    } catch {
      window.prompt('Copy this link:', url);
    }
  }, [state, showToast]);

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
        <div className="brand">
          <Logo />
          <div>
            <h1>Buy vs. Rent — Mortgage Calculator <span className="de">(Germany)</span></h1>
            <p className="subtitle">
              Deterministic + Monte-Carlo analysis. All data stays in your browser.
            </p>
          </div>
        </div>
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
        {toast && <div className="toast">{toast}</div>}
      </header>

      {!freedCashOn && (
        <div className="warning">
          ⚠️ <strong>“Invest freed cash flow while renting” is switched off.</strong> The renting branch
          no longer invests the money it saves compared to owning — results will be strongly biased
          towards buying.
        </div>
      )}

      {sonderWarning && (
        <div className="warning">
          ⚠️ <strong>Sondertilgung above the usual contract cap.</strong> You set{' '}
          {fmtEur(sonderWarning.extra)}/year, but most contracts allow at most 5 % of the original
          loan ≈ {fmtEur(sonderWarning.cap)}/year. Runs above the cap are unlikely to be granted.
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
          {running === 'mc'
            ? `Simulating… ${mcProgress !== null ? Math.round(mcProgress * 100) + ' %' : ''}`
            : `2 ▶ Run Monte Carlo (${mcRuns})`}
        </button>
        {running === 'mc' && (
          <button className="danger" onClick={cancelMc}>
            ✕ Cancel
          </button>
        )}
        <span className="hint">{enrolledCount} parameter(s) enrolled</span>
        <span className="gap" />
        <button onClick={() => window.print()}>🖨 Print / PDF</button>
      </div>

      <main className="grid">
        <div className="col-params">
          <ParamForm state={state} onChange={setState} />
        </div>
        <div className="col-results">
          <Results nominal={nominal} mc={mc} sens={sens} inflationPct={num(state, 'inflation')} />
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
