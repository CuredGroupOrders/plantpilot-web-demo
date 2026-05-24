const USE = (import.meta as any).env?.VITE_USE_SHEET === "1";
const API  = (import.meta as any).env?.VITE_SHEET_API as string;

type Top = { condition:string; advice:string; score:number };
type Snap = { status:{ENV:string;ROOT:string;IRR:string}; top3:{ENV:Top[];ROOT:Top[];IRR:Top[]} };

async function getSnap(): Promise<Snap>{
  if(!API) throw new Error("VITE_SHEET_API missing");
  const url = API.includes("?") ? API + "&snapshot=1" : API + "?snapshot=1";
  const r = await fetch(url, { cache:"no-store" });
  if(!r.ok) throw new Error(`sheet ${r.status}`);
  const js:any = await r.json();
  const s:any = (js?.status && js?.top3) ? js : (js?.data?.status && js?.data?.top3 ? js.data : null);
  if(!s) throw new Error("Sheet snapshot missing status/top3");
  return s as Snap;
}

function pill(ok:boolean){
  return `<span style="padding:2px 6px;border-radius:10px;margin-left:6px;background:${ok?"#14a44d":"#dc4c64"};color:#fff;font-weight:600;font-size:12px;">${ok?"PASS":"FAIL"}</span>`;
}

function render(s:Snap){
  const wrap = document.createElement("div");
  wrap.id = "sheet-overlay";
  wrap.style.cssText = "position:fixed;top:10px;right:10px;z-index:99999;max-width:420px;background:#111827;color:#e5e7eb;border:1px solid #374151;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:Inter,system-ui,Arial,sans-serif;";
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #374151;">
      <div style="font-weight:700;letter-spacing:.3px;">Sheet Snapshot</div>
      <button id="sheet-overlay-close" style="all:unset;cursor:pointer;font-size:14px;opacity:.7;">ï¿½fÂ¢ï¿½.ï¿½?oÃ¢ï¿½,ï¿½Â¢</button>
    </div>
    <div style="padding:10px 12px;line-height:1.35;">
      <div style="margin-bottom:6px;">ENV ${pill(s.status.ENV==="PASS")}</div>
      <div style="margin-bottom:6px;">ROOT ${pill(s.status.ROOT==="PASS")}</div>
      <div style="margin-bottom:10px;">IRR ${pill(s.status.IRR==="PASS")}</div>
      ${(["ENV","ROOT","IRR"] as const).map(g => `
        <div style="margin:10px 0 6px;font-weight:700;">${g} Topï¿½fÂ¢Ã¢ï¿½?sÂ¬Ã¢ï¿½,ï¿½ï¿½o3</div>
        <ol style="margin:0 0 8px 18px;padding:0;">
          ${s.top3[g].map(x => `<li style="margin:0 0 4px;">
            <div style="font-weight:600">${x.condition}</div>
            <div style="opacity:.85;font-size:12px;">${x.advice}</div>
          </li>`).join("")}
        </ol>
      `).join("")}
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById("sheet-overlay-close")?.addEventListener("click", ()=>wrap.remove());
}

async function boot(){
  if(!USE) return;
  try { render(await getSnap()); } catch(e){ console.error(e); }
}
if(document.readyState === "complete" || document.readyState === "interactive"){ setTimeout(boot,0); }
else { window.addEventListener("DOMContentLoaded", boot); }


