// src/components/OdometerRow.tsx
import Odometer from "../skin/Odometer";
import { ThermometerSun, Activity, Droplets } from "lucide-react";

export type Gate = { value: number; sub: string };

export default function OdometerRow({ env, root, irr }: { env: Gate; root: Gate; irr: Gate }) {
  return (
    <div className="odo-grid">
      <Odometer label="ENV Gate"  sub={env.sub}  value={env.value}  icon={<ThermometerSun />} />
      <Odometer label="ROOT Gate" sub={root.sub} value={root.value} icon={<Activity />} />
      <Odometer label="IRR Gate"  sub={irr.sub}  value={irr.value}  icon={<Droplets />} />
    </div>
  );
}
