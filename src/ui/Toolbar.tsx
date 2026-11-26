import React from 'react';
import { ActionIcon, Button } from '@mantine/core';
import { ParamState } from '../engine/params';
import { PRESETS, presetName, presetDescription, localStorageNames, localStorageDelete } from '../engine/state-io';
import { OptionsMenu } from './OptionsMenu';

interface Props {
  lang: 'de' | 'en';
  theme: 'light' | 'dark';
  state: ParamState;
  preset: string;
  compareName: string | null;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onPreset: (name: string) => void;
  onShare: () => void;
  onSave: () => void;
  onReset: () => void;
  onStateChange: (s: ParamState) => void;
  onCompare: (name: string) => void;
}

/** Header toolbar: language, theme, presets, share/save/reset, options, print, compare (roadmap 5a). */
export function Toolbar({
  lang, theme, state, preset, compareName,
  onToggleLang, onToggleTheme, onPreset, onShare, onSave, onReset, onStateChange, onCompare,
}: Props): JSX.Element {
  const de = lang === 'de';
  return (
    <div className="toolbar">
      <ActionIcon
        variant="default"
        size="lg"
        radius="xl"
        onClick={onToggleLang}
        title={de ? 'Switch to English' : 'Zu Deutsch wechseln'}
        aria-label={de ? 'Switch to English' : 'Zu Deutsch wechseln'}
      >
        {de ? '🇬🇧' : '🇩🇪'}
      </ActionIcon>
      <ActionIcon
        variant="default"
        size="lg"
        radius="xl"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label="Toggle dark mode"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </ActionIcon>
      <label className="toolbar-select-label">
        <span className="btn-text">{de ? 'Voreinstellung' : 'Preset'}</span>
        <select value={preset} onChange={(e) => onPreset(e.target.value)}>
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
      <Button variant="default" onClick={onShare} title={de ? 'Link teilen' : 'Share link'}>
        🔗 <span className="btn-text">{de ? 'Link teilen' : 'Share link'}</span>
      </Button>
      <Button variant="default" onClick={onSave} title={de ? 'Szenario speichern' : 'Save scenario'}>
        💾 <span className="btn-text">{de ? 'Speichern' : 'Save'}</span>
      </Button>
      <Button variant="light" color="red" title={de ? 'Gespeicherte Szenarien löschen' : 'Delete saved scenarios'} onClick={() => {
          localStorageNames().forEach(localStorageDelete);
        }}>
        🗑 <span className="btn-text">{de ? 'Gespeichertes löschen' : 'Clear saved'}</span>
      </Button>
      <Button variant="default" onClick={onReset} title={de ? 'Auf Standardwerte zurücksetzen' : 'Reset to defaults'}>
        ↺ <span className="btn-text">{de ? 'Reset' : 'Reset'}</span>
      </Button>
      <OptionsMenu state={state} onChange={onStateChange} />
      <Button variant="default" onClick={() => window.print()} title={de ? 'Drucken / PDF' : 'Print / PDF'}>
        🖨 <span className="btn-text">{de ? 'Drucken / PDF' : 'Print / PDF'}</span>
      </Button>
      <label className="toolbar-select-label">
        <span className="btn-text">{de ? '⚖ Vergleichen' : '⚖ Compare'}</span>
        <select
          value={compareName ?? ''}
          onChange={(e) => onCompare(e.target.value)}
          aria-label={de ? 'Mit gespeichertem Szenario vergleichen' : 'Compare with a saved scenario'}
          title={localStorageNames().length === 0 ? (de ? 'Erst ein Szenario speichern' : 'Save a scenario first') : undefined}
        >
          <option value="">{compareName ? (de ? '— beenden —' : '— end —') : (de ? '— Szenario wählen —' : '— choose scenario —') }</option>
          {localStorageNames().map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
