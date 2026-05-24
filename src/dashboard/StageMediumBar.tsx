import React from "react";
import { useIntake, STAGE_PHASES, MEDIA } from "../state/intake";

const StageMediumBar: React.FC = () => {
  const saved = useIntake((s) => s.saved);
  const setSaved = useIntake((s) => s.setSaved);

  const onStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSaved("stagePhase", e.target.value as (typeof STAGE_PHASES)[number]);
  };

  const onMediumChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSaved("medium", e.target.value as (typeof MEDIA)[number]);
  };

  return (
    <div className="stage-medium-bar">
      <div className="field">
        <label>Stage</label>
        <select aria-label="Stage" value={saved.stagePhase} onChange={onStageChange}>
          {STAGE_PHASES.map((sp) => (
            <option key={sp} value={sp}>
              {sp}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Medium</label>
        <select aria-label="Medium" value={saved.medium} onChange={onMediumChange}>
          {MEDIA.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default StageMediumBar;
