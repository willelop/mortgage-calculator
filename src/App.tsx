import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MantineProvider, Button, SegmentedControl } from '@mantine/core';
import { mantineTheme } from './ui/mantine-theme';
import { ParamState, defaultState, switchOn, num } from './engine/params';
import { runScenario, ScenarioResult, loanAmountFor } from './engine/simulate';
import { ltvSurchargePct } from './engine/mortgage';
import { runMonteCarlo, McResult } from './engine/monte-carlo';
import { sensitivityAnalysis, SensitivityResult } from './engine/sensitivity';
import { ParamForm } from './ui/ParamForm';
import { PrintOnePager } from './ui/PrintOnePager';
import { Results } from './ui/Results';
import { Toolbar } from './ui/Toolbar';
import { RunsBar } from './ui/RunsBar';
import { Warnings } from './ui/Warnings';
import { Logo } from './ui/Logo';
import { initialTheme, applyTheme, Theme } from './theme';
import { fmtEur } from './format';
import { useLang, setLang } from './i18n';
import {
  applyPreset, PRESETS, fromLocation, fromLocationAsync, toShareUrlAsync,
  localStorageSave, localStorageLoad,
  autosaveState, loadAutosave,
} from './engine/state-io';

export default function App(): JSX.Element {
  const restoredRef = useRef(false);
  const [theme, setTheme] = useState<Theme>(() => initialTheme());
  const lang = useLang();
  const de = lang === 'de';

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next); // set the DOM attribute before the re-render so charts recolor correctly
    setTheme(next);
  }, [theme]);
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
  // main toggle: inputs or results. Both columns stay mounted; inactive is hidden.
  const [mainTab, setMainTab] = useState<'inputs' | 'results'>('inputs');
  // scenario comparison (roadmap 4c): name of a saved scenario shown side by side
  const [compareName, setCompareName] = useState<string | null>(null);

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

  // compressed share link (roadmap 3b): the sync decode can't inflate it, so
  // re-check asynchronously once mounted and apply the state if it decodes
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get('s')) return;
    if (fromLocation()) return; // plain link already applied synchronously
    let alive = true;
    fromLocationAsync().then((s) => {
      if (alive && s) {
        restoredRef.current = true;
        setState(s);
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // restore notice — only on first mount after loading from the autosave slot
  const [mountedOnce, setMountedOnce] = useState(false);
  useEffect(() => {
    if (mountedOnce) return;
    setMountedOnce(true);
    if (restoredRef.current) showToast(de ? 'Letzte Sitzung wiederhergestellt.' : 'Restored your last session.');
  }, [mountedOnce, showToast, de]);

  // PWA service worker (roadmap 4d): production only, never under automation
  // (Playwright/webdriver) so e2e runs stay deterministic. When an updated
  // worker takes control (skipWaiting + clients.claim in sw.js), tell the user.
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    if ((navigator as { webdriver?: boolean }).webdriver) return;
    let alive = true;
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* registration failed (e.g. insecure context) — the app works without */
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (alive) {
        showToast(
          de ? '🔄 Neue Version installiert — bitte neu laden.' : '🔄 New version installed — please reload.',
        );
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast, de]);

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
          setMainTab('results');
        }
        setMcProgress(null);
        setRunning(null);
        return;
      }
      if (msg.type === 'error') {
        if (msg.error && msg.error !== 'cancelled') {
          window.alert(`${msg.error.includes('Monte Carlo failed') ? msg.error : de ? 'Monte Carlo fehlgeschlagen: ' + msg.error : 'Monte Carlo failed: ' + msg.error}`);
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
    // language only affects the error text shown — safe to read at first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!switchOn(state, 'sondertilgung_cap_pct')) return null; // cap check switched off
    const capPct = num(state, 'sondertilgung_cap_pct');
    const cap = (capPct / 100) * loan;
    const extra = (loan * num(state, 'sondertilgung_pct')) / 100 + num(state, 'sondertilgung_eur');
    return extra > cap * 1.005 ? { extra, cap, capPct } : null;
  }, [state]);

  // payment-mode guard: desired payment must exceed the initial interest
  // (annuity shape only — grace years are interest-only by design)
  const paymentWarning = useMemo(() => {
    if (Math.round(num(state, 'tilgung_mode')) !== 1) return null;
    if (Math.round(num(state, 'tilgung_shape')) !== 0) return null;
    const loan = loanAmountFor(state);
    if (loan <= 0) return null;
    const price = num(state, 'property_price');
    const ltv = loan / Math.max(1, price);
    const rate = num(state, 'fixed_rate') + (switchOn(state, 'ltv_rate_surcharge') ? ltvSurchargePct(ltv) : 0);
    const interestOnly = (loan * rate) / 100 / 12;
    const mp = num(state, 'monthly_payment');
    return mp <= interestOnly * 1.0005
      ? { interestOnly, mp }
      : null;
  }, [state]);

  const runNominal = useCallback(() => {
    setRunning('nominal');
    setTimeout(() => {
      setNominal(runScenario(state));
      setSens(sensitivityAnalysis(state));
      setRunning(null);
      setMainTab('results');
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
          setMainTab('results');
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

  // scenario comparison (roadmap 4c): run the saved scenario once per selection
  const compareResult = useMemo<ScenarioResult | null>(() => {
    if (!compareName) return null;
    const saved = localStorageLoad(compareName);
    return saved ? runScenario(saved) : null;
  }, [compareName]);

  const share = useCallback(async () => {
    const url = await toShareUrlAsync(state);
    try {
      await navigator.clipboard.writeText(url);
      showToast(de ? 'Link in die Zwischenablage kopiert.' : 'Link copied to clipboard.');
    } catch {
      window.prompt(de ? 'Link kopieren:' : 'Copy this link:', url);
    }
  }, [state, showToast, de]);

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
    const name = window.prompt(
      de ? 'Szenario-Name:' : 'Scenario name:',
      preset.startsWith('__local:') ? preset.slice(8) : preset || (de ? 'Mein Szenario' : 'My scenario'),
    );
    if (name) {
      localStorageSave(name, state);
      setPreset(`__local:${name}`);
    }
  };

  const loadScenario = (name: string) => {
    const s = localStorageLoad(name);
    if (s) setState(s);
  };

  // scenario comparison (roadmap 4c): empty name ends the comparison
  const handleCompare = (name: string) => {
    if (!name) {
      setCompareName(null);
      return;
    }
    setCompareName(name);
    setMainTab('results');
  };

  // chart re-fitting after tab switches is handled by the ResizeObserver in Plot.tsx

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme={theme}>
    <div className="app">
      <header>
        <div className="brand">
          <Logo />
          <div>
            <h1>{de ? 'Mieten oder Kaufen — Immobilienrechner' : 'Buy vs. Rent — Mortgage Calculator'} <span className="de">({de ? 'Deutschland' : 'Germany'})</span></h1>
            <p className="subtitle">
              {de
                ? 'Deterministische + Monte-Carlo-Analyse. Alle Daten bleiben in deinem Browser.'
                : 'Deterministic + Monte-Carlo analysis. All data stays in your browser.'}
            </p>
          </div>
        </div>
        <Toolbar
          lang={lang}
          theme={theme}
          state={state}
          preset={preset}
          compareName={compareName}
          onToggleLang={() => setLang(de ? 'en' : 'de')}
          onToggleTheme={toggleTheme}
          onPreset={applyPresetByName}
          onShare={share}
          onSave={saveScenario}
          onReset={() => setState(defaultState())}
          onStateChange={setState}
          onCompare={handleCompare}
        />
        {toast && <div className="toast">{toast}</div>}
      </header>

      <Warnings
        lang={lang}
        freedCashOn={freedCashOn}
        sonderWarning={sonderWarning}
        paymentWarning={paymentWarning}
      />

      <RunsBar
        lang={lang}
        running={running}
        mcRuns={mcRuns}
        seed={seed}
        mcProgress={mcProgress}
        enrolledCount={enrolledCount}
        onRunNominal={runNominal}
        onRunMc={runMc}
        onCancelMc={cancelMc}
        onMcRunsChange={setMcRuns}
        onSeedChange={setSeed}
      />

      <div className="main-tabs">
        <SegmentedControl
          aria-label={de ? 'Hauptbereich' : 'Main area'}
          fullWidth
          size="md"
          value={mainTab}
          onChange={(v) => setMainTab(v as 'inputs' | 'results')}
          data={[
            { value: 'inputs', label: de ? '✏️ Eingaben' : '✏️ Inputs' },
            { value: 'results', label: de ? '📊 Ergebnisse' : '📊 Results' },
          ]}
        />
      </div>

      <main className={`grid ${mainTab === 'inputs' ? 'inputs-only' : 'results-only'}${compareName && compareResult ? ' compare-mode' : ''}`}>
        {nominal && <PrintOnePager nominal={nominal} sens={sens} inflationPct={num(state, 'inflation')} />}
        <div className="col-params" hidden={mainTab !== 'inputs'}>
          <ParamForm state={state} onChange={setState} />
        </div>
        <div className="col-results" hidden={mainTab !== 'results'}>
          <Results nominal={nominal} mc={mc} sens={sens} inflationPct={num(state, 'inflation')} />
          <section className="card assumptions">
            <h2>{de ? 'Modellannahmen & Grenzen' : 'Model assumptions & limits'}</h2>
            <ul>
              {de ? (
                <>
                  <li>Der Vermögensvergleich setzt in beiden Zweigen denselben Verzicht voraus; die gesamte monatliche Kostendifferenz zwischen Kaufen und Mieten wird mietend angelegt (oder entnommen).</li>
                  <li>Die Anlagesteuern modellieren Abgeltungsteuer mit Teilfreistellung und Sparerpauschbetrag bei Entnahme/Verkauf; die Vorabpauschale wird jährlich erhoben (abschaltbar).</li>
                  <li>Kursgewinne der selbstgenutzten Immobilie sind nach der 10-Jahres-Frist des § 23 EStG steuerfrei (abschaltbar).</li>
                  <li>Keine Einkommensteuer-Effekte (z. B. keine Abschreibung, keine steuerliche Absetzbarkeit — nur Selbstnutzung).</li>
                  <li>Details zu jeder Annahme stehen in den Parameter-Tooltips des Formulars.</li>
                </>
              ) : (
                <>
                  <li>Net worth comparison assumes both branches have the same income; the entire difference in monthly cost of buying vs. renting is invested (or withdrawn) in the renting branch.</li>
                  <li>Investment taxes model Abgeltungsteuer with Teilfreistellung and Sparerpauschbetrag at withdrawal/liquidation; the Vorabpauschale is levied annually (toggleable).</li>
                  <li>Owner-occupied property capital gains are tax-free after §23 EStG&apos;s 10-year holding period (toggleable).</li>
                  <li>No income tax effects (e.g. no depreciation, no tax deductibility — self-use only).</li>
                  <li>Check the parameter tooltips in the form for details on each assumption.</li>
                </>
              )}
            </ul>
          </section>
        </div>
        {compareName && compareResult && (
          <div className="col-results col-compare">
            <div className="compare-head">
              <strong>⚖ {de ? 'Vergleich mit' : 'Compared with'}: {compareName}</strong>
              <Button variant="default" size="xs" onClick={() => setCompareName(null)}>
                ✕ {de ? 'Vergleich beenden' : 'End comparison'}
              </Button>
            </div>
            <Results nominal={compareResult} mc={null} sens={null} inflationPct={num(state, 'inflation')} />
          </div>
        )}
      </main>

      <footer>
        <span>{de ? '100 % client-seitig, mit KI generiert (Mistral Vibe) — bereit für GitHub Pages. Keine Daten verlassen deinen Browser.' : '100 % client-side, generated with AI (Mistral Vibe) — GitHub Pages-ready. No data leaves your browser.'}</span>
      </footer>
    </div>
    </MantineProvider>
  );
}
