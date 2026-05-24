import { create } from "zustand";

type Targets = Record<string, { min:number; max:number }>;
type Metrics = Record<string, number>;
type Flags = Array<{ id:string; gate:string; metric:string; severity:"low"|"med"|"high"; msg:string }>;

type Sync = "live"|"syncing"|"stale";

interface LiveState {
  projected: Metrics;   // immediate
  confirmed: Metrics;   // from server
  targets: Targets;
  flags: Flags;
  history: Array<{ ts:number; [k:string]:number }>;
  sync: Sync;
  seq: number;
  setProjected: (m:Metrics)=>void;
  beginSync: (seq:number)=>void;
  commit: (seq:number, data:{metrics:Metrics; targets:Targets; flags:Flags; history:any[]})=>void;
  fail: ()=>void;
}

export const useLive = create<LiveState>((set,get)=>({
  projected:{}, confirmed:{}, targets:{}, flags:[], history:[], sync:"live", seq:0,
  setProjected: (m)=> set({ projected: m, sync: "syncing" }),
  beginSync: (seq)=> set({ sync:"syncing", seq }),
  commit: (seq, data)=>{
    if (seq !== get().seq) return; // drop stale response
    set({
      confirmed: data.metrics||{},
      targets: data.targets||{},
      flags: data.flags||[],
      history: data.history||[],
      sync: "live"
    });
  },
  fail: ()=> set({ sync:"stale" })
}));
