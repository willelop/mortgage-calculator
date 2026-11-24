import React from 'react';
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

  return (
    <div className="param-form">
      {GROUP_ORDER.map((g) => (
        <GroupCard key={g} group={g} state={state} set={set} />
      ))}
    </div>
  );
}

function GroupCard({ group, state, set }: { group: Group; state: ParamState; set: Setter }): JSX.Element | null {
  const defs = PARAM_DEFS.filter((d) => d.group === group);

  return (
    <section className="card">
      <h2>{GROUP_LABELS[group]}</h2>
      <div className="param-grid">
        {defs.map((d) => (
          <ParamBox key={d.key} def={d} state={state} set={set} />
        ))}
      </div>
    </section>
  );
}

function ParamBox({
  def,
  state,
  set,
}: {
  def: ParamDef;
  state: ParamState;
  set: Setter;
}): JSX.Element {
  const toggleable = def.toggleable !== false;
  const isOn = toggleable ? state.on[def.key] ?? def.defaultOn ?? true : true;
  const spec = state.mc[def.key];
  const mcOn = def.mcable && (spec?.enabled ?? false);
  const cls = [
    'param-box',
    !isOn ? 'off' : '',
    mcOn ? 'mc-on' : '',
  ].join(' ');

  return (
    <div className={cls} title={def.help ?? ''}>
      <div className="param-main">
        <div className="param-label">
          {toggleable && (
            <input
              type="checkbox"
              className="toggle"
              checked={isOn}
              onChange={(e) => set(def.key, { on: e.target.checked })}
              aria-label={`Enable ${def.label}`}
            />
          )}
          <span className="icon" aria-hidden>{iconOf(def.key)}</span>
          <span className="text">{def.label}</span>
        </div>
        <div className="param-input">
          {def.kind === 'switch' ? (
            <label className="switch">
              <input
                type="checkbox"
                checked={state.values[def.key] !== 0}
                onChange={(e) => set(def.key, { value: e.target.checked ? 1 : 0 })}
              />
              <span className="unit">{state.values[def.key] !== 0 ? 'on' : 'off'}</span>
            </label>
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
          {def.mcable && spec && (
            <label className="mc-toggle" title="Include this parameter in the Monte Carlo simulation with the range below">
              <input
                type="checkbox"
                checked={spec.enabled}
                onChange={(e) => set(def.key, { mc: { ...spec, enabled: e.target.checked } })}
              />{' '}
              MC
            </label>
          )}
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
