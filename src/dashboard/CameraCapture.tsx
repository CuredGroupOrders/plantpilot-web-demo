// src/dashboard/CameraCapture.tsx
import { useEffect, useRef, useState } from "react";

type Props = {
  stream: MediaStream | null;
  onClose: () => void;
  onShot: (blob: Blob) => void;
};

export default function CameraCapture({ stream, onClose, onShot }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!stream) {
      v.srcObject = null;
      setErrMsg("Camera starting…");
      return;
    }

    v.srcObject = stream;
    setErrMsg(null);

    const playPromise = v.play();
    if (playPromise && typeof (playPromise as any).then === "function") {
      (playPromise as Promise<void>).catch((err) => {
        console.warn("video.play() failed:", err);
        setErrMsg("Unable to start preview");
      });
    }
  }, [stream]);

  async function capture() {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.92),
    );
    if (blob) onShot(blob);
  }

  return (
    <div>
      <div
        style={{
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
          border: "1px solid var(--border)",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", height: "auto", display: "block" }}
        />
        {errMsg && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              background: "rgba(0,0,0,.6)",
              padding: "0 12px",
              textAlign: "center",
              fontSize: 12,
            }}
          >
            {errMsg}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 10,
          justifyContent: "space-between",
        }}
      >
        <button className="btn primary" onClick={capture}>
          Capture
        </button>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
