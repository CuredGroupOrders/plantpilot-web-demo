// src/labels.ts
//
// Single source of truth for intake key -> Sheet/engine label mapping.
// All other label maps (api/sheet.ts KEY_TO_LABEL, shared/sheet-bridge.ts) MUST import
// from here so the GAS path, the local XLSX path and the engine drift detector all agree.
export const key2label: Record<string, string> = {
  // context
  stage: "Stage",
  stagePhase: "Stage",
  medium: "Media",
  container: "Container_gal",
  containerSize: "Container_gal",
  co2Mode: "CO2 mode",
  lightcycle: "Lightcycle",
  photoperiodH: "Photoperiod (h)",

  // UI-only context (added so submitted payloads don't fall through to the raw key)
  mode: "Mode", // automation / handwater
  profile: "SOP profile", // SOP profile selector

  // ENV
  tempC: "Canopy temp (°C)",
  rh: "RH (%)",
  vpdKpa: "VPD (kPa)",
  ppfd: "PPFD (µmol/m²/s)",
  dliMol: "DLI (mol/m²/d)",
  co2: "CO2 (ppm)",

  // ROOT
  runoffPh: "Runoff pH",
  runoffPct: "Runoff %",
  reservoirEc: "Reservoir EC (mS/cm)",
  reservoirPh: "Reservoir pH",
  reservoirTempC: "Reservoir temp (°C)",
  pwec: "PWEC (mS/cm)",
  vwcAtLastIrr: "VWC% at last irrigation",
  runoffEc: "Runoff EC (mS/cm)",

  // IRR
  // NOTE: engine writes "Dryback last 24h (%)" in older payloads but the live UI label is
  // "Overnight dryback % target" (matches Intake!A). Keep the user-facing label as the
  // source of truth; the engine drift detector below logs any keys it sees that we miss.
  drybackPct24h: "Overnight dryback % target",
  targetAtFirst: "Target at first event",

  // P1 / P2
  p1Events: "P1 events",
  p1IntervalMin: "P1 interval (min)",
  p1Pct: "P1 %",
  p1MlPerEvent: "ml per P1 event",
  p1SecPerEvent: "Seconds per P1 event",
  p2Events: "P2 events",
  p2IntervalMin: "P2 interval (min)",
  p2Pct: "P2 %",
  p2MlPerEvent: "ml per P2 event",
  p2SecPerEvent: "Seconds per P2 event",

  // extras present in your Intake!A
  vwcPct: "VWC (%)",
  eventsPerDay: "Irrigations in last 24h",
};

// reverse map for label -> key lookups
export const label2key: Record<string, string> =
  Object.fromEntries(Object.entries(key2label).map(([k, v]) => [v, k]));

/**
 * Aliases for engine-side label spellings that we want to map back to the same key.
 * Keep this small; prefer adding rows to `key2label` directly.
 */
export const labelAliases: Record<string, string> = {
  // historical engine spelling for dryback
  "Dryback last 24h (%)": "drybackPct24h",
};

/** Resolve a label produced by the engine back to an intake key, with alias support. */
export function labelToKey(label: string): string | undefined {
  if (label2key[label]) return label2key[label];
  if (labelAliases[label]) return labelAliases[label];
  return undefined;
}
