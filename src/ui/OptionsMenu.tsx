import React, { useState } from 'react';
import { PARAM_DEFS, GROUP_LABELS, GROUP_ORDER, iconOf, ParamDef, ParamState } from '../engine/params';

/** parameter groups shown on the main form (correlations have no on/off) */
const MAIN_GROUPS = GROUP_ORDER.filter((g) => g !== 'correlations');

interface Props {
  state: ParamState;
  onChange: (next: ParamState) => void;
}

/**
 * Toolbar menu holding every enable/disable control in one place.
 * Values stay in the parameter groups; this is solely on/off.
 */
export function OptionsMenu({ state, onChange }: Props): JSX.Element {
  const [open, setOpen] = useState(false);

  const defs = MAIN_GROUPS.flatMap((g) =>
    PARAM_DEFS.filter(
      (d) =>
        d.group === g &&
        (d.toggleable !== false || d.kind === 'switch') &&
        (!d.visibleWhen || d.visibleWhen(state.values)),
    ),
  );

  const isEnabled = (d: ParamDef) =>
    d.kind === 'switch' ? state.values[d.key] !== 0 : state.on[d.key] ?? d.defaultOn ?? true;

  const toggle = (d: ParamDef, checked: boolean) => {
    if (d.kind === 'switch')
      onChange({ ...state, values: { ...state.values, [d.key]: checked ? 1 : 0 } });
    else onChange({ ...state, on: { ...state.on, [d.key]: checked } });
  };

  return (
    <div className="opt-menu">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Enable or disable features"
      >
        ⚙️ Options (
        {defs.filter((d) => isEnabled(d)).length}/{defs.length})
      </button>
      {open && (
        <>
          <div className="opt-backdrop" onClick={() => setOpen(false)} />
          <div className="opt-panel" role="menu">
            {MAIN_GROUPS.map((g) => {
              const gdefs = defs.filter((d) => d.group === g);
              if (gdefs.length === 0) return null;
              return (
                <div key={g} className="opt-group">
                  <h3>{GROUP_LABELS[g]}</h3>
                  {gdefs.map((d) => (
                    <label key={d.key} className="opt-item">
                      <input
                        type="checkbox"
                        className="toggle"
                        checked={isEnabled(d)}
                        onChange={(e) => toggle(d, e.target.checked)}
                        aria-label={d.kind === 'switch' ? d.label : `Enable ${d.label}`}
                      />
                      <span className="icon" aria-hidden>{iconOf(d.key)}</span>
                      <span className="text">{d.label}</span>
                      {d.help && <HelpTip text={d.help} />}
                      <span className="unit">{isEnabled(d) ? 'on' : 'off'}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** "?" mark; stops the click so the surrounding menu label doesn't toggle. */
function HelpTip({ text }: { text: string }): JSX.Element {
  return (
    <span
      className="help-tip"
      tabIndex={0}
      role="note"
      aria-label={text}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <span className="help-mark" aria-hidden>?</span>
      <span className="help-tooltip">{text}</span>
    </span>
  );
}
