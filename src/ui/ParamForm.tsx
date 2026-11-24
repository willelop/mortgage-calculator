import React from 'react';
import { PARAM_DEFS, GROUP_LABELS, GROUP_ORDER, Group, ParamState, McSpec, Dist } from '../engine/params';

interface Props {
  state: ParamState;
  onChange: (next: ParamState) => void;
}

const DIST_LABELS: Record<Dist, string> = {
  lognormal: 'Lognormal',
  normal: 'Normal',
  uniform: 'Uniform',
  triangular: 'Triangular',
};

export function ParamForm({ state, onChange }: Props): JSX.Element {
  const set = (key: string, patch: Partial<{ value: number; on: boolean; mc: McSpec }>) => {
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

function GroupCard({
  group,
  state,
  set,
}: {
  group: Group;
  state: ParamState;
  set: (key: string, patch: Partial<{ value: number; on: boolean; mc: McSpec }>) => void;
}): JSX.Element | null {
  const defs = PARAM_DEFS.filter((d) => d.group === group);

  return (
    <section className="card">
      <h2>{GROUP_LABELS[group]}</h2>
      <table className="params">
        <tbody>
          {defs.map((d) => {
            const toggleable = d.toggleable !== false;
            const isOn = toggleable ? state.on[d.key] ?? d.defaultOn ?? true : true;
            const spec = state.mc[d.key];
            const rowClass = !isOn ? 'off' : '';
            return (
              <React.Fragment key={d.key}>
                <tr className={rowClass}>
                  <td className="label" title={d.help ?? ''}>
                    {toggleable && (
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={(e) => set(d.key, { on: e.target.checked })}
                        aria-label={`Enable ${d.label}`}
                      />
                    )}{' '}
                    {d.label}
                  </td>
                  <td className="input">
                    {d.kind === 'switch' ? (
                      <input
                        type="checkbox"
                        checked={state.values[d.key] !== 0}
                        onChange={(e) => set(d.key, { value: e.target.checked ? 1 : 0 })}
                      />
                    ) : (
                      <input
                        type="number"
                        value={state.values[d.key]}
                        min={d.min}
                        max={d.max}
                        step={d.step ?? 1}
                        onChange={(e) => set(d.key, { value: parseFloat(e.target.value) })}
                      />
                    )}
                  </td>
                  <td className="unit">{unitOf(d.kind)}</td>
                  {d.mcable ? (
                    <td className="mc">
                      <label title="Include this parameter in the Monte Carlo simulation with the range below">
                        <input
                          type="checkbox"
                          checked={spec?.enabled ?? false}
                          onChange={(e) => set(d.key, { mc: { ...(spec as McSpec), enabled: e.target.checked } })}
                        />{' '}
                        MC
                      </label>
                    </td>
                  ) : (
                    <td />
                  )}
                </tr>
                {d.mcable && spec?.enabled && (
                  <tr className="mc-row">
                    <td />
                    <td className="mc-inputs" colSpan={3}>
                      <select
                        value={spec.dist}
                        onChange={(e) =>
                          set(d.key, { mc: { ...spec, dist: e.target.value as Dist } })
                        }
                      >
                        {(Object.keys(DIST_LABELS) as Dist[]).map((dist) => (
                          <option key={dist} value={dist}>
                            {DIST_LABELS[dist]}
                          </option>
                        ))}
                      </select>
                      <label>
                        min
                        <input
                          type="number"
                          value={spec.min}
                          step={d.step ?? 1}
                          onChange={(e) =>
                            set(d.key, { mc: { ...spec, min: parseFloat(e.target.value) } })
                          }
                        />
                      </label>
                      <label>
                        max
                        <input
                          type="number"
                          value={spec.max}
                          step={d.step ?? 1}
                          onChange={(e) =>
                            set(d.key, { mc: { ...spec, max: parseFloat(e.target.value) } })
                          }
                        />
                      </label>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
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
