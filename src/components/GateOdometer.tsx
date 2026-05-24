import { useLive } from "../state/live";

export default function GateOdometer({ metricKey }:{ metricKey:string }){
  const projected = useLive(s=>s.projected[metricKey]);
  const confirmed = useLive(s=>s.confirmed[metricKey]);
  const sync = useLive(s=>s.sync);
  const value = projected ?? confirmed ?? 0;
  return (
    <div className="odo">
      <div className="needle" data-value={value}/>
      <div className="sync-dot" data-state={sync}/>
    </div>
  );
}
