import React, { useState } from 'react';
import { PARAM_DEFS, GROUP_LABELS, GROUP_ORDER, iconOf, Group, ParamDef, ParamState, McSpec, Dist } from '../engine/params';

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

/** groups shown on the main Parameters tab (correlations live in the Monte-Carlo tab) */
const PARAM_GROUPS = GROUP_ORDER.filter((g) => g !== 'correlations');

type Tab = 'params' | 'options' | 'mc';

export function ParamForm({ state, onChange }: Props): JSX.Element {
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

  const [tab, setTab] = useState<Tab>('params');
  // accordion state per group; first group starts expanded, the rest collapsed
  // (keeps the page short — no more endless scrolling)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ [PARAM_GROUPS[0]]: true });
  const toggleGroup = (g: string) =>
    setOpenGroups((prev) => ({ ...prev, [g]: !prev[g] }));

  const visibleDefs = (g: Group) =>
    PARAM_DEFS.filter((d) => d.group === g && (!d.visibleWhen || d.visibleWhen(state.values)));

  const isOn = (d: ParamDef) => (state.on[d.key] ?? d.defaultOn ?? true);

  return (
    <div className="param-form">
      <div className="form-tabs" role="tablist" aria-label="Parameter sections">
        {(
          [
            ['params', '⚙️ Parameters'],
            ['options', '🧰 Features'],
            ['mc', '🎲 Monte Carlo'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'tab active' : 'tab'}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'params' && (
        <div className="tab-body">
          <p className="muted tab-hint">
            Only enabled features are shown. Toggle features in the <strong>Features</strong> tab.
          </p>
          {PARAM_GROUPS.map((g, i) => {
            const defs = visibleDefs(g).filter(
              (d) => d.kind !== 'switch' && (d.toggleable === false || isOn(d)),
            );
            return (
              <GroupAccordion
                key={g}
                group={g}
                defs={defs}
                open={!!openGroups[g]}
                onToggle={() => toggleGroup(g)}
              >
                {defs.map((d) => (
                  <MainParamBox key={d.key} def={d} state={state} set={set} />
                ))}
              </GroupAccordion>
            );
          })}
        </div>
      )}

      {tab === 'options' && (
        <div className="tab-body">
          <p className="muted tab-hint">
            Enable or disable features here. Disabled features disappear from the
            <strong> Parameters</strong> tab and contribute 0 to the model. Everything already has
            a sensible default.
          </p>
          {PARAM_GROUPS.map((g) => {
            const defs = visibleDefs(g).filter((d) => d.kind === 'switch' || d.toggleable !== false);
            return (
              <GroupAccordion
                key={g}
                group={g}
                defs={defs}
                open={!!openGroups[`opt-${g}`]}
                onToggle={() => toggleGroup(`opt-${g}`)}
              >
                {defs.map((d) => (
                  <OptionRow key={d.key} def={d} state={state} set={set} />
                ))}
              </GroupAccordion>
            );
          })}
        </div>
      )}

      {tab === 'mc' && (
        <McTab state={state} set={set} visibleDefs={visibleDefs} openGroups={openGroups} toggleGroup={toggleGroup} />
      )}
    </div>
  );
}

/** Collapsible `<details>` region with a count badge; collapses to keep pages short. */
function GroupAccordion({
  group,
  defs,
  open,
  onToggle,
  children,
}: {
  group: Group;
  defs: ParamDef[];
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}): JSX.Element | null {
  if (defs.length === 0) return null;
  return (
    <details className="group-acc" open={open}>
      <summary onClick={(e) => { e.preventDefault(); onToggle(); }}>
        {GROUP_LABELS[group]}
        <span className="count">({defs.length})</span>
      </summary>
      {open && <div className="param-body">{children}</div>}
    </details>
  );
}

/** Main-tab parameter box: input only, no enable checkbox, no MC controls. */
function MainParamBox({
  def,
  state,
  set,
}: {
  def: ParamDef;
  state: ParamState;
  set: Setter;
}): JSX.Element {
  const cls = ['param-box', 'param-box-main'].join(' ');
  return (
    <div className={cls}>
      <div className="param-main">
        <div className="param-label">
          <span className="icon" aria-hidden>{iconOf(def.key)}</span>
          <span className="text">{def.label}</span>
          {def.help && <HelpTip text={def.help} />}
        </div>
        <div className="param-input">
          {def.kind === 'select' ? (
            <select
              value={state.values[def.key]}
              onChange={(e) => set(def.key, { value: parseFloat(e.target.value) })}
              aria-label={def.label}
              title={def.help}
            >
              {(def.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
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
              <span className="unit">{unitOf(def.kind)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Features-tab row: enable checkbox (+ the value for switch-kind options). */
function OptionRow({
  def,
  state,
  set,
}: {
  def: ParamDef;
  state: ParamState;
  set: Setter;
}): JSX.Element {
  const isSwitch = def.kind === 'switch';
  const valueOn = state.values[def.key] !== 0;
  const featureOn = isSwitch ? valueOn : state.on[def.key] ?? def.defaultOn ?? true;

  const toggleFeature = (checked: boolean) => {
    if (isSwitch) set(def.key, { value: checked ? 1 : 0 });
    else set(def.key, { on: checked });
  };

  return (
    <div className={featureOn ? 'opt-row on' : 'opt-row off'}>
      <input
        type="checkbox"
        className="toggle"
        checked={featureOn}
        onChange={(e) => toggleFeature(e.target.checked)}
        aria-label={`Enable ${def.label}`}
      />
      <span className="icon" aria-hidden>{iconOf(def.key)}</span>
      <span className="text">{def.label}</span>
      {def.help && <HelpTip text={def.help} />}
      <span className="opt-value">
        {!isSwitch && (
          <>
            <input
              type="number"
              value={state.values[def.key]}
              min={def.min}
              max={def.max}
              step={def.step ?? 1}
              onChange={(e) => set(def.key, { value: parseFloat(e.target.value) })}
            />
            <span className="unit">{unitOf(def.kind)}</span>
          </>
        )}
        {isSwitch && <span className="unit">{featureOn ? 'on' : 'off'}</span>}
      </span>
    </div>
  );
}

/** Monte-Carlo tab: enroll parameters and edit their distribution/range. */
function McTab({
  state,
  set,
  visibleDefs,
  openGroups,
  toggleGroup,
}: {
  state: ParamState;
  set: Setter;
  visibleDefs: (g: Group) => ParamDef[];
  openGroups: Record<string, boolean>;
  toggleGroup: (g: string) => void;
}): JSX.Element {
  const mcGroups = PARAM_GROUPS.filter(
    (g) => visibleDefs(g).some((d) => d.mcable),
  );
  return (
    <div className="tab-body">
      <p className="muted tab-hint">
        Enroll parameters into the Monte-Carlo simulation. Enrolled parameters get a random draw
        per run; the value sliders in <strong>Parameters</strong> act as the nominal (median)
        value.
      </p>
      {PARAM_DEFS.filter((d) => d.group === 'correlations').map((d) => (
        <MainParamBox key={d.key} def={d} state={state} set={set} />
      ))}
      {mcGroups.map((g) => (
        <GroupAccordion
          key={g}
          group={g}
          defs={visibleDefs(g).filter((d) => d.mcable)}
          open={!!openGroups[`mc-${g}`]}
          onToggle={() => toggleGroup(`mc-${g}`)}
        >
          {visibleDefs(g)
            .filter((d) => d.mcable)
            .map((d) => (
              <McRow key={d.key} def={d} state={state} set={set} />
            ))}
        </GroupAccordion>
      ))}
    </div>
  );
}

function McRow({
  def,
  state,
  set,
}: {
  def: ParamDef;
  state: ParamState;
  set: Setter;
}): JSX.Element {
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
            aria-label={`Enroll ${def.label} in Monte Carlo`}
          />
          <span className="icon" aria-hidden>{iconOf(def.key)}</span>
          <span className="text">{def.label}</span>
          {def.help && <HelpTip text={def.help} />}
        </div>
        <div className="param-input">
          <span className="unit">nominal: {state.values[def.key]} {unitOf(def.kind)}</span>
        </div>
      </div>
      {mcOn && spec && (
        <div className="param-mc">
          <select
            value={spec.dist}
            onChange={(e) => set(def.key, { mc: { ...spec, dist: e.target.value as Dist } })}
            aria-label={`Distribution for ${def.label}`}
          >
            {(Object.keys(DIST_LABELS) as Dist[]).map((dist) => (
              <option key={dist} value={dist}>
                {DIST_LABELS[dist]}
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

function unitOf(kind: string): string {
  switch (kind) {
    case 'eur':
      return '€';
    case 'mrate':
      return '€/mo';
    case 'pct':
      return '% p.a.';
    case 'count':
      return 'yrs';
    case 'ratio':
      return 'ρ';
    default:
      return '';
  }
}

/** "?" mark with a hover/focus tooltip explaining the parameter. */
function HelpTip({ text }: { text: string }): JSX.Element {
  return (
    <span className="help-tip" tabIndex={0} role="note" aria-label={text}>
      <span className="help-mark" aria-hidden>?</span>
      <span className="help-tooltip">{text}</span>
    </span>
  );
}
