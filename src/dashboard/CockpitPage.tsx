import EmbedFrame from "../cockpit/EmbedFrame";
import Cockpit from "./Cockpit";

export default function CockpitPage() {
  const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const embed = !!qs?.has("embed");
  return embed ? <Cockpit/> : <EmbedFrame/>;
}
