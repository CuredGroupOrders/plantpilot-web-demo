// src/SymptomsTab.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { readIntakeChecklist, saveIntakeChecklist, type SymptomItem } from "./api/symptoms";
import { useSymptoms, type SymptomsState } from "./state/symptoms";

export default function SymptomsTab() {
  const [items, setItems] = useState<SymptomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  // typed selectors so TS doesn't complain about implicit 'any'
  const setTick  = useSymptoms((s: SymptomsState) => s.set);
  const setMany  = useSymptoms((s: SymptomsState) => s.setMany);
  const clearAllStore = useSymptoms((s: SymptomsState) => s.clearAll);

  // load from Intake!D:E
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const base = await readIntakeChecklist();
        if (!on) return;
        setItems(base);
        // sync local store map with sheet (keys + initial flags)
        const seed = Object.fromEntries(base.map(b => [b.key, !!b.checked]));
        setMany(seed);
      } catch (e: any) {
        if (on) setErr(e?.message || "load failed");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, [setMany]);

  // debounce writes to sheet on toggle
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const push = (next: SymptomItem[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await saveIntakeChecklist(next); } catch {}
    }, 250);
  };

  const toggle = (i: number) => {
    setItems(prev => {
      const next = prev.map((r, idx) => {
        if (idx !== i) return r;
        setTick(r.key, !r.checked);      // update local store too
        return { ...r, checked: !r.checked };
      });
      push(next);
      return next;
    });
  };

  const clearAll = () => {
    setItems(prev => {
      const next = prev.map(r => ({ ...r, checked: false }));
      clearAllStore();
      push(next);
      return next;
    });
  };

  const anyChecked = useMemo(() => items.some(i => i.checked), [items]);

  if (loading) return <div className="card">Loading…</div>;
  if (err) return <div className="card" style={{ color:"#ff8080" }}>Error: {err}</div>;

  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h3>Symptoms</h3>
        <button className="btn" onClick={clearAll} disabled={!anyChecked}>Clear all</button>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        {items.length === 0 && <div className="sub">No symptoms defined in Intake!D:E.</div>}
        {items.map((r, i) => (
          <label
            key={`${r.key}-${i}`}
            style={{
              display:"grid",
              gridTemplateColumns:"auto 1fr",
              alignItems:"center",
              gap:10,
              padding:"8px 10px",
              border:"1px solid var(--border)",
              borderRadius:10,
              background:"rgba(0,0,0,.12)"
            }}
          >
            <input
              type="checkbox"
              checked={!!r.checked}
              onChange={() => toggle(i)}
              aria-label={`toggle ${r.key}`}
              style={{ width:18, height:18 }}
            />
            <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.key}</div>
          </label>
        ))}
      </div>
    </div>
  );
}
