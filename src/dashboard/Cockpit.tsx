// src/cockpit/Cockpit.tsx
import "../skin/theme-vars.css";
import "./theme-override.css";

import { useEffect } from "react";
import OdometerStrip from "../dashboard/OdometerStrip";
import InsightsTop3 from "./InsightsTop3";
import Top3AdvicePanel from "./Top3AdvicePanel";
import ActionDrawer from "../dashboard/ActionDrawer";
import ActionBar from "../dashboard/ActionBar";
import CentcomCard from "./CentcomCard";

import { subscribeWire } from "../shared/wire";
import { useEnv } from "../state/env";
import { useFrontIntake } from "../state/intake";
import { useSheetSnap } from "../state/sheetSnap";
import * as Sheet from "../api/sheet";
import ChipRail from "./ChipRail";

import PrimaryConstraintCard from "../cockpit/PrimaryConstraintCard";

import ConditionsPills from "../cockpit/ConditionsPills";

export default function Cockpit() {
  const bulkEnv = useEnv((s) => s.bulk);
  const setSaved = useFrontIntake((s) => s.setSaved);

  // wire ------------------- stores
  useEffect(() => {
    return subscribeWire(({ intake }: any) => {
      if (!intake) return;

      const envPatch: any = {};
      if (typeof intake.tempC === "number") envPatch.leafC = Number(intake.tempC);
      if (typeof intake.rh === "number") envPatch.rh = Number(intake.rh);
      if (typeof intake.ppfd === "number") envPatch.ppfd = Number(intake.ppfd);
      if (typeof intake.runoffEc === "number") envPatch.runoffEc = Number(intake.runoffEc);
      if (Object.keys(envPatch).length) bulkEnv(envPatch);
});
  }, [bulkEnv, setSaved]);

  // Hydrate sheetSnap.latest on first paint so PrimaryConstraintCard / ChipRail
  // render immediately instead of showing the "Awaiting engine snapshot..." shell.
  useEffect(() => {
    let alive = true;
    (async () => {
      const snapState = useSheetSnap.getState();
      if (snapState.latest || snapState.latestWrite) return;
      const saved = (useFrontIntake.getState().saved ?? {}) as Record<string, any>;
      const payload: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(saved)) {
        if (v == null || v === "") continue;
        if (typeof v === "number" || typeof v === "string") payload[k] = v;
      }
      if (!Object.keys(payload).length) return;
      try {
        const res = await Sheet.evaluateRO(payload);
        if (!alive) return;
        useSheetSnap.getState().setLatest(res);
      } catch (err) {
        console.warn("Cockpit hydrate evaluateRO failed", err);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // report height to parent if embedded
  useEffect(() => {
    const post = () =>
      window.parent?.postMessage(
        { type: "cockpit:height", h: document.documentElement.scrollHeight },
        "*"
      );
    post();
    const onResize = () => post();
    window.addEventListener("resize", onResize);
    const mo = new MutationObserver(post);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => {
      window.removeEventListener("resize", onResize);
      mo.disconnect();
    };
  }, []);

  return (
      <div className="cockpit-scope" style={{ display: "flex", minHeight: "100vh", paddingBottom: 80 }}>
      <main style={{ flex: 1, minWidth: 0 }}>
        {/* Gate Odometers — system health at a glance */}
        <OdometerStrip mode="metrics" />

        {/* CENTCOM Analysis — directly under odometers for quick digest */}
        <div className="card crt" style={{ width: "100%", marginTop: 12, marginBottom: 12 }}>
          <CentcomCard />
        </div>

        {/* Detailed metrics: conditions, flags, and advice */}
        <PrimaryConstraintCard>
          <div className="row row-3" style={{ marginTop: 8 }}>
            <div><ConditionsPills gate="ENV" /></div>
            <div><ConditionsPills gate="ROOT" /></div>
            <div><ConditionsPills gate="IRR" /></div>
          </div>

          <InsightsTop3 />
          <Top3AdvicePanel />
          <ChipRail />
        </PrimaryConstraintCard>
      </main>
      <ActionDrawer />
      <ActionBar />
    </div>
  );
}











