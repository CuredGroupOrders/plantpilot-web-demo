// src/state/selectors/derived.ts
import { useEnv } from "../env";
import { useFrontIntake } from "../intake";

const n = (v:any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
};

function vpd(leafC?:number, rh?:number){
  if (leafC==null || rh==null) return undefined;
  const T = leafC, RH = rh/100;
  const es = 0.6108 * Math.exp((17.27 * T) / (T + 237.3)); // kPa
  return Number(((1 - RH) * es).toFixed(2));
}

export function useDerivedNow(){
  const env = useEnv(s=>s.saved);
  const intake = useFrontIntake(s=>s.saved);
  const vpdKpa = vpd(n(env?.leafC), n(env?.rh));
  const deltaEc = (n(env?.runoffEc) != null && n(intake?.ec) != null)
    ? Number((n(env?.runoffEc)! - n(intake?.ec)!).toFixed(2))
    : undefined;
  return { vpdKpa, deltaEc };
}

