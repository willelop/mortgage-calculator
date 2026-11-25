import React, { useState } from 'react';
import { Tabs } from '@mantine/core';
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

/** parameter groups shown on the main form (correlations live in Monte Carlo) */
const MAIN_GROUPS: Group[] = GROUP_ORDER.filter((g) => g !== 'correlations');

/** label of the Monte-Carlo section, kept out of Group for tab typing */
type Section = Group | 'mc';
const SECTIONS: Section[] = [...MAIN_GROUPS, 'mc'];

const TAB_TITLES: Record<Section, string> = {
  ...GROUP_LABELS,
  mc: 'Monte Carlo',
};

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

  const sectionBody = (s: Section): JSX.Element =>
    s === 'mc' ? (
      <>
        <p className="muted tab-hint">
          Choose which values are simulated randomly. Each enrolled row takes its
          nominal (median) value from the group tabs; below are the correlations
          between the random shocks.
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
        <Tabs.List aria-label="Parameter sections">
          {SECTIONS.map((s) => (
            <Tabs.Tab key={s} value={s} leftSection={s === 'mc' ? '🎲' : undefined}>
              {TAB_TITLES[s]}
              <span className="count">({countOf(s)})</span>
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <p className="muted tab-hint">
        The tabs hold the <strong>values</strong> — a disabled feature is dimmed, and you
        switch features on or off in the <strong>⚙️ Options</strong> menu in the top bar.
      </p>

      {/* every panel stays mounted; inactive ones are display:none so state is never lost */}
      {SECTIONS.map((s) => (
        <div
          key={s}
          role="tabpanel"
          aria-label={s === 'mc' ? TAB_TITLES[s] : (GROUP_LABELS as Record<string, string>)[s]}
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
function ValueBox({
  def,
  state,
  set,
  isOn,
}: {
  def: ParamDef;
  state: ParamState;
  set: Setter;
  isOn: boolean;
}): JSX.Element {
  const cls = ['param-box', !isOn ? 'off' : ''].join(' ');
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

/** Monte-Carlo row: enroll checkbox; the nominal value comes from its group tab. */
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
