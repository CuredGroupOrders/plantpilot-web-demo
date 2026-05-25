import IntakeForm from "./IntakeForm";
import { useIntakeSession } from "./useIntakeSession";
import SymptomsTab from "../SymptomsTab";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function IntakeModal({ open, onClose }: Props) {
  const session = useIntakeSession({ onSubmitted: onClose });

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop history-backdrop"
      style={{ zIndex: 2000 }}
      onClick={onClose}
    >
      <div
        className="dialog history-panel hud-glass"
        style={{
          width: "min(1100px, 96vw)",
          maxHeight: "92vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Intake"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            position: "sticky",
            top: 0,
            background: "rgba(5,9,11,.95)",
            paddingBottom: 8,
            zIndex: 1,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Intake</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {session.wizard}

        {session.wizardConfigApplied && (
          <IntakeForm
            lists={session.lists}
            initial={session.intake ?? undefined}
            targets={session.targets}
            compactContext
            onReconfigure={() => session.setWizardConfigApplied(false)}
            onDraftChange={(d) => session.setIntake(d)}
            onOpenChecklist={() => session.setShowChecklist(true)}
            onOpenNutrient={() => session.setShowNutrient(true)}
            onApplyConfig={session.applyConfig}
            onSubmit={session.handleSubmit}
          />
        )}

        {session.showChecklist && (
          <div style={{ marginTop: 12 }}>
            <SymptomsTab />
            <button
              type="button"
              className="btn ghost"
              style={{ marginTop: 8 }}
              onClick={() => session.setShowChecklist(false)}
            >
              Back to intake
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
