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

// --- share-link compression (roadmap 3b) ------------------------------------
// Long states exceed URL length limits (~2000 chars for some browsers/messengers)
// and look hostile. When the plain code gets too long, deflate-raw + base64url it
// and prefix it — plain codes never contain '.', so the prefix is unambiguous.

const COMPRESS_THRESHOLD = 1500;
const COMPRESSED_PREFIX = 'z.';

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(code: string): Uint8Array {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** ReadableStream over raw bytes (avoids Blob, whose .stream() jsdom lacks). */
function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Compressed share code, or null when the platform lacks CompressionStream. */
async function deflateToCode(json: string): Promise<string | null> {
  try {
    if (typeof CompressionStream === 'undefined') return null;
    const bytes = new TextEncoder().encode(json);
    // cast: the DOM lib types the transform streams as BufferSource-based
    const transform = new CompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>;
    const stream = streamOf(bytes).pipeThrough(transform);
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    return COMPRESSED_PREFIX + bytesToBase64url(buf);
  } catch {
    return null;
  }
}

async function inflateFromCode(code: string): Promise<string | null> {
  try {
    if (typeof DecompressionStream === 'undefined') return null;
    const bytes = base64urlToBytes(code.slice(COMPRESSED_PREFIX.length));
    const transform = new DecompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>;
    const stream = streamOf(bytes).pipeThrough(transform);
    return await new Response(stream).text();
  } catch {
    return null;
  }
}

/** Share code: plain base64url when short, deflate-compressed when long. */
export async function encodeStateAsync(s: ParamState): Promise<string> {
  const plain = encodeState(s);
  if (plain.length <= COMPRESS_THRESHOLD) return plain;
  const compressed = await deflateToCode(JSON.stringify({ v: s.values, o: s.on, m: s.mc }));
  return compressed ?? plain;
}

/** Decode either a plain or a compressed share code (async variant). */
export async function decodeStateAsync(code: string): Promise<ParamState | null> {
  if (code.startsWith(COMPRESSED_PREFIX)) {
    const json = await inflateFromCode(code);
    return json ? stateFromPayloadJson(json) : null;
  }
  return decodeState(code);
}

/** Apply a raw JSON payload onto defaultState, defensively. */
function stateFromPayloadJson(json: string): ParamState | null {
  try {
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

export function decodeState(code: string): ParamState | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    return stateFromPayloadJson(json);
  } catch {
    return null;
  }
}

export function toShareUrl(s: ParamState): string {
  const url = new URL(window.location.href);
  url.searchParams.set('s', encodeState(s));
  return url.toString();
}

/** Share URL with compression for long states (use this one in the UI). */
export async function toShareUrlAsync(s: ParamState): Promise<string> {
  const url = new URL(window.location.href);
  url.searchParams.set('s', await encodeStateAsync(s));
  return url.toString();
}

export function fromLocation(): ParamState | null {
  const s = new URLSearchParams(window.location.search).get('s');
  return s ? decodeState(s) : null;
}

/** Location state incl. compressed codes (async; use when the sync read returns null). */
export async function fromLocationAsync(): Promise<ParamState | null> {
  const s = new URLSearchParams(window.location.search).get('s');
  return s ? decodeStateAsync(s) : null;
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
  // --- City / region presets (roadmap #21): the Grunderwerbsteuer rate is
  // Bundesland-specific (3.5 % … 6.5 %), and price/rent economics differ a lot
  // between cities. Each carries a short "why" in its description.
  {
    name: 'Munich — 850 k€ (Bavaria)',
    nameDe: 'München — 850 k€ (Bayern)',
    description: 'Why: Bavaria has the lowest transfer tax (3.5 %), but extreme price-to-rent — cold rent of 2 900 € against an 850 k€ price makes renting mathematically strong.',
    descriptionDe: 'Warum: Bayern hat die niedrigste Grunderwerbsteuer (3,5 %), aber ein extremes Preis-Miet-Verhältnis — 2 900 € Kaltmiete bei 850 k€ Preis macht das Mieten mathematisch stark.',
    values: {
      property_price: 850_000,
      equity: 255_000,
      grunderwerbsteuer_rate: 3.5,
      makler_rate: 3.57,
      grundsteuer_annual: 900,
      rent_cold: 2_900,
      nebenkosten_monthly: 350,
      rent_increase: 2.5,
      capital_stocks: 80_000,
      capital_bonds: 30_000,
    },
  },
  {
    name: 'Berlin — 590 k€',
    nameDe: 'Berlin — 590 k€',
    description: 'Why: 6.0 % transfer tax (Berlin), historically strong property appreciation and comparably moderate rents — good case for buying if growth holds.',
    descriptionDe: 'Warum: 6,0 % Grunderwerbsteuer (Berlin), historisch starke Wertsteigerungen und vergleichsweise moderate Mieten — gutes Kauf-Argument, solange die Wachstumsraten halten.',
    values: {
      property_price: 590_000,
      equity: 175_000,
      grunderwerbsteuer_rate: 6.0,
      makler_rate: 3.57,
      grundsteuer_annual: 800,
      rent_cold: 1_550,
      nebenkosten_monthly: 280,
      capital_stocks: 55_000,
      capital_bonds: 20_000,
    },
  },
  {
    name: 'Leipzig — 320 k€ (Saxony)',
    nameDe: 'Leipzig — 320 k€ (Sachsen)',
    description: 'Why: affordable purchase with moderate rents — the freed monthly cash flow is small, so the decision is close and highly sensitive to appreciation.',
    descriptionDe: 'Warum: günstiger Kauf bei moderaten Mieten — die monatlich freie Differenz ist klein, damit ist die Entscheidung knapp und stark abhängig von der Wertentwicklung.',
    values: {
      property_price: 320_000,
      equity: 95_000,
      grunderwerbsteuer_rate: 5.5,
      makler_rate: 3.57,
      grundsteuer_annual: 500,
      rent_cold: 950,
      nebenkosten_monthly: 200,
      capital_stocks: 30_000,
      capital_bonds: 12_000,
    },
  },
  {
    name: 'Hamburg — 620 k€',
    nameDe: 'Hamburg — 620 k€',
    description: 'Why: 4.5 % transfer tax (Hamburg), high rents but also high prices — close to the national default, slightly friendlier taxes.',
    descriptionDe: 'Warum: 4,5 % Grunderwerbsteuer (Hamburg), hohe Mieten, aber auch hohe Preise — nah am Bundesdurchschnitt, steuerlich etwas freundlicher.',
    values: {
      property_price: 620_000,
      equity: 185_000,
      grunderwerbsteuer_rate: 4.5,
      makler_rate: 3.57,
      grundsteuer_annual: 750,
      rent_cold: 1_750,
      nebenkosten_monthly: 300,
      capital_stocks: 60_000,
      capital_bonds: 22_000,
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
