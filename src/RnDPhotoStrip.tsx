// src/RnDPhotoStrip.tsx
import { useEffect, useState } from "react";
import type { RnDPhotoRecord } from "./api/sheet";
import { urlForPhoto } from "./state/photos";

type Props = {
  photos: RnDPhotoRecord[];
  onCapture?: () => void;
  isSaving?: boolean;
  onDelete: (photo: RnDPhotoRecord) => void;
  canCapture?: boolean;
  captureHint?: string;
};

type PreviewState = {
  url: string;
  label: string;
  gates?: string;
  when?: string;
  envFlags?: string;
  rootFlags?: string;
  irrFlags?: string;
};

/**
 * RnDPhotoStrip
 *
 * Visual evidence strip for R&D.
 * Always shows read-only thumbnails.
 * Capture button is gated by canCapture / onCapture.
 */
export default function RnDPhotoStrip({
  photos,
  onCapture,
  isSaving,
  onDelete,
  canCapture,
  captureHint,
}: Props) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate(ref: string) {
      if (!ref) return;
      if (urls.hasOwnProperty(ref)) return;

      let url: string | null = null;

      try {
        if (/^(https?:|blob:|data:)/i.test(ref)) {
          url = ref;
        } else {
          url = await urlForPhoto(ref);
        }
      } catch {
        url = null;
      }

      if (cancelled) return;
      setUrls((prev) => {
        if (prev.hasOwnProperty(ref)) return prev;
        return { ...prev, [ref]: url };
      });
    }

    const uniqRefs = Array.from(
      new Set(
        (photos || [])
          .map((p) => p.photo_ref)
          .filter((s) => typeof s === "string" && s.length > 0)
      )
    );

    for (const ref of uniqRefs) {
      void hydrate(ref);
    }

    return () => {
      cancelled = true;
    };
  }, [photos, urls]);

  const hasPhotos = Array.isArray(photos) && photos.length > 0;

  const labelForPhoto = (p: RnDPhotoRecord) => {
    if (p.tag && p.view) return `${p.tag} · ${p.view}`;
    if (p.tag) return p.tag;
    if (p.view) return p.view;
    if (p.captured_at) {
      const d = new Date(p.captured_at);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString();
      }
    }
    return "Capture";
  };

  const gateSummary = (p: RnDPhotoRecord) => {
    const env =
      typeof p.env_gate_score === "number"
        ? Math.round(p.env_gate_score)
        : null;
    const root =
      typeof p.root_gate_score === "number"
        ? Math.round(p.root_gate_score)
        : null;
    const irr =
      typeof p.irr_gate_score === "number"
        ? Math.round(p.irr_gate_score)
        : null;
    const bits: string[] = [];
    if (env !== null) bits.push(`ENV ${env}`);
    if (root !== null) bits.push(`ROOT ${root}`);
    if (irr !== null) bits.push(`IRR ${irr}`);
    return bits.join(" · ");
  };

  const whenForPhoto = (p: RnDPhotoRecord) => {
    if (!p.captured_at) return "";
    const d = new Date(p.captured_at);
    if (Number.isNaN(d.getTime())) return p.captured_at;
    return d.toLocaleString();
  };

  const prettyFlags = (raw: string | undefined) => {
    const s = String(raw || "").trim();
    if (!s) return "none";
    return s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .join(", ");
  };

  // Capture gating: must have an onCapture handler AND canCapture !== false
  const captureEnabled = !!onCapture && (canCapture ?? true);
  const captureDisabled = !captureEnabled || !!isSaving;

  const handleCaptureClick = () => {
    if (!captureEnabled || !onCapture) return;
    onCapture();
  };

  const effectiveHint =
    captureHint ||
    (captureEnabled
      ? "Capture visual evidence for today."
      : "Capture is locked until today’s snapshot is logged.");

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: ".14em",
              opacity: 0.78,
            }}
          >
            Visual Evidence
          </div>
          <div
            style={{
              fontSize: 10,
              opacity: 0.7,
              maxWidth: 260,
            }}
          >
            {effectiveHint}
          </div>
        </div>
        <button
          type="button"
          className="btn"
          onClick={handleCaptureClick}
          disabled={captureDisabled}
          style={{
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 999,
            opacity: captureDisabled ? 0.45 : 1,
            cursor: captureDisabled ? "not-allowed" : "pointer",
          }}
        >
          {isSaving ? "Saving…" : "Capture additional photo evidence"}
        </button>
      </div>

      {!hasPhotos ? (
        <div
          style={{
            fontSize: 11,
            opacity: 0.7,
            marginTop: 2,
          }}
        >
          No photo evidence logged yet for this experiment/group.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
            marginTop: 4,
          }}
        >
          {photos.map((p, idx) => {
            const ref = p.photo_ref || "";
            const url = urls[ref] ?? (ref || null);
            const label = labelForPhoto(p);
            const gates = gateSummary(p);
            const when = whenForPhoto(p);

            return (
              <div
                key={`${p.log_id || "photo"}-${idx}`}
                style={{
                  minWidth: 140,
                  maxWidth: 180,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background:
                    "radial-gradient(circle at 0 0, rgba(0,247,219,.08), transparent 55%)",
                  padding: 6,
                  fontSize: 11,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  position: "relative",
                }}
              >
                {/* delete X */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const ok = window.confirm(
                      "Are you sure you want to delete this photo?"
                    );
                    if (!ok) return;
                    onDelete(p);
                  }}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "rgba(0,0,0,0.8)",
                    color: "#f97373",
                    fontSize: 10,
                    lineHeight: "16px",
                    textAlign: "center",
                    cursor: "pointer",
                    padding: 0,
                    zIndex: 2,
                  }}
                >
                  ×
                </button>

                <div
                  style={{
                    position: "relative",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#020617",
                    height: 96,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: url ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (!url) return;
                    setPreview({
                      url,
                      label,
                      gates,
                      when,
                      envFlags: p.env_flags_keys,
                      rootFlags: p.root_flags_keys,
                      irrFlags: p.irr_flags_keys,
                    });
                  }}
                >
                  {url ? (
                    <img
                      src={url}
                      alt={label}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    <span style={{ opacity: 0.6 }}>No preview</span>
                  )}
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                  }}
                  title={label}
                >
                  {label}
                </div>
                {gates && (
                  <div
                    style={{
                      opacity: 0.8,
                      fontSize: 10,
                    }}
                  >
                    {gates}
                  </div>
                )}
                {when && (
                  <div
                    style={{
                      opacity: 0.65,
                      fontSize: 10,
                    }}
                  >
                    {when}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div
          className="dialog-backdrop history-backdrop"
          onClick={() => setPreview(null)}
        >
          <div
            className="dialog history-panel hud-glass"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={preview.label}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {preview.label}
              </div>
              <button className="btn ghost" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={preview.url}
                alt={preview.label}
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: 12,
                }}
              />
            </div>

            <div
              style={{
                fontSize: 11,
                opacity: 0.9,
                display: "grid",
                gap: 4,
              }}
            >
              {preview.gates && (
                <div>
                  <span style={{ opacity: 0.75 }}>Gate scores: </span>
                  <span>{preview.gates}</span>
                </div>
              )}
              {preview.when && (
                <div>
                  <span style={{ opacity: 0.75 }}>Captured: </span>
                  <span>{preview.when}</span>
                </div>
              )}
              <div>
                <span style={{ opacity: 0.75 }}>ENV flags: </span>
                <span>{prettyFlags(preview.envFlags)}</span>
              </div>
              <div>
                <span style={{ opacity: 0.75 }}>ROOT flags: </span>
                <span>{prettyFlags(preview.rootFlags)}</span>
              </div>
              <div>
                <span style={{ opacity: 0.75 }}>IRR flags: </span>
                <span>{prettyFlags(preview.irrFlags)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
