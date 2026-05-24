export type GateKey = "ENV" | "ROOT" | "IRR";

export type Top3FlagRow = {
  label: string;
  why: string;
  score: number | null;
  next?: string;
};

export type PrimaryConstraintSnapshot = {
  gate: GateKey;
  label: string;
  why: string;
  confidence: number;
  evidenceKeys: string[];

  // Exact pill strings shown at capture time (no recompute later)
  evidence: string[];

  // Optional exact UI text if you show it
  clearWhen?: string;
};

export type BaselineSnapshot = {
  snapshotId: string;
  capturedAt: number;

  // cfg token / cfg_key active at capture time
  cfgKey: string;

  // submitted intake verbatim
  intakeSubmitted: unknown;
  // Fully populated values used by engine at apply=1 (targets/defaults resolved)
  intakeEffective: Record<string, any>;// exact targets map used to build eff at apply=1
  targets: Record<string, number | null>;

  // gate scores (locked units; recommended 0..100)
  gates: Record<GateKey, number>;

  // authoritative primary constraint snapshot
  primaryConstraint: PrimaryConstraintSnapshot;

  // Top-3 by gate copied from apply=1 payload
  flags: Record<GateKey, Top3FlagRow[]>;

  // audit artifact only (UI must never read from this)
  enginePayloadApply1: unknown;
};

