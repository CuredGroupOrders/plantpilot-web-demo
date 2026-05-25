import { useEffect } from "react";
import Cockpit from "../dashboard/Cockpit";
import IntakeModal from "../intake/IntakeModal";
import SymptomsTab from "../SymptomsTab";
import { useUi } from "../state/ui";
import { getLastIntake } from "../intake/helpers";

export default function HomePage() {
  const showIntake = useUi((s) => s.showIntake);
  const showSymptoms = useUi((s) => s.showSymptoms);
  const closeIntake = useUi((s) => s.closeIntake);
  const closeSymptoms = useUi((s) => s.closeSymptoms);
  const openIntake = useUi((s) => s.openIntake);

  useEffect(() => {
    if (!getLastIntake()) {
      openIntake();
    }
  }, [openIntake]);

  return (
    <div className="cockpit-home hud-skin-neo" style={{ minHeight: "100vh" }}>
      <Cockpit />
      <IntakeModal open={showIntake} onClose={closeIntake} />
      {showSymptoms && (
        <div
          className="dialog-backdrop history-backdrop"
          style={{ zIndex: 2000 }}
          onClick={closeSymptoms}
        >
          <div
            className="dialog history-panel hud-glass"
            style={{ width: "min(720px, 96vw)", maxHeight: "85vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h2 style={{ margin: 0 }}>Symptoms</h2>
              <button type="button" className="btn ghost" onClick={closeSymptoms}>
                Close
              </button>
            </div>
            <SymptomsTab />
          </div>
        </div>
      )}
    </div>
  );
}
