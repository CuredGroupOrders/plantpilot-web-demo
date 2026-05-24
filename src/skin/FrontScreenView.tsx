import Cockpit from "../cockpit/Cockpit";
// Wrapper component - accepts any legacy props (odometers, prescription, leverMap, etc.)
// for backward compat with Home.tsx but currently ignores them and renders the live Cockpit.
export default function FrontScreenView(_props: Record<string, unknown> = {}){ return <Cockpit/>; }


