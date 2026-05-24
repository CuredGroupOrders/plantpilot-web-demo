// src/dashboard/ActionBar.tsx
import { useEffect, useRef, useState } from "react";
import { useUi } from "../state/ui";
import { useEnv } from "../state/env";
import { useFrontIntake } from "../state/intake";
import { useChips } from "../state/selectors/chips";
import { useActions } from "../state/actions";
import { useActionStatus } from "../state/selectors/actionStatus";
import BaselineHistory from "./BaselineHistory";
import "../cockpit/embedded.css";
import { useHistory } from "../state/history";
import CameraCapture from "./CameraCapture";

const __EMBED__ =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("embed");

if (__EMBED__) {
  document.documentElement.classList.add("cockpit-embedded");
  const send = () => {
    const h = document.documentElement.scrollHeight;
    window.parent?.postMessage({ type: "cockpit:height", h }, "*");
  };
  if (document.readyState === "loading") {
    window.addEventListener("load", send, { once: true });
  } else send();
  new ResizeObserver(send).observe(document.body);
  window.addEventListener("resize", send);
}

function vibrate(ms = 30) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

export default function ActionBar() {
  const { showHistory, toggleHistory, hideHistory } = useUi();
  const [toast, setToast] = useState("");
  const [camOpen, setCamOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const { all } = useChips(3);
  const acts = useActions((s) => s.list);
  const { counts } = useActionStatus();
  const attachPhoto = useHistory((s) => s.attachPhotoToLatest);
  const fileRef = useRef<HTMLInputElement>(null);

  function ping(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1200);
    vibrate();
  }

  async function startCamera() {
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

      const constraints: MediaStreamConstraints = isMobile
        ? { video: { facingMode: { ideal: "environment" } }, audio: false }
        : { video: true, audio: false };

      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);
    } catch (err) {
      console.error("startCamera error:", err);
      setStream(null);
      setCamOpen(false);
      ping("Camera unavailable");
    }
  }

  function stopCamera() {
    if (stream) {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {}
    }
    setStream(null);
  }

  // tie stream lifecycle to camOpen
  useEffect(() => {
    if (camOpen && !stream) {
      startCamera();
    }
    if (!camOpen && stream) {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camOpen]);

  // kill camera on unmount just in case
  useEffect(() => {
    return () => {
      if (stream) {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCopyShare() {
    const ORDER: Array<"ENV" | "ROOT" | "IRR"> = ["ENV", "ROOT", "IRR"];
    const status = new Map(acts.map((a: any) => [a.chipId, a.status]));
    const mark = (s: string) =>
      s === "done" ? "[x]" : s === "skipped" ? "[-]" : "[ ]";
    const byGate: any = {};
    for (const c of all) (byGate[c.gate] ||= []).push(c);

    const lines: string[] = [];
    for (const g of ORDER) {
      const list = byGate[g];
      if (!list?.length) continue;
      lines.push(`== ${g} ==`);
      for (const c of list) {
        lines.push(
          `• ${mark(status.get(c.id) as string)} ${c.title}: ${c.why}${
            c.next ? ` → ${c.next}` : ""
          }`,
        );
      }
      lines.push("");
    }
    const text = lines.join("\n") || "Plan: none";
    try {
      if (navigator.share) {
        await navigator.share({ text, title: "Plan" });
        ping("Shared");
      } else {
        await navigator.clipboard.writeText(text);
        ping("Copied");
      }
    } catch {}
  }

  function onReset() {
    const E = useEnv.getState();
    E.bulk?.({ leafC: 26, rh: 55, ppfd: 600, runoffEc: undefined });

    const I = useFrontIntake.getState();
    if (I.setMany) {
      I.setMany({
        ph: 5.8 as any,
        ec: 2.2 as any,
        vwc: 35 as any,
        irrigationsLast24h: undefined as any,
      });
    } else if (I.setSaved) {
      I.setSaved("ph" as any, 5.8 as any);
      I.setSaved("ec" as any, 2.2 as any);
      I.setSaved("vwc" as any, 35 as any);
    }
    ping("Reset");
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const env = { ...(useEnv.getState().saved ?? {}) };
    const intake = { ...(useFrontIntake.getState().saved ?? {}) };
    const ok = await attachPhoto(f, { env, intake, name: "trend" });
    if (ok) ping("Photo saved");
    e.target.value = "";
  }

  function onPhotoRecon() {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    if (isMobile) {
      fileRef.current?.click();
    } else {
      setCamOpen(true);
    }
  }

  function closeCameraPanel() {
    setCamOpen(false); // useEffect will stopCamera() and turn LED off
  }

  const bar: React.CSSProperties = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    background: "var(--panel)",
    borderTop: "1px solid var(--border)",
    padding: "8px 12px",
    paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
  };
  const row: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: 8,
  };
  const btn: React.CSSProperties = {
    background: "var(--chip)",
    color: "#e5e7eb",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "12px 10px",
    fontSize: 16,
  };
  const toastStyle: React.CSSProperties = {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: 64,
    background: "var(--chip)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 12px",
    zIndex: 60,
  };

  return (
    <>
      <div style={bar}>
        <div style={row}>
          <button style={btn} onClick={toggleHistory}>
            History
          </button>
          <button style={btn} onClick={onPhotoRecon}>
            Photo Recon
          </button>
          <button style={btn} onClick={onCopyShare}>
            Copy/Share Plan
            {counts.total ? ` (${counts.total})` : ""}
          </button>
          <button style={btn} onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      {/* Mobile fallback: native capture hint */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*;capture=camera"
        capture="environment"
        style={{ display: "none" }}
        onChange={onPickPhoto}
      />

      {toast && <div style={toastStyle}>{toast}</div>}

      {showHistory && (
        <div className="dialog-backdrop history-backdrop" onClick={hideHistory}>
          <div
            className="dialog hud-glass history-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "85vh", overflowY: "auto" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h3 style={{ margin: 0 }}>History</h3>
              <button className="btn" onClick={hideHistory}>
                Close
              </button>
            </div>
            <BaselineHistory />
          </div>
        </div>
      )}

      {camOpen && (
        <div
          className="dialog-backdrop history-backdrop"
          onClick={closeCameraPanel}
        >
          <div
            className="dialog hud-glass"
            onClick={(e) => e.stopPropagation()}
          >
            <CameraCapture
              stream={stream}
              onClose={closeCameraPanel}
              onShot={async (blob) => {
                const env = { ...(useEnv.getState().saved ?? {}) };
                const intake = { ...(useFrontIntake.getState().saved ?? {}) };
                const ok = await attachPhoto(blob, {
                  env,
                  intake,
                  name: "trend",
                });
                closeCameraPanel();
                if (ok) ping("Photo saved");
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
