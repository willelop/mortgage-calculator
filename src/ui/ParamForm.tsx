import React, { useEffect, useRef, useState } from 'react';
import { Tabs, Slider } from '@mantine/core';
import { PARAM_DEFS, GROUP_ORDER, iconOf, Group, ParamDef, ParamState, McSpec, Dist, groupLabel, labelOf, helpOf, selectOptionLabel } from '../engine/params';
import { useLang } from '../i18n';
import { HelpTip } from './HelpTip';

/** Headline inputs that also get a slider (roadmap 4b): value input stays the
 *  source of truth; the slider mirrors and drives it (linked both ways). */
const SLIDER_PARAMS = new Set(['property_price', 'equity', 'fixed_rate', 'fixed_years']);

interface Props {
  state: ParamState;
  onChange: (next: ParamState) => void;
}

type Setter = (key: string, patch: Partial<{ value: number; on: boolean; mc: McSpec }>) => void;

const DIST_LABELS: Record<Dist, string> = {
  lognormal: 'Lognormal',
  normal: 'Normal',
  uniform: 'Uniform',
  triangular: 'Triangular',
};

const DIST_LABELS_DE: Record<Dist, string> = {
  lognormal: 'Lognormal',
  normal: 'Normal',
  uniform: 'Gleichverteilt',
  triangular: 'Dreieck',
};

/** parameter groups shown on the main form (correlations live in Monte Carlo) */
const MAIN_GROUPS: Group[] = GROUP_ORDER.filter((g) => g !== 'correlations');

/** label of the Monte-Carlo section, kept out of Group for tab typing */
type Section = Group | 'mc';
const SECTIONS: Section[] = [...MAIN_GROUPS, 'mc'];

export function ParamForm({ state, onChange }: Props): JSX.Element {
  const lang = useLang();

  const set: Setter = (key, patch) => {
    const next: ParamState = {
      values: { ...state.values },
      on: { ...state.on },
      mc: { ...state.mc },
    };
    if (patch.value !== undefined) next.values[key] = patch.value;
    if (patch.on !== undefined) next.on[key] = patch.on;
    if (patch.mc !== undefined) next.mc[key] = patch.mc;
    onChange(next);
  };

  const [tab, setTab] = useState<Section>(MAIN_GROUPS[0]);

  const visible = (d: ParamDef) => !d.visibleWhen || d.visibleWhen(state.values);
  const isOn = (d: ParamDef) =>
    d.kind === 'switch' ? state.values[d.key] !== 0 : state.on[d.key] ?? d.defaultOn ?? true;

  const groupDefs = (g: Group) =>
    PARAM_DEFS.filter((d) => d.group === g && d.kind !== 'switch' && visible(d));
  const mcDefs = () =>
    MAIN_GROUPS.flatMap((g) =>
      PARAM_DEFS.filter((d) => d.group === g && d.mcable && visible(d)),
    );
  const enrolled = () => mcDefs().filter((d) => state.mc[d.key]?.enabled ?? false).length;

  const countOf = (s: Section) =>
    s === 'mc' ? enrolled() : groupDefs(s).length;

  /** Tab titles: the MC section is not a Group, so title it here. */
  const tabTitle = (s: Section) => (s === 'mc' ? 'Monte Carlo' : groupLabel(s, lang));

  const sectionBody = (s: Section): JSX.Element =>
    s === 'mc' ? (
      <>
        <p className="muted tab-hint">
          {lang === 'de'
            ? 'Wähle, welche Werte zufällig simuliert werden. Jede aktivierte Zeile übernimmt ihren nominalen (medianen) Wert aus den Gruppen-Tabs; darunter stehen die Korrelationen zwischen den Zufallsschocks.'
            : 'Choose which values are simulated randomly. Each enrolled row takes its nominal (median) value from the group tabs; below are the correlations between the random shocks.'}
        </p>
        {PARAM_DEFS.filter((d) => d.group === 'correlations' && visible(d)).map((d) => (
          <ValueBox key={d.key} def={d} state={state} set={set} isOn={true} />
        ))}
        {mcDefs().map((d) => (
          <McRow key={d.key} def={d} state={state} set={set} />
        ))}
      </>
    ) : (
      <>
        {groupDefs(s).map((d) => (
          <ValueBox key={d.key} def={d} state={state} set={set} isOn={isOn(d)} />
        ))}
      </>
    );

  return (
    <div className="param-form">
      <Tabs
        value={tab}
        onChange={(v) => setTab((v ?? MAIN_GROUPS[0]) as Section)}
        keepMounted
      >
        <Tabs.List
          aria-label={lang === 'de' ? 'Parameterbereiche' : 'Parameter sections'}
        >
          {SECTIONS.map((s) => (
            <Tabs.Tab key={s} value={s} leftSection={s === 'mc' ? '🎲' : undefined}>
              {tabTitle(s)}
              <span className="count">({countOf(s)})</span>
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <p className="muted tab-hint">
        {lang === 'de' ? (
          <>Die Tabs enthalten die <strong>Werte</strong> — ein deaktiviertes Merkmal wird gedimmt, und du schaltest Merkmale im <strong>⚙️ Optionen</strong>-Menü in der Kopfzeile ein oder aus.</>
        ) : (
          <>The tabs hold the <strong>values</strong> — a disabled feature is dimmed, and you
          switch features on or off in the <strong>⚙️ Options</strong> menu in the top bar.</>
        )}
      </p>

      {/* every panel stays mounted; inactive ones are display:none so state is never lost */}
      {SECTIONS.map((s) => (
        <div
          key={s}
          role="tabpanel"
          aria-label={tabTitle(s)}
          data-testid={`tab-panel-${s}`}
          style={{ display: tab === s ? undefined : 'none' }}
        >
          {sectionBody(s)}
        </div>
      ))}
    </div>
  );
}

/** Parameter box: just the value (dimmed while its feature is disabled). */
function ValueBox({ def, state, set, isOn }: { def: ParamDef; state: ParamState; set: Setter; isOn: boolean }): JSX.Element {
  const lang = useLang();
  const label = labelOf(def, lang);
  const help = helpOf(def, lang);
  const cls = ['param-box', !isOn ? 'off' : ''].join(' ');
  return (
    <div className={cls}>
      <div className="param-main">
        <div className="param-label">
          <span className="icon" aria-hidden>{iconOf(def.key)}</span>
          <span className="text">{label}</span>
          {help && <HelpTip text={help} />}
        </div>
        <div className="param-input">
          {def.kind === 'select' ? (
            <select
              value={state.values[def.key]}
              onChange={(e) => set(def.key, { value: parseFloat(e.target.value) })}
              aria-label={label}
              title={help}
            >
              {(def.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>{selectOptionLabel(def.key, o, lang)}</option>
              ))}
            </select>
          ) : (
            <>
              <input
                type="number"
                value={state.values[def.key]}
                min={def.min}
                max={def.max}
                step={def.step ?? 1}
                onChange={(e) => set(def.key, { value: parseFloat(e.target.value) })}
              />
              <span className="unit">{unitOf(def.kind, lang)}</span>
              {SLIDER_PARAMS.has(def.key) && (
                <Slider
                  className="param-slider"
                  size="xs"
                  radius="sm"
                  min={def.min ?? 0}
                  max={def.max ?? 100}
                  step={def.step ?? 1}
                  value={Math.min(Math.max(state.values[def.key], def.min ?? 0), def.max ?? 100)}
                  onChange={(v) => set(def.key, { value: v })}
                  aria-label={label}
                  label={undefined}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Monte-Carlo row: enroll checkbox; the nominal value comes from its group tab. */
function McRow({ def, state, set }: { def: ParamDef; state: ParamState; set: Setter }): JSX.Element {
  const lang = useLang();
  const label = labelOf(def, lang);
  const help = helpOf(def, lang);
  const spec = state.mc[def.key];
  const mcOn = spec?.enabled ?? false;
  const cls = ['param-box', mcOn ? 'mc-on' : ''].join(' ');
  return (
    <div className={cls}>
      <div className="param-main">
        <div className="param-label">
          <input
            type="checkbox"
            className="toggle"
            checked={mcOn}
            onChange={(e) => spec && set(def.key, { mc: { ...spec, enabled: e.target.checked } })}
            aria-label={lang === 'de' ? `${label} in die Monte-Carlo-Simulation aufnehmen` : `Enroll ${label} in Monte Carlo`}
          />
          <span className="icon" aria-hidden>{iconOf(def.key)}</span>
          <span className="text">{label}</span>
          {help && <HelpTip text={help} />}
        </div>
        <div className="param-input">
          <span className="unit">{lang === 'de' ? 'nominal' : 'nominal'}: {state.values[def.key]} {unitOf(def.kind, lang)}</span>
        </div>
      </div>
      {mcOn && spec && (
        <div className="param-mc">
          <select
            value={spec.dist}
            onChange={(e) => set(def.key, { mc: { ...spec, dist: e.target.value as Dist } })}
            aria-label={lang === 'de' ? `Verteilung für ${label}` : `Distribution for ${label}`}
          >
            {(Object.keys(DIST_LABELS) as Dist[]).map((dist) => (
              <option key={dist} value={dist}>
                {(lang === 'de' ? DIST_LABELS_DE : DIST_LABELS)[dist]}
              </option>
            ))}
          </select>
          <label>
            <span className="unit">min</span>
            <input
              type="number"
              value={spec.min}
              step={def.step ?? 1}
              onChange={(e) => set(def.key, { mc: { ...spec, min: parseFloat(e.target.value) } })}
            />
          </label>
          <label>
            <span className="unit">max</span>
            <input
              type="number"
              value={spec.max}
              step={def.step ?? 1}
              onChange={(e) => set(def.key, { mc: { ...spec, max: parseFloat(e.target.value) } })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function unitOf(kind: string, lang: 'de' | 'en'): string {
  switch (kind) {
    case 'eur':
      return '€';
    case 'mrate':
      return lang === 'de' ? '€/Mon.' : '€/mo';
    case 'pct':
      return '% p. a.';
    case 'count':
      return lang === 'de' ? 'J.' : 'yrs';
    case 'ratio':
      return 'ρ';
    default:
      return '';
  }
}

