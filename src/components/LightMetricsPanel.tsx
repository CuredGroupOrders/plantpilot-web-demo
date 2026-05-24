import { useCallback, useEffect, useRef, useState } from "react";
import { savePhoto } from "../state/photos";

const computeDLI = (ppfd: number, hours: number) =>
  +(ppfd * hours * 3.6e-3).toFixed(2);

type AmbientLightSensorCtor = new (options?: { frequency?: number }) => {
  illuminance: number;
  start: () => void;
  stop: () => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};

type Props = {
  ppfd: number | undefined;
  setPpfd: (v: number | undefined) => void;
  photoperiodH: number;
  dliMol: number | undefined;
  setDliMol: (v: number | undefined) => void;
  lux?: number | undefined;
  setLux?: (v: number | undefined) => void;
};

type PhotoPreview = { id: string; url: string; name: string };

export default function LightMetricsPanel({
  ppfd,
  setPpfd,
  photoperiodH,
  dliMol,
  setDliMol,
  lux,
  setLux,
}: Props) {
  const [previews, setPreviews] = useState<PhotoPreview[]>([]);
  const [sensorLux, setSensorLux] = useState<number | null>(null);
  const [sensorStatus, setSensorStatus] = useState<string>("");
  const sensorRef = useRef<InstanceType<AmbientLightSensorCtor> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ppfd != null && Number.isFinite(ppfd) && photoperiodH > 0) {
      setDliMol(computeDLI(ppfd, photoperiodH));
    }
  }, [ppfd, photoperiodH, setDliMol]);

  const luxToPpfd = (lx: number) => Math.round(lx / 54);

  const applyLux = useCallback(
    (lx: number) => {
      if (setLux) setLux(lx);
      const est = luxToPpfd(lx);
      setPpfd(est);
    },
    [setLux, setPpfd],
  );

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const next: PhotoPreview[] = [];
    for (const file of Array.from(files)) {
      const id = `light-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        await savePhoto(id, file);
      } catch {
        /* indexedDB optional */
      }
      next.push({ id, url: URL.createObjectURL(file), name: file.name });
    }
    setPreviews((p) => [...p, ...next].slice(-6));
  };

  const removePreview = (id: string) => {
    setPreviews((p) => {
      const hit = p.find((x) => x.id === id);
      if (hit?.url) URL.revokeObjectURL(hit.url);
      return p.filter((x) => x.id !== id);
    });
  };

  const startSensor = async () => {
    const ALS = (window as unknown as { AmbientLightSensor?: AmbientLightSensorCtor })
      .AmbientLightSensor;
    if (!ALS) {
      setSensorStatus("Ambient light sensor not supported on this browser.");
      return;
    }
    try {
      const sensor = new ALS({ frequency: 1 });
      sensorRef.current = sensor;
      const onRead = () => {
        const lx = Math.round(sensor.illuminance);
        setSensorLux(lx);
        setSensorStatus(`Live: ${lx} lux`);
      };
      sensor.addEventListener("reading", onRead);
      sensor.start();
      setSensorStatus("Sensor active");
    } catch (e: unknown) {
      setSensorStatus(
        e instanceof Error ? e.message : "Permission denied or sensor unavailable",
      );
    }
  };

  const stopSensor = () => {
    try {
      sensorRef.current?.stop();
    } catch {
      /* ignore */
    }
    sensorRef.current = null;
    setSensorStatus("");
  };

  useEffect(() => () => stopSensor(), []);

  return (
    <div
      className="card"
      style={{
        marginTop: 8,
        padding: 12,
        border: "1px solid rgba(0,247,219,0.35)",
        background: "rgba(5,9,11,0.85)",
      }}
    >
      <h4 style={{ margin: "0 0 8px", color: "#00f7db", letterSpacing: "0.08em" }}>
        Light metrics (web)
      </h4>
      <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 10px" }}>
        Enter PPFD manually, upload reference photos, or use a device light sensor when available.
      </p>

      <div className="row row-3" style={{ marginBottom: 10 }}>
        <div>
          <label>Lux (optional)</label>
          <input
            type="number"
            step="1"
            value={lux ?? ""}
            placeholder="e.g. 48000"
            onChange={(e) => {
              const v = e.target.value === "" ? undefined : +e.target.value;
              if (setLux) setLux(v);
              if (v != null && Number.isFinite(v)) applyLux(v);
            }}
          />
        </div>
        <div>
          <label>PPFD (µmol/m²/s)</label>
          <input
            type="number"
            step="1"
            value={ppfd ?? ""}
            onChange={(e) =>
              setPpfd(e.target.value === "" ? undefined : +e.target.value)
            }
          />
        </div>
        <div>
          <label>DLI (computed)</label>
          <input
            type="text"
            readOnly
            value={
              dliMol != null
                ? String(dliMol)
                : ppfd != null && photoperiodH
                  ? String(computeDLI(ppfd, photoperiodH))
                  : "—"
            }
            style={{ opacity: 0.85 }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Upload photos
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button type="button" className="btn" onClick={() => void startSensor()}>
          Use light sensor
        </button>
        {sensorRef.current && (
          <button type="button" className="btn" onClick={stopSensor}>
            Stop sensor
          </button>
        )}
        {sensorLux != null && (
          <button type="button" className="btn" onClick={() => applyLux(sensorLux)}>
            Apply {sensorLux} lux → PPFD
          </button>
        )}
      </div>
      {sensorStatus && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>{sensorStatus}</div>
      )}

      {previews.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {previews.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              <img
                src={p.url}
                alt={p.name}
                style={{
                  width: 72,
                  height: 72,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1px solid #334155",
                }}
              />
              <button
                type="button"
                aria-label="Remove"
                onClick={() => removePreview(p.id)}
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  background: "#000a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
