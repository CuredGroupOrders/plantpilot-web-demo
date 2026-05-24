import logoUrl from "./assets/plantpilot-logo.png";
import ConnectionPill from "./components/ConnectionPill";

export default function BrandBar() {
  return (
    <header
      id="brand-bar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <a className="brand-link" href="/" title="PlantPilot">
        <img className="brand-logo" src={logoUrl} alt="" aria-hidden />
        <span className="brand-name">PlantPilot</span>
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ConnectionPill />
      </div>
    </header>
  );
}
