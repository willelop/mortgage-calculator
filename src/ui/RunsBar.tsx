import React from 'react';
import { Button, NumberInput } from '@mantine/core';

interface Props {
  lang: 'de' | 'en';
  running: 'nominal' | 'mc' | null;
  mcRuns: number;
  seed: number;
  mcProgress: number | null;
  enrolledCount: number;
  onRunNominal: () => void;
  onRunMc: () => void;
  onCancelMc: () => void;
  onMcRunsChange: (v: number) => void;
  onSeedChange: (v: number) => void;
}

/** Docked bottom bar with the deterministic and Monte-Carlo run buttons (roadmap 5a). */
export function RunsBar({
  lang, running, mcRuns, seed, mcProgress, enrolledCount,
  onRunNominal, onRunMc, onCancelMc, onMcRunsChange, onSeedChange,
}: Props): JSX.Element {
  const de = lang === 'de';
  return (
    <div className="runs-bar">
      <div className="run-group">
        <span className="run-group-label">{de ? 'Deterministisches Szenario' : 'Deterministic scenario'}</span>
        <Button variant="filled" color="brand" onClick={onRunNominal} disabled={running !== null}>
          {running === 'nominal' ? (de ? 'Läuft…' : 'Running…') : '▶ ' + (de ? 'Starten' : 'Run')}
        </Button>
        <span className="hint">{de ? 'ein Durchlauf mit exakt deinen Eingaben' : 'one pass with your exact inputs'}</span>
      </div>
      <div className="run-group">
        <span className="run-group-label">🎲 Monte Carlo</span>
        <NumberInput
          w={110}
          size="xs"
          min={100}
          max={10000}
          step={100}
          value={mcRuns}
          aria-label={de ? 'Anzahl der Monte-Carlo-Läufe' : 'Number of Monte Carlo runs'}
          onChange={(v) => onMcRunsChange(Math.max(100, Math.min(10000, Number(v) || 1000)))}
        />
        <NumberInput
          w={110}
          size="xs"
          value={seed}
          aria-label={de ? 'Zufalls-Seed' : 'Random seed'}
          onChange={(v) => onSeedChange(Number(v) || 42)}
        />
        <span className="hint">{enrolledCount} {de ? 'Parameter enrolliert' : 'parameter(s) enrolled'}</span>
        <Button variant="filled" color="brand" onClick={onRunMc} disabled={running !== null}>
          {running === 'mc'
            ? (de ? `Simuliere… ${mcProgress !== null ? Math.round(mcProgress * 100) + ' %' : ''}` : `Simulating… ${mcProgress !== null ? Math.round(mcProgress * 100) + ' %' : ''}`)
            : '▶ ' + (de ? 'Starten' : 'Run')}
        </Button>
        {running === 'mc' && (
          <Button variant="light" color="red" onClick={onCancelMc}>
            ✕ {de ? 'Abbrechen' : 'Cancel'}
          </Button>
        )}
      </div>
    </div>
  );
}
