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

/** parameter groups shown on the main form (correlations live in Monte Carlo) */
const MAIN_GROUPS: Group[] = GROUP_ORDER.filter((g) => g !== 'correlations');

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

  // accordion state per section; the two headline groups start expanded
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    [MAIN_GROUPS[0]]: true,
    [MAIN_GROUPS[1]]: true,
  });
  const toggleGroup = (g: string) =>
    setOpenGroups((prev) => ({ ...prev, [g]: !prev[g] }));

  const visible = (d: ParamDef) =>
    (!d.visibleWhen || d.visibleWhen(state.values)) &&
    (d.toggleable === false || d.kind === 'switch' || isOn(d));
  const isOn = (d: ParamDef) =>
    d.kind === 'switch' ? state.values[d.key] !== 0 : state.on[d.key] ?? d.defaultOn ?? true;

  return (
    <div className="param-form">
      <p className="muted tab-hint">
        The <strong>groups below hold the values</strong> — disabled features are
        hidden, and you switch features on or off in the <strong>⚙️ Options</strong> menu
        in the top bar. Under <strong>Monte Carlo</strong> you choose which values are
        simulated randomly.
      </p>

      {MAIN_GROUPS.map((g) => {
        const defs = PARAM_DEFS.filter((d) => d.group === g && d.kind !== 'switch' && visible(d));
        return (
          <Accordion
            key={g}
            title={GROUP_LABELS[g]}
            count={defs.length}
            open={!!openGroups[g]}
            onToggle={() => toggleGroup(g)}
          >
            {defs.map((d) => (
              <ValueBox key={d.key} def={d} state={state} set={set} />
            ))}
          </Accordion>
        );
      })}

      <Accordion
        title="Monte Carlo"
        subtitle="which values are random"
        count={
          PARAM_DEFS.filter((d) => d.mcable && visible(d) && (state.mc[d.key]?.enabled ?? false)).length
        }
        open={!!openGroups.mc}
        onToggle={() => toggleGroup('mc')}
      >
        {PARAM_DEFS.filter((d) => d.group === 'correlations' && visible(d)).map((d) => (
          <ValueBox key={d.key} def={d} state={state} set={set} />
        ))}
        {MAIN_GROUPS.map((g) =>
          PARAM_DEFS.filter((d) => d.group === g && d.mcable && visible(d)).map((d) => (
            <McRow key={d.key} def={d} state={state} set={set} />
          )),
        )}
      </Accordion>
    </div>
  );
}

/** Collapsible `<details>` region; children only render when open. */
function Accordion({
  title,
  subtitle,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}): JSX.Element | null {
  if (count === 0) return null;
  return (
    <details className="group-acc" open={open}>
      <summary onClick={(e) => { e.preventDefault(); onToggle(); }}>
        {title}
        {subtitle && <span className="subtitle">{subtitle}</span>}
        <span className="count">({count})</span>
      </summary>
      {open && <div className="param-body">{children}</div>}
    </details>
  );
}

/** Parameter box: just the value. Disabled features are not rendered at all. */
function ValueBox({
  def,
  state,
  set,
}: {
  def: ParamDef;
  state: ParamState;
  set: Setter;
}): JSX.Element {
  return (
    <div className="param-box">
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

/** Monte-Carlo row: enroll checkbox; the nominal value comes from its group box. */
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
