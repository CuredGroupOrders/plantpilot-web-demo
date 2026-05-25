import { useCallback, useEffect, useState } from "react";
import * as Sheet from "../api/sheet";
import { loadRules, type StageProfile } from "../data/growroom-rules";
import { useTask } from "../TaskSystems";
import { useSheetSnap } from "../state/sheetSnap";
import { publishWire } from "../shared/wire";
import IntakeWizard, { type WizardConfig } from "../IntakeWizard";
import type { ReactNode } from "react";
import {
  buildEffectivePayload,
  computeDLI,
  computeVPD,
  DEBOUNCE_MS,
  getLastIntake,
  mapScoresFromPayload,
  setLastIntake,
  type ConfigContext,
  type Intake,
} from "./helpers";
import { submitIntakeDraft } from "./submitIntake";

export function useIntakeSession(opts?: { onSubmitted?: () => void }) {
  const { run } = useTask();
  const setLatest = useSheetSnap((s) => s.setLatest);

  const [intake, setIntake] = useState<Intake | null>(() => getLastIntake());
  const [lists, setLists] = useState({
    stagePhase: [] as string[],
    medium: [] as string[],
    containerSize: [] as string[],
    co2Mode: [] as string[],
    lightcycle: [] as string[],
    photoperiodH: [] as string[],
    sopProfile: [] as string[],
  });
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [cfgKey, setCfgKey] = useState<string | null>(null);
  const [wizardConfigApplied, setWizardConfigApplied] = useState(false);
  const [stageProfiles, setStageProfiles] = useState<StageProfile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showNutrient, setShowNutrient] = useState(false);

  useEffect(() => {
    loadRules().then((rules) => setStageProfiles(rules.stageProfiles));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await run(
          { title: "Loading", message: "Fetching options…", cancellable: false },
          async () => {
            await Sheet.fetchCfg();
            const options = await Sheet.fetchOptions();
            setLists({
              stagePhase: options.stagePhase ?? [],
              medium: options.medium ?? [],
              containerSize: options.containerSize ?? [],
              co2Mode: options.co2Mode ?? [],
              lightcycle: options.lightcycle ?? [],
              photoperiodH: options.photoperiodH ?? [],
              sopProfile: options.sopProfile ?? [],
            });
            setTargets(await Sheet.fetchTargets());
          },
        );
      } catch (e) {
        console.warn(e);
      }
    })();
  }, [run]);

  const applyConfig = useCallback(
    async (ctx: ConfigContext): Promise<Record<string, number> | null> => {
      const newKey = JSON.stringify(ctx);
      if (cfgKey === newKey) return targets;
      setCfgKey(newKey);

      return run(
        {
          title: "Updating targets",
          message: "Syncing configuration…",
          cancellable: false,
        },
        async (report, signal) => {
          report.progress(0.2, "Applying config");
          await Sheet.applyConfig(ctx);
          if (signal.aborted) return targets;
          const t = await Sheet.fetchTargets();
          if (signal.aborted) return targets;
          setTargets(t);
          report.progress(1, "Done");
          return t;
        },
      ).catch(() => null);
    },
    [cfgKey, run, targets],
  );

  const handleWizardConfigApplied = useCallback(
    async (config: WizardConfig) => {
      const base = intake ?? ({} as Intake);
      setIntake({
        ...base,
        stage: config.stage,
        medium: config.medium,
        container: config.container,
        co2Mode: config.co2Mode,
        lightcycle: config.lightcycle,
        photoperiodH: config.photoperiodH,
        mode: config.mode,
        profile: config.profile,
      } as Intake);
      await applyConfig({
        stage: config.stage,
        medium: config.medium,
        container: config.container,
        co2Mode: config.co2Mode,
        lightcycle: config.lightcycle,
        photoperiodH: config.photoperiodH,
        profile: config.profile,
      });
      setWizardConfigApplied(true);
    },
    [intake, applyConfig],
  );

  useEffect(() => {
    if (!intake || !wizardConfigApplied) return;
    const t = setTimeout(async () => {
      const d = intake;
      const eff = buildEffectivePayload(d, targets);
      if (!Number.isFinite(eff.tempC as any)) eff.tempC = 24;
      if (!Number.isFinite(eff.rh as any)) eff.rh = 55;
      if (
        !Number.isFinite(eff.vpdKpa as any) &&
        Number.isFinite(eff.tempC as any) &&
        Number.isFinite(eff.rh as any)
      ) {
        eff.vpdKpa = computeVPD(eff.tempC, eff.rh);
      }
      if (!Number.isFinite(eff.ppfd as any)) eff.ppfd = 900;
      if (
        !Number.isFinite(eff.dliMol as any) &&
        Number.isFinite(eff.ppfd as any) &&
        Number.isFinite(d.photoperiodH)
      ) {
        eff.dliMol = computeDLI(eff.ppfd, d.photoperiodH);
      }
      const res = await Sheet.evaluate(eff as any, 0).catch(() => null);
      if (!res) return;
      setLatest(res);
      try {
        publishWire({ type: "sheet:update", payload: res, intake: d });
      } catch {}
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [JSON.stringify(intake), targets, wizardConfigApplied, setLatest]);

  const handleSubmit = useCallback(
    async (draft: Intake) => {
      setSubmitting(true);
      try {
        await run(
          {
            title: "Submit & Calculate",
            message: "Running growroom engine…",
            cancellable: false,
          },
          async (report, signal) => {
            await submitIntakeDraft(draft, {
              targets,
              cfgKey,
              report,
              signal,
            });
          },
        );
        setIntake(draft);
        setLastIntake(draft);
        try {
          localStorage.setItem(
            "smf.last.intake.submitted.v1",
            JSON.stringify(draft),
          );
        } catch {}
        opts?.onSubmitted?.();
      } finally {
        setSubmitting(false);
      }
    },
    [cfgKey, opts, run, targets],
  );

  const wizard: ReactNode = !wizardConfigApplied ? (
    <IntakeWizard
      lists={lists}
      stageProfiles={stageProfiles}
      initialConfig={
        intake
          ? {
              profile: intake.profile ?? "",
              stage: intake.stage,
              medium: intake.medium,
              container: intake.container ?? "",
              co2Mode: intake.co2Mode ?? "",
              lightcycle: intake.lightcycle ?? "",
              photoperiodH: intake.photoperiodH,
              mode: intake.mode ?? "automation",
            }
          : undefined
      }
      onConfigApplied={handleWizardConfigApplied}
      configApplied={false}
    />
  ) : null;

  return {
    intake,
    setIntake,
    lists,
    targets,
    wizardConfigApplied,
    setWizardConfigApplied,
    submitting,
    showChecklist,
    setShowChecklist,
    showNutrient,
    setShowNutrient,
    wizard,
    handleSubmit,
    applyConfig,
  };
}
