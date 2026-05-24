// src/cockpit/SymptomsCard.tsx
import { useEffect, useState } from "react";
import { readIntakeChecklist } from "../api/symptoms";
import * as Sheet from "../api/sheet";

type T3 = [string, string, number];

function GateBlock({ title, rows }: { title: "ENV"|"ROOT"|"IRR"; rows: T3[] }) {
  return (
    <div className="card" style={{ padding:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
        <b>{title}</b>
        <span className="badge">{rows.length}</span>
      </div>
      <div style={{ marginTop:8, display:"grid", gap:8 }}>
        {rows.slice(0,3).map((r, i) => (
          <div key={`${title}-${i}`} style={{ display:"grid", gap:4 }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
              <div style={{ fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r[0]}</div>
              <span className="badge">{Number.isFinite(r[2]) ? Math.round(r[2]) : 0}</span>
            </div>
            <div style={{ fontSize:12, color:"var(--muted)" }}>{r[1]}</div>
          </div>
        ))}
        {!rows.length && <div style={{ color:"#9ca3af", fontSize:12 }}>No helpers.</div>}
      </div>
    </div>
  );
}

export default function SymptomsCard() {
  const [show, setShow] = useState(false);
  const [env, setEnv] = useState<T3[]>([]);
  const [root, setRoot] = useState<T3[]>([]);
  const [irr, setIrr] = useState<T3[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const items = await readIntakeChecklist();
        const any = items.some(i => !!i.checked);
        if (!on) return;
        setShow(any);
        if (!any) { setLoading(false); return; }

        const t3 = await Sheet.fetchSymTop3();
        if (!on) return;
        setEnv(t3.envTop3); setRoot(t3.rootTop3); setIrr(t3.irrTop3);
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, []);

  if (!show) return null;

  return (
    <div className="card">
      <h3>Symptom-Driven Helpers</h3>
      {loading ? (
        <div className="sub" style={{ marginTop:8 }}>Loading…</div>
      ) : (
        <div className="row row-3" style={{ marginTop:8 }}>
          <GateBlock title="ENV"  rows={env} />
          <GateBlock title="ROOT" rows={root} />
          <GateBlock title="IRR"  rows={irr} />
        </div>
      )}
    </div>
  );
}
