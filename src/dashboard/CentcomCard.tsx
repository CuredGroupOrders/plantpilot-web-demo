// src/dashboard/CentcomCard.tsx
import { useState, useRef, useEffect } from "react";
import { attachCentcomSnapshot } from "../attachOnGenerate";

import { apiUrl } from "../lib/apiUrl";

/**
 * CENTCOM diagnostics — explain/humanized + expanded via sidecar (VITE_SIDECAR_BASE or Vite proxy).
 */

// Lock to Azure TTS. Allow optional client hints for voice/rate/pitch/volume.
const TTS_PROVIDER = "azure"; // keep Azure
const TTS_VOICE =
  (import.meta as any).env?.VITE_TTS_VOICE || "Onyx Turbo Multilingual";
const TTS_RATE =
  (import.meta as any).env?.VITE_TTS_RATE || "+15%"; // slightly faster default
const TTS_PITCH =
  (import.meta as any).env?.VITE_TTS_PITCH || "0%";
const TTS_VOLUME =
  (import.meta as any).env?.VITE_TTS_VOLUME || "0%";

export default function CentcomCard() {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [adding, setAdding] = useState(false);

  // Audio element and URL cleanup
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const revokeRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    return () => {
      if (revokeRef.current) revokeRef.current();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // Safe params: fetch fresh GAS, no strict quality trap on cold cache.
  const QS_SAFE = "fast=0&nogas=0&strict=0";
  const QS_HUMANIZED = `${QS_SAFE}&llm_ms=90000&max=1200`;   // UI waits 95s
  const QS_EXPANDED  = `${QS_SAFE}&llm_ms=90000&max=1200`;   // UI waits 95s as well

  function humanizedUrl(ts: number) {
    return `${apiUrl("/sheet/explain/humanized")}?ts=${ts}&${QS_HUMANIZED}`;
  }
  function expandedUrl(ts: number) {
    return `${apiUrl("/sheet/explain/expanded")}?ts=${ts}&${QS_EXPANDED}`;
  }

  async function fetchJSON(url: string, ms = 45000) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      const r = await fetch(url, {
        signal: ac.signal,
        cache: "no-store",
        headers: {
          "cache-control": "no-cache, no-store, must-revalidate",
          pragma: "no-cache",
          expires: "0",
          accept: "application/json",
        },
      });
      if (!r.ok) {
        let msg = `HTTP ${r.status}`;
        try {
          const j = await r.json();
          const em = (j && (j.error || j.message || j.text)) as string | undefined;
          if (em) msg = em;
        } catch {}
        throw new Error(msg);
      }
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function getReport(): Promise<string> {
    const ts = Date.now();

    try {
      const d = await fetchJSON(humanizedUrl(ts), 95000); // 95s UI timeout
      const s: unknown = d?.text ?? d?.humanized_text;
      if (typeof s === "string" && s.trim().length > 0) return s;
    } catch {}

    try {
      const d2 = await fetchJSON(expandedUrl(ts), 95000); // 95s UI timeout
      const s2: unknown = d2?.expanded_text ?? d2?.json?.summary;
      if (typeof s2 === "string" && s2.trim().length > 0) return s2;
    } catch {}

    throw new Error("CENTCOM Offline");
  }

  async function typeOut(s: string) {
    const delay = 20;
    setText("");
    for (let i = 0; i < s.length; i++) {
      const jitter = i % 17 === 0 ? 5 : 0;
      await new Promise((r) => setTimeout(r, delay + jitter));
      setText((p) => p + s[i]);
    }
  }

  async function generate() {
    setErr(null);
    setTyping(true);
    setText("");
    try {
      const body = await getReport();
      await typeOut(body);
      // No auto-save here. Use the explicit button to avoid duplicate history.
    } catch (e: any) {
      setErr(e?.message || "CENTCOM Offline");
    } finally {
      setTyping(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  function cleanupUrl() {
    if (revokeRef.current) {
      revokeRef.current();
      revokeRef.current = null;
    }
  }

  function ensureAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      const a = new Audio();
      a.onended = () => { cleanupUrl(); setPlaying(false); };
      a.onerror = () => { cleanupUrl(); setPlaying(false); };
      audioRef.current = a;
    }
    return audioRef.current;
  }

  // Always synth fresh audio via /speak using Azure by default.
  async function startAudioFromHistoryOrTTS() {
    const a = ensureAudio();

    const r = await fetch(`${apiUrl("/speak")}?ts=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify({
        text,
        provider: TTS_PROVIDER,      // "azure"
        voice: TTS_VOICE,            // "Onyx Turbo Multilingual" by default
        rate: TTS_RATE,
        pitch: TTS_PITCH,
        volume: TTS_VOLUME,
      }),
    });
    if (!r.ok) throw new Error("TTS failed");

    const blob = await r.blob();
    const url = URL.createObjectURL(blob);

    cleanupUrl();
    revokeRef.current = () => URL.revokeObjectURL(url);

    a.pause();
    a.removeAttribute("src");
    a.load();

    a.src = url;
    a.setAttribute("data-rev", String(Date.now()));
    await a.play();
    setPlaying(true);
  }

  function stopAudio() {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    cleanupUrl();
    setPlaying(false);
  }

  async function playToggle() {
    if (!text) return;
    if (playing) {
      stopAudio();
      return;
    }
    try {
      await startAudioFromHistoryOrTTS();
    } catch (e: any) {
      console.warn("Play error:", e?.message || e);
      setPlaying(false);
    }
  }

  async function addToLastHistory() {
    if (!text) return;
    setAdding(true);
    try {
      await attachCentcomSnapshot({
        text,
        // json: undefined,
        // model: "gpt-5",
        // ttsVoice: TTS_VOICE,
      });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        padding: 16,
        backgroundColor: "#000",
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 2px)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        color: "var(--ink, #e7e7ea)",
      }}
    >
      <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, letterSpacing: 1 }}>CENTCOM // ANALYSIS</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={generate} disabled={typing} className="btn"
            style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6,
                     background: "transparent", color: "var(--ink, #e7e7ea)", cursor: typing ? "not-allowed" : "pointer", opacity: typing ? 0.7 : 1 }}
            aria-label="Generate Diagnostics Report">
            {typing ? "Generating…" : "Generate Diagnostics Report"}
          </button>

          <button onClick={copy} disabled={!text} className="btn"
            style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6,
                     background: "transparent", color: "var(--ink, #e7e7ea)", cursor: text ? "pointer" : "not-allowed", opacity: text ? 1 : 0.6 }}
            aria-label="Copy">
            {copied ? "Copied" : "Copy"}
          </button>

          <button onClick={playToggle} disabled={!text} className="btn"
            style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6,
                     background: "transparent", color: "var(--ink,#e7e7ea)", opacity: text ? 1 : 0.6 }}
            aria-label={playing ? "Stop" : "Play"}>
            {playing ? "Stop" : "Play"}
          </button>

          <button onClick={addToLastHistory} disabled={!text || adding} className="btn"
            style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6,
                     background: "transparent", color: "var(--ink,#e7e7ea)", opacity: text && !adding ? 1 : 0.6 }}
            aria-label="Add to last history">
            {adding ? "Adding…" : "Add to Last History"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
        Generate calls the sidecar diagnostics engine.
      </div>

      {err && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--accent-pink, #f87171)" }}>
          {err}
        </div>
      )}

      {text && (
        <pre style={{
          marginTop: 12, whiteSpace: "pre-wrap",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 12, lineHeight: 1.5, background: "rgba(0,0,0,0.65)",
          border: "1px solid var(--border)", borderRadius: 6, padding: 12,
          position: "relative", color: "#00ffcc", textShadow: "0 0 2px #00ffcc",
        }}>
          {text}
          <span style={{
            opacity: typing ? 1 : 0, borderLeft: "2px solid var(--ink, #00ffcc)",
            marginLeft: 2, display: "inline-block", height: "1em", verticalAlign: "-0.2em",
          }} />
        </pre>
      )}
    </div>
  );
}
