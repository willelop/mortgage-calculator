import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MantineProvider, Button, ActionIcon, SegmentedControl, NumberInput } from '@mantine/core';
import { mantineTheme } from './ui/mantine-theme';
import { ParamState, defaultState, switchOn, num } from './engine/params';
import { runScenario, ScenarioResult, loanAmountFor } from './engine/simulate';
import { ltvSurchargePct } from './engine/mortgage';
import { runMonteCarlo, McResult } from './engine/monte-carlo';
import { sensitivityAnalysis, SensitivityResult } from './engine/sensitivity';
import { ParamForm } from './ui/ParamForm';
import { PrintOnePager } from './ui/PrintOnePager';
import { OptionsMenu } from './ui/OptionsMenu';
import { Results } from './ui/Results';
import { Logo } from './ui/Logo';
import { initialTheme, applyTheme, Theme } from './theme';
import { fmtEur } from './format';
import { useLang, setLang } from './i18n';
import {
  applyPreset, PRESETS, fromLocation, fromLocationAsync, toShareUrlAsync, presetName, presetDescription,
  localStorageNames, localStorageSave, localStorageLoad, localStorageDelete,
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

  // Plotly measures its container while the results column is hidden (width 0);
  // nudge the responsive charts after switching to Results so they fill the column.
  useEffect(() => {
    if (mainTab !== 'results') return;
    window.dispatchEvent(new Event('resize'));
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
    return () => window.clearTimeout(t);
  }, [mainTab]);

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
        <div className="toolbar">
          <ActionIcon
            variant="default"
            size="lg"
            radius="xl"
            onClick={() => setLang(de ? 'en' : 'de')}
            title={de ? 'Switch to English' : 'Zu Deutsch wechseln'}
            aria-label={de ? 'Switch to English' : 'Zu Deutsch wechseln'}
          >
            {de ? '🇬🇧' : '🇩🇪'}
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="lg"
            radius="xl"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </ActionIcon>
          <label>
            {de ? 'Voreinstellung' : 'Preset'}
            <select value={preset} onChange={(e) => applyPresetByName(e.target.value)}>
              <option value="">{de ? '— wählen —' : '— choose —'}</option>
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name} title={presetDescription(p, lang)}>{presetName(p, lang)}</option>
              ))}
              <optgroup label={de ? 'Gespeicherte Szenarien' : 'Saved scenarios'}>
                {localStorageNames().map((n) => (
                  <option key={n} value={`__local:${n}`}>{n}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <Button variant="default" onClick={share}>🔗 {de ? 'Link teilen' : 'Share link'}</Button>
          <Button variant="default" onClick={saveScenario}>💾 {de ? 'Speichern' : 'Save'}</Button>
          <Button variant="light" color="red" onClick={() => {
              localStorageNames().forEach(localStorageDelete);
            }}>
            🗑 {de ? 'Gespeichertes löschen' : 'Clear saved'}
          </Button>
          <Button variant="default" onClick={() => setState(defaultState())}>↺ {de ? 'Auf Standardwerte zurücksetzen' : 'Reset to defaults'}</Button>
          <OptionsMenu state={state} onChange={setState} />
          <Button variant="default" onClick={() => window.print()}>🖨 {de ? 'Drucken / PDF' : 'Print / PDF'}</Button>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </header>

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

      <div className="runs-bar">
        <div className="run-group">
          <span className="run-group-label">{de ? 'Deterministisches Szenario' : 'Deterministic scenario'}</span>
          <Button variant="filled" color="brand" onClick={runNominal} disabled={running !== null}>
            {running === 'nominal' ? (de ? 'Läuft…' : 'Running…') : '▶ ' + (de ? 'Starten' : 'Run')}
          </Button>
          <span className="hint">{de ? 'ein Durchlauf mit exakt deinen Eingaben' : 'one pass with your exact inputs'}</span>
        </div>
        <div className="run-group">
          <span className="run-group-label">🎲 Monte Carlo</span>
          <NumberInput
            w={110}
            size="xs"
            min={100}
            max={10000}
            step={100}
            value={mcRuns}
            aria-label={de ? 'Anzahl der Monte-Carlo-Läufe' : 'Number of Monte Carlo runs'}
            onChange={(v) => setMcRuns(Math.max(100, Math.min(10000, Number(v) || 1000)))}
          />
          <NumberInput
            w={110}
            size="xs"
            value={seed}
            aria-label={de ? 'Zufalls-Seed' : 'Random seed'}
            onChange={(v) => setSeed(Number(v) || 42)}
          />
          <span className="hint">{enrolledCount} {de ? 'Parameter enrolliert' : 'parameter(s) enrolled'}</span>
          <Button variant="filled" color="brand" onClick={runMc} disabled={running !== null}>
            {running === 'mc'
              ? (de ? `Simuliere… ${mcProgress !== null ? Math.round(mcProgress * 100) + ' %' : ''}` : `Simulating… ${mcProgress !== null ? Math.round(mcProgress * 100) + ' %' : ''}`)
              : '▶ ' + (de ? 'Starten' : 'Run')}
          </Button>
          {running === 'mc' && (
            <Button variant="light" color="red" onClick={cancelMc}>
              ✕ {de ? 'Abbrechen' : 'Cancel'}
            </Button>
          )}
        </div>
      </div>

      <div className="main-tabs">
        <SegmentedControl
          aria-label={de ? 'Hauptbereich' : 'Main area'}
          value={mainTab}
          onChange={(v) => setMainTab(v as 'inputs' | 'results')}
          data={[
            { value: 'inputs', label: de ? '✏️ Eingaben' : '✏️ Inputs' },
            { value: 'results', label: de ? '📊 Ergebnisse' : '📊 Results' },
          ]}
        />
      </div>

      <main className={`grid ${mainTab === 'inputs' ? 'inputs-only' : 'results-only'}`}>
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
                  <li>Die Anlagesteuern modellieren Abgeltungsteuer mit Teilfreistellung und Sparerpauschbetrag bei Entnahme/Verkauf; keine Vorabpauschale.</li>
                  <li>Kursgewinne der selbstgenutzten Immobilie sind nach der 10-Jahres-Frist des § 23 EStG steuerfrei (abschaltbar).</li>
                  <li>Keine Einkommensteuer-Effekte (z. B. keine Abschreibung, keine steuerliche Absetzbarkeit — nur Selbstnutzung).</li>
                  <li>Details zu jeder Annahme stehen in den Parameter-Tooltips des Formulars.</li>
                </>
              ) : (
                <>
                  <li>Net worth comparison assumes both branches have the same income; the entire difference in monthly cost of buying vs. renting is invested (or withdrawn) in the renting branch.</li>
                  <li>Investment taxes model Abgeltungsteuer with Teilfreistellung and Sparerpauschbetrag at withdrawal/liquidation; no Vorabpauschale.</li>
                  <li>Owner-occupied property capital gains are tax-free after §23 EStG&apos;s 10-year holding period (toggleable).</li>
                  <li>No income tax effects (e.g. no depreciation, no tax deductibility — self-use only).</li>
                  <li>Check the parameter tooltips in the form for details on each assumption.</li>
                </>
              )}
            </ul>
          </section>
        </div>
      </main>

      <footer>
        <span>{de ? '100 % client-seitig, mit KI generiert (Mistral Vibe) — bereit für GitHub Pages. Keine Daten verlassen deinen Browser.' : '100 % client-side, generated with AI (Mistral Vibe) — GitHub Pages-ready. No data leaves your browser.'}</span>
      </footer>
    </div>
    </MantineProvider>
  );
}
