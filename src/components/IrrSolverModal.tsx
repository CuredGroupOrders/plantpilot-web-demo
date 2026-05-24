import React, { useCallback, useEffect, useRef, useState } from "react";
import { solveIrrDraft, type IrrSolvePlan } from "../api/irr";

export type IrrIntakeDraft = Record<string, unknown>;

type Props = {
  open: boolean;
  onClose: () => void;
  intake: IrrIntakeDraft;
  onApplyFields: (fields: Record<string, unknown>) => void;
};

export function IrrSolverModal({ open, onClose, intake, onApplyFields }: Props) {
  const [plan, setPlan] = useState<IrrSolvePlan | null>(null);
  const [dirty, setDirty] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSolve = useCallback(
    async (d: string[]) => {
      setLoading(true);
      try {
        const p = await solveIrrDraft(intake, d.length ? d : undefined);
        setPlan(p);
      } catch {
        setPlan({ ok: false, error: "solve failed" });
      } finally {
        setLoading(false);
      }
    },
    [intake]
  );

  useEffect(() => {
    if (!open) return;
    setDirty([]);
    void runSolve([]);
  }, [open, intake.stage, intake.stagePhase, intake.profile, intake.medium, intake.container, intake.containerSize, runSolve]);

  useEffect(() => {
    if (!open) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      void runSolve(dirty);
    }, 300);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [open, intake, dirty, runSolve]);

  const markDirty = (field: string) => {
    setDirty((prev) => (prev.includes(field) ? prev : [...prev, field]));
  };

  if (!open) return null;

  const p1e = Number(intake.p1Events) || plan?.p1?.events || 0;
  const p1m = Number(intake.p1MlPerEvent) || 0;
  const p2e = Number(intake.p2Events) || plan?.p2?.events || 0;
  const p2m = Number(intake.p2MlPerEvent) || 0;

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1f2e",
          color: "#e8ecf4",
          borderRadius: 12,
          maxWidth: 520,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 20,
          border: "1px solid #334",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>IRR Solver</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {loading && <p style={{ opacity: 0.7 }}>Calculating…</p>}
        {plan && !plan.ok && <p style={{ color: "#f88" }}>{plan.error}</p>}

        {plan?.ok && (
          <>
            <p style={{ fontSize: 13, opacity: 0.85 }}>
              Demand: <b>{plan.demand?.demand_label ?? "?"}</b> ({plan.demand_index?.toFixed?.(2) ?? "?"}) · Refill{" "}
              <b>{plan.w_refill_ml?.toFixed?.(0) ?? "?"}</b> ml/day · P1 req{" "}
              <b>{plan.p1_required_day_ml?.toFixed?.(0) ?? plan.p1?.required_day_ml?.toFixed?.(0) ?? "?"}</b> · P2 req{" "}
              <b>{plan.p2_required_day_ml?.toFixed?.(0) ?? plan.p2?.required_day_ml?.toFixed?.(0) ?? "?"}</b>
            </p>
            <p style={{ fontSize: 13 }}>
              You: P1 {p1e}×{p1m}={p1e * p1m} ml/day · P2 {p2e}×{p2m}={p2e * p2m} ml/day
            </p>

            {plan.warnings?.length ? (
              <ul style={{ fontSize: 12, color: "#fa8" }}>
                {plan.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : null}

            {advanced && (
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 8 }}>
                <div>FC VWC: {plan.fc_vwc?.toFixed?.(1)} · Start: {plan.vwc_start?.toFixed?.(1)}</div>
                <div>Maint/event: {plan.w_maint_event_ml?.toFixed?.(0)} ml · db%/interval: {plan.dbPct_interval?.toFixed?.(2)}</div>
                {plan.coherence?.map((c, i) => (
                  <div key={i}>{c}</div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  markDirty("p1Events");
                  onApplyFields(plan.actions?.resetToSop ?? {});
                }}
              >
                Reset to SOP
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyFields(plan.actions?.keepUser ?? intake);
                  if (plan.warnings?.length) alert(plan.warnings.join("\n"));
                }}
              >
                Keep My Inputs
              </button>
              <button
                type="button"
                onClick={() => onApplyFields(plan.actions?.applyReconciled ?? {})}
              >
                Apply Reconciled
              </button>
              <button type="button" onClick={() => setAdvanced((a) => !a)}>
                {advanced ? "Simple" : "Advanced"}
              </button>
            </div>
          </>
        )}

        <p style={{ fontSize: 11, opacity: 0.6, marginTop: 12 }}>
          Edit P1/P2 in Intake — solver updates live. Dirty: {dirty.join(", ") || "none"}
        </p>
      </div>
    </div>
  );
}
