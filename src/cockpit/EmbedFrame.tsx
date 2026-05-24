import { useEffect, useRef } from "react";

export default function EmbedFrame() {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === "cockpit:height" && ref.current) {
        ref.current.style.height = Math.max(600, Number(e.data.h) || 0) + "px";
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  return (
    <section style={{ marginTop: 8 }}>
      <iframe
        ref={ref}
        src="/cockpit?embed=1"
        title="Cockpit"
        style={{ width: "100%", height: "900px", border: 0, background: "transparent" }}
      />
    </section>
  );
}

