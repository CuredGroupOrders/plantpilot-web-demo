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
      <a className="brand-link" href="/">
        <img className="brand-logo" src={logoUrl} alt="PlantPilot logo" />
        <span className="brand-text">
          <span className="brand-name">PLANTPILOT</span>
          <span className="brand-sub">by SharkMouseFarms</span>
        </span>
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ConnectionPill />
      </div>
    </header>
  );
}
