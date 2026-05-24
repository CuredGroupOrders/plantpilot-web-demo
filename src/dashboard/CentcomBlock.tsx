import { useEffect, useRef, useState } from "react";
import type { HistoryEntry } from "../state/history";
import { urlForAudio } from "../state/audio";

export default function CentcomBlock({ entry }: { entry: HistoryEntry }) {
  if (!entry.centcom) return null;
  // re-bind as non-null for closures
  const cc = entry.centcom as NonNullable<HistoryEntry["centcom"]>;

  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const revokeRef = useRef<null | (() => void)>(null);

  async function ensureSrc() {
    if (!cc.audioId || !audioRef.current) return;
    if (audioRef.current.src) return;
    const res = await urlForAudio(cc.audioId);
    if (!res) throw new Error("audio missing");
    audioRef.current.src = res.url;
    revokeRef.current = res.revoke;
  }

  async function onTogglePlay() {
    try {
      if (!audioRef.current) return;
      if (playing) {
        audioRef.current.pause();
        return;
      }
      await ensureSrc();
      await audioRef.current.play();
    } catch (e: any) {
      setErr(e?.message || "playback failed");
    }
  }

  useEffect(() => {
    return () => {
      if (revokeRef.current) revokeRef.current();
    };
  }, []);

  const MAX = 280;
  const full = cc.text || "";
  const truncated = full.length > MAX ? full.slice(0, MAX) + "…" : full;

  return (
    <section className="centcom-block" aria-label="Centcom snapshot">
      <header className="centcom-head">CENTCOM</header>

      {full ? (
        <p className="centcom-text">
          {expanded ? full : truncated}
          {full.length > MAX && (
            <button
              type="button"
              className="centcom-more"
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </p>
      ) : null}

      <div className="centcom-audio">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? "Pause audio" : "Play audio"}
          className="centcom-play"
        >
          {playing ? "Pause" : "Play"}
        </button>
        {err ? <span className="centcom-err">{err}</span> : null}
        <audio
          ref={audioRef}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </div>
    </section>
  );
}
