import { useState, useEffect, useMemo, useCallback } from "react";
import SopProfileBadge from "./components/SopProfileBadge";
import type { StageProfile } from "./data/growroom-rules";

export type WizardConfig = {
  profile: string;
  stage: string;
  medium: string;
  container: string;
  co2Mode: string;
  lightcycle: string;
  photoperiodH: number;
  mode: string;
};

type Props = {
  lists: {
    stagePhase: string[];
    medium: string[];
    containerSize: string[];
    co2Mode: string[];
    lightcycle: string[];
    photoperiodH: string[];
    sopProfile: string[];
  };
  stageProfiles: StageProfile[];
  initialConfig?: Partial<WizardConfig>;
  onConfigApplied: (config: WizardConfig) => void;
  configApplied: boolean;
};

type WizardStep = "profile" | "config" | "ready";

export default function IntakeWizard({
  lists,
  stageProfiles,
  initialConfig,
  onConfigApplied,
  configApplied,
}: Props) {
  const [step, setStep] = useState<WizardStep>(
    configApplied ? "ready" : "profile"
  );
  const [profile, setProfile] = useState(
    initialConfig?.profile ?? lists.sopProfile?.[0] ?? "Default"
  );
  const [stage, setStage] = useState(
    initialConfig?.stage ?? lists.stagePhase?.[0] ?? ""
  );
  const [medium, setMedium] = useState(
    initialConfig?.medium ?? lists.medium?.[0] ?? ""
  );
  const [container, setContainer] = useState(
    initialConfig?.container ?? ""
  );
  const [co2Mode, setCo2Mode] = useState(
    initialConfig?.co2Mode ?? lists.co2Mode?.[0] ?? ""
  );
  const [lightcycle, setLightcycle] = useState(
    initialConfig?.lightcycle ?? lists.lightcycle?.[0] ?? ""
  );
  const [photoperiodH, setPhotoperiodH] = useState(
    initialConfig?.photoperiodH ?? Number(lists.photoperiodH?.[0] ?? 12)
  );
  const [mode, setMode] = useState(initialConfig?.mode ?? "automation");

  const profileKey = profile.toLowerCase().replace(/\s+/g, "");

  const validOptionsForProfile = useMemo(() => {
    const profileProfiles = stageProfiles.filter(
      (p) => p.key.toLowerCase().endsWith(profileKey)
    );

    const stages = new Set<string>();
    const co2Modes = new Set<string>();
    const lightcycles = new Set<string>();
    const photoperiods = new Set<number>();

    for (const p of profileProfiles) {
      if (p.phase) stages.add(p.phase);
      if (p.co2_mode) co2Modes.add(p.co2_mode);
      if (p.lightcycle) lightcycles.add(p.lightcycle);
      if (p.photoperiod_h) photoperiods.add(p.photoperiod_h);
    }

    return {
      stages: stages.size > 0 ? stages : new Set(lists.stagePhase),
      co2Modes: co2Modes.size > 0 ? co2Modes : new Set(lists.co2Mode),
      lightcycles:
        lightcycles.size > 0 ? lightcycles : new Set(lists.lightcycle),
      photoperiods:
        photoperiods.size > 0
          ? photoperiods
          : new Set(lists.photoperiodH.map(Number)),
      containers: new Set(lists.containerSize),
      mediums: new Set(lists.medium),
    };
  }, [profileKey, stageProfiles, lists]);

  useEffect(() => {
    if (
      step === "config" &&
      validOptionsForProfile.stages.size > 0 &&
      !validOptionsForProfile.stages.has(stage)
    ) {
      setStage([...validOptionsForProfile.stages][0]);
    }
  }, [step, profile, stage, validOptionsForProfile]);

  const handleProfileNext = useCallback(() => {
    if (!profile) return;
    setStep("config");
  }, [profile]);

  const handleConfigApply = useCallback(() => {
    const config: WizardConfig = {
      profile,
      stage,
      medium,
      container,
      co2Mode,
      lightcycle,
      photoperiodH,
      mode,
    };
    onConfigApplied(config);
    setStep("ready");
  }, [
    profile,
    stage,
    medium,
    container,
    co2Mode,
    lightcycle,
    photoperiodH,
    mode,
    onConfigApplied,
  ]);

  const handleReconfigure = useCallback(() => {
    setStep("profile");
  }, []);

  const isOptionAvailable = (
    optionSet: Set<string> | Set<number>,
    value: string | number
  ) => {
    return (optionSet as Set<any>).has(value);
  };

  const cardStyle: React.CSSProperties = {
    padding: 16,
    border: "1px solid var(--border, #333)",
    borderRadius: 8,
    marginBottom: 12,
    background: "var(--card-bg, #111)",
  };

  const stepIndicator = (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 16,
        alignItems: "center",
      }}
    >
      {(["profile", "config", "ready"] as WizardStep[]).map((s, i) => {
        const labels = ["SOP Profile", "Configuration", "Intake Inputs"];
        const active = s === step;
        const done =
          (s === "profile" && (step === "config" || step === "ready")) ||
          (s === "config" && step === "ready");
        return (
          <div
            key={s}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                background: done
                  ? "#10b981"
                  : active
                  ? "var(--accent, #3b82f6)"
                  : "#333",
                color: "#fff",
              }}
            >
              {done ? "✓" : i + 1}
            </div>
            <span
              style={{
                fontSize: 13,
                color: active
                  ? "#fff"
                  : done
                  ? "#10b981"
                  : "#666",
                fontWeight: active ? 600 : 400,
              }}
            >
              {labels[i]}
            </span>
            {i < 2 && (
              <span style={{ color: "#444", margin: "0 4px" }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );

  if (step === "profile") {
    return (
      <div>
        {stepIndicator}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 12px" }}>Select SOP Profile</h3>
          <p style={{ fontSize: 13, color: "#999", margin: "0 0 16px" }}>
            Choose the Standard Operating Procedure profile for this grow.
            This determines available configurations and target ranges.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            {(lists.sopProfile.length ? lists.sopProfile : ["Default"]).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setProfile(p)}
                  style={{
                    padding: "12px 16px",
                    border:
                      profile === p
                        ? "2px solid var(--accent, #3b82f6)"
                        : "1px solid var(--border, #333)",
                    borderRadius: 8,
                    background:
                      profile === p ? "rgba(59,130,246,0.1)" : "transparent",
                    color: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p}</div>
                </button>
              )
            )}
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn"
              onClick={handleProfileNext}
              disabled={!profile}
              style={{
                padding: "10px 24px",
                background: profile ? "var(--accent, #3b82f6)" : "#333",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: profile ? "pointer" : "not-allowed",
                fontWeight: 600,
              }}
            >
              Next: Configure →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "config") {
    return (
      <div>
        {stepIndicator}
        <div style={{ marginBottom: 12 }}>
          <SopProfileBadge profileKey={profile} />
        </div>
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 12px" }}>Grow Configuration</h3>
          <p style={{ fontSize: 13, color: "#999", margin: "0 0 16px" }}>
            Set your grow parameters. Options unavailable for this SOP profile
            are greyed out.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <label style={{ fontSize: 12, color: "#aaa", display: "block", marginBottom: 4 }}>
                Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={{ width: "100%" }}
              >
                {["automation", "handwater"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#aaa", display: "block", marginBottom: 4 }}>
                Stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                style={{ width: "100%" }}
              >
                {(lists.stagePhase.length
                  ? lists.stagePhase
                  : ["early veg", "late veg", "early bloom", "mid bloom", "late bloom", "flush"]
                ).map((v) => {
                  const available = isOptionAvailable(validOptionsForProfile.stages, v);
                  return (
                    <option
                      key={v}
                      value={v}
                      disabled={!available}
                      style={{ color: available ? "inherit" : "#555" }}
                    >
                      {v}{!available ? " (not in SOP)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#aaa", display: "block", marginBottom: 4 }}>
                Medium
              </label>
              <select
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                style={{ width: "100%" }}
              >
                {(lists.medium.length
                  ? lists.medium
                  : ["coco", "rockwool", "soil", "dwc"]
                ).map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#aaa", display: "block", marginBottom: 4 }}>
                Container / Bed
              </label>
              {lists.containerSize.length ? (
                <select
                  value={container}
                  onChange={(e) => setContainer(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">—</option>
                  {lists.containerSize.map((v) => {
                    const available = isOptionAvailable(
                      validOptionsForProfile.containers,
                      v
                    );
                    return (
                      <option
                        key={v}
                        value={v}
                        disabled={!available}
                        style={{ color: available ? "inherit" : "#555" }}
                      >
                        {v}{!available ? " (not in SOP)" : ""}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  value={container}
                  onChange={(e) => setContainer(e.target.value)}
                  placeholder="1 / 2 / bed"
                  style={{ width: "100%" }}
                />
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#aaa", display: "block", marginBottom: 4 }}>
                CO₂ Mode
              </label>
              <select
                value={co2Mode}
                onChange={(e) => setCo2Mode(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">—</option>
                {(lists.co2Mode.length ? lists.co2Mode : ["ambient", "co2"]).map(
                  (v) => {
                    const available = isOptionAvailable(
                      validOptionsForProfile.co2Modes,
                      v
                    );
                    return (
                      <option
                        key={v}
                        value={v}
                        disabled={!available}
                        style={{ color: available ? "inherit" : "#555" }}
                      >
                        {v}{!available ? " (not in SOP)" : ""}
                      </option>
                    );
                  }
                )}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#aaa", display: "block", marginBottom: 4 }}>
                Lightcycle
              </label>
              <select
                value={lightcycle}
                onChange={(e) => setLightcycle(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">—</option>
                {(lists.lightcycle.length
                  ? lists.lightcycle
                  : ["Day", "Night"]
                ).map((v) => {
                  const available = isOptionAvailable(
                    validOptionsForProfile.lightcycles,
                    v
                  );
                  return (
                    <option
                      key={v}
                      value={v}
                      disabled={!available}
                      style={{ color: available ? "inherit" : "#555" }}
                    >
                      {v}{!available ? " (not in SOP)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#aaa", display: "block", marginBottom: 4 }}>
                Photoperiod (h)
              </label>
              {lists.photoperiodH.length ? (
                <select
                  value={String(photoperiodH)}
                  onChange={(e) => setPhotoperiodH(+e.target.value)}
                  style={{ width: "100%" }}
                >
                  {lists.photoperiodH.map((v) => {
                    const numV = Number(v);
                    const available = isOptionAvailable(
                      validOptionsForProfile.photoperiods,
                      numV
                    );
                    return (
                      <option
                        key={v}
                        value={String(numV)}
                        disabled={!available}
                        style={{ color: available ? "inherit" : "#555" }}
                      >
                        {numV}h{!available ? " (not in SOP)" : ""}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="number"
                  value={photoperiodH}
                  onChange={(e) => setPhotoperiodH(+e.target.value)}
                  style={{ width: "100%" }}
                />
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <button
              className="btn"
              onClick={() => setStep("profile")}
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: "#999",
                border: "1px solid #444",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
            <button
              className="btn"
              onClick={handleConfigApply}
              disabled={!stage}
              style={{
                padding: "10px 24px",
                background: stage ? "#10b981" : "#333",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: stage ? "pointer" : "not-allowed",
                fontWeight: 600,
              }}
            >
              Apply Configuration & Load Targets
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {stepIndicator}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "rgba(16,185,129,0.1)",
          border: "1px solid rgba(16,185,129,0.3)",
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SopProfileBadge profileKey={profile} />
          <span style={{ color: "#10b981" }}>
            {stage} · {medium} · {co2Mode || "ambient"} · {lightcycle || "Day"} · {photoperiodH}h
          </span>
        </div>
        <button
          onClick={handleReconfigure}
          style={{
            padding: "4px 12px",
            background: "transparent",
            color: "#999",
            border: "1px solid #444",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Reconfigure
        </button>
      </div>
    </div>
  );
}
