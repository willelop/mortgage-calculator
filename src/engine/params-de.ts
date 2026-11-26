/**
 * German localization tables for the parameter registry.
 *
 * Kept next to `engine/params.ts` so the parameter definitions and their
 * German strings live in the same place; the language switch itself lives in
 * `src/i18n.ts`. English strings remain canonical in params.ts.
 */

const GROUP_LABELS_DE: Record<string, string> = {
  global: 'Global',
  purchase: 'Kaufnebenkosten (Deutschland)',
  mortgage: 'Finanzierung / Darlehen',
  rent: 'Mieten',
  invest: 'Kapital & alternative Anlage',
  appreciation: 'Immobilienwert & Verkauf',
  correlations: 'Monte-Carlo-Korrelationen',
};

/** German variants for parameter labels and help texts, keyed by param key. */
const DE_LABELS: Record<string, { label?: string; help?: string }> = {
  // global
  horizon_years: {
    label: 'Zeithorizont',
    help: 'Anzahl der zu simulierenden Jahre.',
  },
  inflation: {
    label: 'Inflationsrate',
    help: 'Wird zur Indexierung wiederkehrender Kosten und (wo aktiviert) von Miete und Preisen verwendet.',
  },
  vol_inflation: {
    label: 'Volatilität — Inflation (σ)',
    help: 'Jährliche Standardabweichung der Inflation in der Monte-Carlo-Simulation.',
  },
  // purchase
  property_price: {
    label: 'Kaufpreis',
    help: 'Vereinbarter Kaufpreis der Immobilie (ohne Kaufnebenkosten).',
  },
  grunderwerbsteuer_rate: {
    label: 'Grunderwerbsteuer',
    help: 'Je nach Bundesland (3,5 %–6,5 %). % vom Kaufpreis, einmalig.',
  },
  notary_rate: {
    label: 'Notar & Verträge',
    help: '% vom Kaufpreis, einmalig.',
  },
  grundbuch_rate: {
    label: 'Grundbuch',
    help: '% vom Kaufpreis, einmalig.',
  },
  makler_rate: {
    label: 'Maklerprovision',
    help: '% vom Kaufpreis; je nach Region unterschiedlich (seit 2020 trägt sie der Käufer).',
  },
  renovation_budget: {
    label: 'Renovierungs-/Modernisierungsbudget',
    help: 'Einmalige Ausgabe direkt nach dem Kauf (Küche, Bad …).',
  },
  grundsteuer_annual: {
    label: 'Grundsteuer',
    help: 'EUR/Jahr, an die Inflation angepasst.',
  },
  building_insurance_annual: {
    label: 'Wohngebäudeversicherung',
    help: 'EUR/Jahr, an die Inflation angepasst.',
  },
  maintenance_rate: {
    label: 'Instandhaltungsrücklage',
    help: '% des Kaufpreises pro Jahr, an die Inflation angepasst.',
  },
  maintenance_lump_year: {
    label: 'Instandhaltung (einmalig) — Jahr',
    help: 'Jahr, in dem der unten angegebene einmalige Instandhaltungsposten anfällt (z. B. neues Dach ~ Jahr 25, Heizung ~ Jahr 20). Nur sichtbar, wenn der Einmalposten aktiviert ist.',
  },
  maintenance_lump_amount: {
    label: 'Instandhaltung (einmalig)',
    help: 'Einmalige Ausgabe im oben gewählten Jahr (Dach, Heizung, Fassade …). Wird aus dem Käufer-Portfolio gezahlt; zusätzlich zur jährlichen %-Rücklage.',
  },
  hausgeld_annual: {
    label: 'Hausgeld / WEG',
    help: 'EUR/Jahr bei einer Eigentumswohnung; standardmäßig aus (Haus angenommen). Hier aktivieren und Betrag eintragen.',
  },
  hausgeld_indexation: {
    label: 'Hausgeld-Anpassung',
    help: 'Wie sich das Hausgeld über die Jahre entwickelt: mit der Inflation (Standard — Verwaltungen passen es meist regelmäßig an), vollständig fix oder mit einer eigenen jährlichen Rate.',
  },
  hausgeld_index_rate: {
    label: 'Hausgeld-Anpassungsrate',
    help: 'Jährliche Erhöhung des Hausgelds in % (nur im Modus „Eigene Rate“).',
  },
  // mortgage
  equity: {
    label: 'Eigenkapital',
    help: 'Gesamtes liquides Kapital für den Kauf (deckt Kosten + Teil des Preises). Nicht verbrauchter Rest bleibt angelegt.',
  },
  fixed_rate: {
    label: 'Sollzins (Zinsbindung)',
    help: 'Nominaler Jahreszins während der Zinsbindungsfrist.',
  },
  disagio_pct: {
    label: 'Disagio (vorausbezahlt)',
    help: 'Einmalige Gebühr an die Bank für einen niedrigeren Zins, % des Nennbetrags des Darlehens (0 = keins). Die Bank zahlt nur (1 − Disagio) des Darlehens aus; die Differenz wird mitfinanziert. Der effektive Zinssatz (in den Ergebnissen) liegt über dem Nominalzins. Faustregel: 1 % Disagio ≈ 0,15–0,25 pp niedrigerer Nominalzins — prüfen, ob sich das lohnt.',
  },
  draw_months: {
    label: 'Auszahlungsphase (sukzessive, Monate)',
    help: 'Gestaffelte Auszahlung bei Neubau (nur Annuität): die Hälfte des Darlehens bei Notar, die andere Hälfte nach dieser Anzahl von Monaten. 0 = sofort komplett. In der Auszahlungsphase wird nicht getilgt und der noch nicht ausgezahlte Teil kostet Bereitstellungszinsen (siehe unten).',
  },
  bereitstellung_pct: {
    label: 'Bereitstellungszinsen',
    help: 'Jahreszins, den die Bank auf den noch nicht ausgezahlten Darlehensanteil während der Auszahlungsphase berechnet (üblich 2–3 %, oft die ersten 3 Monate frei — nicht modelliert). Monatlich zusätzlich zur Rate fällig.',
  },
  fixed_years: {
    label: 'Zinsbindung',
    help: 'Jahre, für die der Zins garantiert ist.',
  },
  followup_rate: {
    label: 'Anschlusszins nach Zinsbindung',
    help: 'Angenommener Zins beim Anschlussdarlehen (oder variablem Zins) nach der Zinsbindung.',
  },
  initial_tilgung: {
    label: 'Anfangstilgung',
    help: '% des ursprünglichen Darlehens, anfangs pro Jahr getilgt.',
  },
  tilgung_mode: {
    label: 'Tilgung definieren über',
    help: 'Bestimmt, wie die Anfangstilgung angegeben wird: als jährlicher Tilgungssatz (deutsche Konvention, % des ursprünglichen Darlehens) oder direkt als gewünschte Monatsrate an die Bank. Im Ratenmodus wird die implizite Anfangstilgung automatisch hergeleitet (in den Ergebnissen angezeigt).',
  },
  monthly_payment: {
    label: 'Gewünschte Monatsrate',
    help: 'Gesamte Monatsrate an die Bank während der Zinsbindung (Zins + Tilgung). Daraus wird die implizite Anfangstilgung abgeleitet — deckt die Rate nicht die anfänglichen Zinsen, findet keine Tilgung statt und das Darlehen schrumpft nie.',
  },
  loan_term_years: {
    label: 'Gesamte Laufzeit',
    help: 'Gesamte Lebensdauer des Darlehens; die Anschlussrate tilgt über die verbleibende Restlaufzeit.',
  },
  tilgung_shape: {
    label: 'Tilgungsform',
    help: 'Wie das Darlehen tilgt: Annuität = konstante Rate (deutscher Standard), linear = konstante Tilgung mit fallender Rate, Tilgungsfreijahre = anfangs nur Zinsen, danach Wiederannuität über die Restlaufzeit, endfällig = nur Zinsen, Gesamtbetrag am Ende fällig (passt zu Bauspar-/KfW-Kombinationen). Der Ratenmodus oben gilt nur für die Annuität.',
  },
  grace_years: {
    label: 'Tilgungsfreijahre',
    help: 'Anzahl der Jahre am Anfang des Darlehens, in denen nur Zinsen gezahlt werden und die Restschuld sich nicht verringert. Danach wird die Rate über die verbleibende Laufzeit neu Annuität berechnet. Üblich bei Neubau während der Bau- oder Vermietungsphase.',
  },
  sondertilgung_pct: {
    label: 'Sondertilgung — % des Darlehens / Jahr',
    help: 'Zusätzliche Tilgung in % des ursprünglichen Darlehens pro Jahr. Standard 0 = keine Sondertilgung; in Optionen aktivieren.',
  },
  sondertilgung_eur: {
    label: 'Sondertilgung — fester Betrag / Jahr',
    help: 'Zusätzliche Tilgung in EUR pro Jahr. Standard 0 = keine Sondertilgung; in Optionen aktivieren.',
  },
  sondertilgung_cap_pct: {
    label: 'Sondertilgung — vertragliche Obergrenze (für Warnung)',
    help: 'Die meisten Sondertilgungsklauseln erlauben höchstens 5 % des ursprünglichen Darlehens pro Jahr — dein Vertrag kann abweichen. Die Warnung über der Aktionsleiste erscheint, wenn deine Sondertilgung diesen Anteil übersteigt; hier den Vertragswert eintragen.',
  },
  ltv_rate_surcharge: {
    label: 'Zinsaufschlag (Beleihungsauslauf)',
    help: 'Banken bepreisen hohe Beleihungsausläufe: +0,25 %-Punkte über 60 % Beleihung, +0,6 % über 80 % — auf Soll- und Anschlusszins. Für realistisches Pricing bei dünnem Eigenkapital einschalten.',
  },
  // rent
  rent_cold: {
    label: 'Kaltmiete',
    help: 'Pro Monat, für eine vergleichbare Immobilie.',
  },
  nebenkosten_monthly: {
    label: 'Nebenkosten',
    help: 'Monatlicher Aufschlag zur Warmmiete (Heizung, Wasser …).',
  },
  rent_increase: {
    label: 'Mietsteigerung',
    help: 'Nominelle Jahresmietsteigerung.',
  },
  rent_increase_linked_to_inflation: {
    label: 'Mietsteigerung folgt Inflation',
    help: 'Wenn aktiv, folgt die Mietsteigerung dem Inflationsparameter.',
  },
  vorabpauschale: {
    label: 'Vorabpauschale (jährliche Fondsvorauszahlung)',
    help: 'Das deutsche Recht besteuert Aktienfonds jährlich über die Vorabpauschale: Basisertrag = Fondsvalue × Basiszins × 70 %, besteuert auf den tatsächlich realisierten Gewinn (mit Teilfreistellung). Die jährliche Versteuerung dämpft den Zinseszinseffekt leicht — die ehrliche deutsche Basis.',
  },
  rent_upfront_costs: {
    label: 'Einzugskosten (Küche, Kautionsprovision …)',
    help: 'Einmalige Kosten beim Einzug in die Mietwohnung.',
  },
  // invest
  capital_stocks: {
    label: 'Aktuelles Kapital — Aktien / ETFs',
    help: 'Heute verfügbares liquides Kapital in Aktien / breit streuenden Aktien-ETFs. Im Mietzweig bleibt es angelegt; beim Kauf kann ein Teil als Eigenkapital verwendet werden.',
  },
  capital_bonds: {
    label: 'Aktuelles Kapital — Anleihen / Sparen',
    help: 'Renten- und tagesgeldähnliche Anlagen.',
  },
  expected_return_stocks: {
    label: 'Erwartete Rendite — Aktien',
    help: 'Nominal p. a., vor Steuern.',
  },
  vol_stocks: {
    label: 'Volatilität — Aktien (σ)',
    help: 'Jährliche Standardabweichung für die Monte-Carlo-Simulation.',
  },
  expected_return_bonds: {
    label: 'Erwartete Rendite — Anleihen / Sparen',
    help: 'Nominal p. a., vor Steuern. Zins 0 modelliert Tagesgeld.',
  },
  vol_bonds: {
    label: 'Volatilität — Anleihen (σ)',
    help: 'Jährliche Standardabweichung für die Monte-Carlo-Simulation.',
  },
  freed_cash_invested: {
    label: 'Gesparte Differenz mietend anlegen',
    help: 'Ist Mieten günstiger als Kaufen, wird die Differenz im Portfolio angelegt. Ist der Schalter aus, verzerrt das Ergebnis stark — es erscheint eine Warnung.',
  },
  capital_gains_tax_rate: {
    label: 'Kapitalertragsteuer (Abgeltungsteuer + Soli)',
    help: '25 % + 5,5 % Soli = 26,375 %.',
  },
  teilfreistellung_rate: {
    label: 'Teilfreistellung (Aktienfonds)',
    help: 'Freibetrag auf Gewinne. 30 % bei Aktienfonds × Fondsanteil (z. B. 50 %) = 15 %.',
  },
  sparerpauschbetrag: {
    label: 'Sparerpauschbetrag',
    help: 'Steuerfreie Gewinne pro Jahr (1 000 € Einzel / 2 000 € Paare).',
  },
  // appreciation
  property_appreciation: {
    label: 'Wertentwicklung Immobilie',
    help: 'Nominelle jährliche Wertsteigerung der Immobilie.',
  },
  vol_property: {
    label: 'Volatilität — Wertentwicklung (σ)',
    help: 'Jährliche Standardabweichung der Wertsteigerung in der Monte-Carlo-Simulation.',
  },
  appreciation_linked_to_inflation: {
    label: 'Wertentwicklung folgt Inflation',
    help: 'Wenn aktiv, entspricht die Wertsteigerung dem Inflationsparameter.',
  },
  sell_at_horizon: {
    label: 'Immobilie am Horizont verkaufen',
    help: 'Rechnet die Immobilie am Ende (abzüglich Kosten & Steuern) in Cash um.',
  },
  selling_costs_rate: {
    label: 'Verkaufskosten (Makler + Notar beim Verkauf)',
    help: '% des Verkaufspreises, beim Verkauf abgezogen.',
  },
  capital_gains_tax_before_10y: {
    label: '§-23-EStG-Steuer bei Verkauf vor 10 Jahren',
    help: 'Selbstgenutzte Immobilie: Gewinne sind nach 10 Jahren steuerfrei. Aus = immer Steuerfreiheit annehmen.',
  },
  // correlations (labels are symbolic; only help text is localized)
  corr_stocks_property: {
    help: 'Korrelation der Aktienrendite- und Immobilienwert-Schocks.',
  },
  corr_stocks_inflation: {
    help: 'Korrelation zwischen jährlichen Aktien- und Inflationsschocks in der Monte-Carlo-Simulation. Aktien gelten als mildes Inflationshedge (0 … 0,3).',
  },
  corr_rent_inflation: {
    help: 'Korrelation zwischen Mietsteigerungs- und Inflationsschocks. Deutsche Mieten folgen dem VPI eng, daher ist ein hoher positiver Wert (≈ 0,9) realistisch.',
  },
};

/** German labels for select options, keyed by '<param.key>:<value>'. */
const SELECT_OPTION_DE: Record<string, string> = {
  'tilgung_mode:0': 'Anfangstilgung (% p. a.)',
  'tilgung_mode:1': 'Monatsrate (€/Monat)',
  'tilgung_shape:0': 'Annuität (konstante Rate)',
  'tilgung_shape:1': 'Linear (konstante Tilgung)',
  'tilgung_shape:2': 'Tilgungsfreijahre',
  'tilgung_shape:3': 'Endfällig (nur Zinsen)',
  'hausgeld_indexation:0': 'Folgt der Inflation',
  'hausgeld_indexation:1': 'Fix (keine Anpassung)',
  'hausgeld_indexation:2': 'Eigene Rate',
};

export function groupLabelDe(g: string): string | undefined {
  return GROUP_LABELS_DE[g];
}

/** Localized label (German when available, English otherwise). */
export function labelOf(d: { key?: string; label: string; labelDe?: string }, lang: 'de' | 'en'): string {
  if (lang !== 'de') return d.label;
  if (d.labelDe) return d.labelDe;
  return (d.key && DE_LABELS[d.key]?.label) || d.label;
}

/** Localized help text (falls back to the English `help`, '' if neither exists). */
export function helpOf(def: { key: string; labelDe?: string; help?: string }, lang: 'de' | 'en'): string {
  const de = DE_LABELS[def.key]?.help;
  return lang === 'de' && de ? de : def.help ?? '';
}

/** Localized label of a select option. */
export function selectOptionLabel(key: string, o: { label: string; labelDe?: string; value: number }, lang: 'de' | 'en'): string {
  if (lang === 'de') {
    const de = o.labelDe ?? SELECT_OPTION_DE[`${key}:${o.value}`];
    if (de) return de;
  }
  return o.label;
}
