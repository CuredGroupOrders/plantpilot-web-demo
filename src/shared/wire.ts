export type WirePayload = any;
const CH = "cockpit-wire";
export function publishWire(p: WirePayload) {
  try { localStorage.setItem("cockpit:last", JSON.stringify(p)); } catch {}
  try { new BroadcastChannel(CH).postMessage(p); } catch {}
  try { window.postMessage({ type:"cockpit:update", payload:p }, "*"); } catch {}
}
export function subscribeWire(onData: (p: WirePayload)=>void) {
  try { const ch = new BroadcastChannel(CH); ch.onmessage = (e)=> onData(e.data); } catch {}
  window.addEventListener("message", (e:any)=>{ if(e?.data?.type==="cockpit:update") onData(e.data.payload); });
  try { const last = localStorage.getItem("cockpit:last"); if(last) onData(JSON.parse(last)); } catch {}
}

