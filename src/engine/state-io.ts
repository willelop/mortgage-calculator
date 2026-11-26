/**
 * Scenario state serialization: shareable URLs, localStorage, presets.
 */

import { ParamState, ParamDef, PARAM_DEFS, PARAM_MAP, defaultState } from './params';

export function encodeState(s: ParamState): string {
  const payload = { v: s.values, o: s.on, m: s.mc };
  const json = JSON.stringify(payload);
  // base64url
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeState(code: string): ParamState | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    const payload = JSON.parse(json) as { v?: Record<string, number>; o?: Record<string, boolean>; m?: ParamState['mc'] };
    const base = defaultState();
    // only accept known params, coerce types defensively
    for (const d of PARAM_DEFS) {
      if (typeof payload.v?.[d.key] === 'number' && Number.isFinite(payload.v[d.key])) {
        base.values[d.key] = payload.v[d.key];
      }
      if (typeof payload.o?.[d.key] === 'boolean') base.on[d.key] = payload.o[d.key];
      const m = payload.m?.[d.key];
      if (m && typeof m.enabled === 'boolean' && typeof m.min === 'number' && typeof m.max === 'number') {
        base.mc[d.key] = {
          enabled: m.enabled,
          dist: (['normal', 'uniform', 'triangular', 'lognormal'] as const).includes(m.dist)
            ? m.dist
            : base.mc[d.key].dist,
          min: m.min,
          max: m.max,
        };
      }
    }
    return base;
  } catch {
    return null;
  }
}

export function toShareUrl(s: ParamState): string {
  const url = new URL(window.location.href);
  url.searchParams.set('s', encodeState(s));
  return url.toString();
}

export function fromLocation(): ParamState | null {
  const s = new URLSearchParams(window.location.search).get('s');
  return s ? decodeState(s) : null;
}

// --- localStorage -----------------------------------------------------------

const LS_SCENARIOS = 'buyvsrent.scenarios';

export function localStorageNames(): string[] {
  try {
    const raw = localStorage.getItem(LS_SCENARIOS);
    return raw ? Object.keys(JSON.parse(raw)).sort() : [];
  } catch {
    return [];
  }
}

export function localStorageSave(name: string, s: ParamState): void {
  const all = allScenarios();
  all[name] = s;
  localStorage.setItem(LS_SCENARIOS, JSON.stringify(all));
}

export function localStorageLoad(name: string): ParamState | null {
  const all = allScenarios();
  const raw = all[name];
  return raw ? decodeState(encodeState(raw)) : null;
}

export function localStorageDelete(name: string): void {
  const all = allScenarios();
  delete all[name];
  localStorage.setItem(LS_SCENARIOS, JSON.stringify(all));
}

function allScenarios(): Record<string, ParamState> {
  try {
    return JSON.parse(localStorage.getItem(LS_SCENARIOS) ?? '{}') as Record<string, ParamState>;
  } catch {
    return {};
  }
}

// --- autosave (last session) -------------------------------------------------

const LS_AUTOSAVE = 'buyvsrent.autosave';

/** Persist the current state so the next visit restores it without re-entering. */
export function autosaveState(s: ParamState): void {
  try {
    localStorage.setItem(LS_AUTOSAVE, encodeState(s));
  } catch {
    // storage full or blocked — ignore, autosave is best-effort
  }
}

/** Restore the last session's state, or null if there is none. */
export function loadAutosave(): ParamState | null {
  try {
    const raw = localStorage.getItem(LS_AUTOSAVE);
    return raw ? decodeState(raw) : null;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(LS_AUTOSAVE);
  } catch {
    // ignore
  }
}

// --- presets ------------------------------------------------------------------

export interface Preset {
  name: string;
  description: string;
  /** German display name / description (`name`/`description` stay canonical, used as keys). */
  nameDe?: string;
  descriptionDe?: string;
  values: Record<string, number>;
  on?: Record<string, boolean>;
}

/** Localized display name (fallback: canonical `name`). */
export function presetName(p: Preset, lang: 'de' | 'en'): string {
  return lang === 'de' && p.nameDe ? p.nameDe : p.name;
}

/** Localized display description (fallback: canonical `description`). */
export function presetDescription(p: Preset, lang: 'de' | 'en'): string {
  return lang === 'de' && p.descriptionDe ? p.descriptionDe : p.description;
}

export function applyPreset(s: ParamState, p: Preset): ParamState {
  const next: ParamState = {
    values: { ...s.values },
    on: { ...s.on },
    mc: { ...s.mc },
  };
  for (const [k, val] of Object.entries(p.values)) {
    if (PARAM_MAP[k]) next.values[k] = val;
  }
  for (const [k, val] of Object.entries(p.on ?? {})) {
    next.on[k] = val;
  }
  return next;
}

export const PRESETS: Preset[] = [
  {
    name: 'German default — 500 k€ house',
    nameDe: 'Deutscher Standard — 500-k€-Haus',
    description: '500 k€, 150 k€ equity, 10 y fixation, 25 y horizon.',
    descriptionDe: '500 k€, 150 k€ Eigenkapital, 10 J. Zinsbindung, 25 J. Horizont.',
    values: {},
  },
  {
    name: 'Starter flat — 350 k€ condo',
    nameDe: 'Starterwohnung — 350-k€-Eigentumswohnung',
    description: 'Smaller purchase, condo fees, lower rent.',
    descriptionDe: 'Kleinerer Kauf, Hausgeld, niedrigere Miete.',
    values: {
      property_price: 350_000,
      equity: 105_000,
      hausgeld_annual: 2_400,
      rent_cold: 1_150,
      nebenkosten_monthly: 220,
      grunderwerbsteuer_rate: 6.0,
      renovation_budget: 5_000,
      capital_stocks: 25_000,
      capital_bonds: 10_000,
    },
  },
  {
    name: 'Family house — 650 k€',
    nameDe: 'Einfamilienhaus — 650 k€',
    description: 'Bigger property, higher rent baseline, 30 y horizon.',
    descriptionDe: 'Größere Immobilie, höhere Mietbasis, 30 J. Horizont.',
    values: {
      property_price: 650_000,
      equity: 195_000,
      horizon_years: 30,
      rent_cold: 2_150,
      nebenkosten_monthly: 320,
      maintenance_rate: 1.2,
      renovation_budget: 20_000,
      capital_stocks: 60_000,
      capital_bonds: 25_000,
    },
  },
  {
    name: 'Pessimistic markets',
    nameDe: 'Pessimistische Märkte',
    description: 'Low stock returns, property stagnation, high rent growth.',
    descriptionDe: 'Niedrige Aktienrenditen, stagnierende Immobilien, hohe Mietsteigerung.',
    values: {
      expected_return_stocks: 4.0,
      property_appreciation: 0.5,
      rent_increase: 3.0,
      rent_increase_linked_to_inflation: 1,
    },
  },
];
