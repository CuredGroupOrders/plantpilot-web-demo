import { getSopProfileMeta } from "../state/sopProfileMeta";

export default function SopProfileBadge(props: { profileKey: string }) {
  const key = (props.profileKey ?? "").trim();
  const meta = getSopProfileMeta(key);

  const sopName = meta?.sopName ?? key;
  const brandName = meta?.brandName ?? "";
  const igUrl = meta?.igUrl ?? "";
  const accent = meta?.accentHex ?? "#00F5FF";
  const logoSrc = meta?.logoSrc ? `${meta.logoSrc}?v=1` : "";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
        borderRadius: 16,
        border: `2px solid ${accent}`,
        background: "linear-gradient(180deg, rgba(0,0,0,0.72), rgba(0,0,0,0.38))",
        boxShadow:
          "0 0 0 1px rgba(0,0,0,0.65), 0 10px 26px rgba(0,0,0,0.45), 0 0 22px rgba(0,245,255,0.22)",
        backdropFilter: "blur(8px)",
        minHeight: 78,
        maxWidth: 520,
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
      title={sopName}
    >
      {/* dog-tag hole */}
      <div
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          border: `3px solid ${accent}`,
          boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.60), 0 0 12px rgba(0,245,255,0.22)",
          flex: "0 0 auto",
        }}
      />

      {/* avatar ring (image optional; no broken icon) */}
      <div
        style={{
          width: 78,
          height: 78,
          borderRadius: 999,
          border: `3px solid ${accent}`,
          boxShadow: "0 0 14px rgba(0,245,255,0.22)",
          overflow: "hidden",
          flex: "0 0 auto",
          background: "rgba(0,0,0,0.35)",
        }}
      >
        {logoSrc ? (
          <img
            src={logoSrc}
            alt="SOP profile avatar"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
      </div>

      <div style={{ minWidth: 0, lineHeight: 1.05 }}>
        <div style={{ fontSize: 10, opacity: 0.75, letterSpacing: 1.3 }}>
          ACTIVE SOP PROFILE
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          {igUrl ? (
            <a
              href={igUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 16,
                fontWeight: 950,
                textDecoration: "underline",
                textUnderlineOffset: 3,
                color: "inherit",
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={igUrl}
            >
              {sopName}
            </a>
          ) : (
            <span style={{ fontSize: 16, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis" }}>
              {sopName}
            </span>
          )}

          {brandName && brandName !== sopName ? (
            <span style={{ fontSize: 12, opacity: 0.85, flex: "0 0 auto" }}>
              • {brandName}
            </span>
          ) : null}
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{
          marginLeft: "auto",
          width: 12,
          height: 12,
          borderRadius: 999,
          background: accent,
          boxShadow: "0 0 14px rgba(0,245,255,0.30)",
          flex: "0 0 auto",
        }}
      />
    </div>
  );
}