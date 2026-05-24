import { useHistory } from "./state/history";

/** POST /speak and return an MP3 Blob. */
async function ttsToBlob(text: string, voice?: string): Promise<Blob> {
  const r = await fetch("/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`TTS failed: ${r.status} ${msg}`);
  }
  return await r.blob(); // audio/mpeg
}

/** Save CENTCOM text+json and optional audio into Baseline History. */
export async function attachCentcomSnapshot(opts: {
  text: string;
  json?: any;
  model?: string;
  ttsVoice?: string;
}): Promise<void> {
  const { text, json, model, ttsVoice } = opts;
  const hist = useHistory.getState();

  let audioBlob: Blob | undefined;
  try {
    audioBlob = await ttsToBlob(text, ttsVoice);
  } catch {
    audioBlob = undefined; // non-fatal
  }

  await hist.attachCentcomToLatest({
    text,
    json,
    audioBlob,
    model,
    ttsVoice,
  });
}
