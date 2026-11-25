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

  // accordion state per group; the two headline groups (global + purchase)
  // start expanded, the rest collapsed — keeps the mobile page short
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    [GROUP_ORDER[0]]: true,
    [GROUP_ORDER[1]]: true,
  });
  const toggleGroup = (g: string) =>
    setOpenGroups((prev) => ({ ...prev, [g]: !prev[g] }));

  return (
    <div className="param-form">
      <p className="muted tab-hint">
        Each feature is configured right in its box: the tick enables it, the
        <strong> MC</strong> chip enrolls the value into the Monte-Carlo
        simulation (the entered value then acts as the median).
      </p>
      {GROUP_ORDER.map((g) => (
        <GroupAccordion
          key={g}
          group={g}
          state={state}
          open={!!openGroups[g]}
          onToggle={() => toggleGroup(g)}
          set={set}
        />
      ))}
    </div>
  );
}

/** Collapsible `<details>` region; children only render when open. */
function GroupAccordion({
  group,
  state,
  open,
  onToggle,
  set,
}: {
  group: Group;
  state: ParamState;
  open: boolean;
  onToggle: () => void;
  set: Setter;
}): JSX.Element | null {
  const defs = PARAM_DEFS.filter(
    (d) => d.group === group && (!d.visibleWhen || d.visibleWhen(state.values)),
  );
  if (defs.length === 0) return null;
  return (
    <details className="group-acc" open={open}>
      <summary onClick={(e) => { e.preventDefault(); onToggle(); }}>
        {GROUP_LABELS[group]}
        <span className="count">({defs.length})</span>
      </summary>
      {open && (
        <div className="param-body">
          {defs.map((d) => (
            <ParamBox key={d.key} def={d} state={state} set={set} />
          ))}
        </div>
      )}
    </details>
  );
}

/**
 * One box per parameter — everything about it lives here:
 * enable toggle (optional features), value, help tooltip and the
 * "MC" chip that expands the distribution settings in place.
 */
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
    <div className={cls}>
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
          {def.help && <HelpTip text={def.help} />}
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
          ) : def.kind === 'select' ? (
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

/** "?" mark with a hover/focus tooltip explaining the parameter. */
function HelpTip({ text }: { text: string }): JSX.Element {
  return (
    <span className="help-tip" tabIndex={0} role="note" aria-label={text}>
      <span className="help-mark" aria-hidden>?</span>
      <span className="help-tooltip">{text}</span>
    </span>
  );
}
