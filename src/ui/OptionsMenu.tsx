import React, { useState } from 'react';
import { Popover, Checkbox, Button } from '@mantine/core';
import { PARAM_DEFS, GROUP_ORDER, iconOf, Group, ParamDef, ParamState, groupLabel, labelOf, helpOf } from '../engine/params';
import { useLang } from '../i18n';
import { HelpTip } from './HelpTip';

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
  const lang = useLang();

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
      <Popover width={450} position="bottom-end" withinPortal={false} trapFocus={false}>
        <Popover.Target>
          <Button
            variant="default"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-haspopup="menu"
            title={lang === 'de' ? 'Merkmale ein- oder ausschalten' : 'Enable or disable features'}
          >
            ⚙️ {lang === 'de' ? 'Optionen' : 'Options'} ({defs.filter((d) => isEnabled(d)).length}/{defs.length})
          </Button>
        </Popover.Target>
        {open && (
          <>
            <div className="opt-backdrop" onClick={() => setOpen(false)} />
            <Popover.Dropdown className="opt-panel" role="menu">
              {MAIN_GROUPS.map((g) => {
                const gdefs = defs.filter((d) => d.group === g);
                if (gdefs.length === 0) return null;
                return (
                  <div key={g} className="opt-group">
                    <h3>{groupLabel(g, lang)}</h3>
                    {gdefs.map((d) => (
                      <label key={d.key} className="opt-item">
                        <Checkbox
                          className="toggle"
                          checked={isEnabled(d)}
                          onChange={(e) => toggle(d, e.currentTarget.checked)}
                          aria-label={
                            d.kind === 'switch'
                              ? labelOf(d, lang)
                              : lang === 'de' ? `${labelOf(d, lang)} aktivieren` : `Enable ${labelOf(d, lang)}`
                          }
                        />
                        <span className="icon" aria-hidden>{iconOf(d.key)}</span>
                        <span className="text">{labelOf(d, lang)}</span>
                        {helpOf(d, lang) && <HelpTip text={helpOf(d, lang)} />}
                        <span className="unit">{isEnabled(d) ? (lang === 'de' ? 'ein' : 'on') : (lang === 'de' ? 'aus' : 'off')}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </Popover.Dropdown>
          </>
        )}
      </Popover>
    </div>
  );
}
