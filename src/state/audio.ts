/**
 * IndexedDB store for audio blobs.
 * DB: "cockpit-media", STORE: "audio"
 * API: saveAudio(blob)->id, readAudio(id)->Blob|null,
 *      urlForAudio(id)->{url,revoke}|null, deleteAudio(id)
 */
type AudioRecord = {
  id: string;
  ts: number;
  mime: string; // usually "audio/mpeg"
  size: number;
  blob: Blob;
};

const DB_NAME = "cockpit-media";
const STORE = "audio";

function openDBEnsureStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const probe = indexedDB.open(DB_NAME);
    probe.onerror = () => reject(probe.error);
    probe.onsuccess = () => {
      const db = probe.result;
      if (db.objectStoreNames.contains(STORE)) {
        resolve(db);
        return;
      }
      const newVersion = db.version + 1;
      db.close();
      const upgrade = indexedDB.open(DB_NAME, newVersion);
      upgrade.onupgradeneeded = () => {
        const udb = upgrade.result;
        if (!udb.objectStoreNames.contains(STORE)) {
          udb.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      upgrade.onerror = () => reject(upgrade.error);
      upgrade.onsuccess = () => resolve(upgrade.result);
    };
    probe.onupgradeneeded = () => {
      const db = probe.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDBEnsureStore();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    const req = run(s);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudio(blob: Blob, mime = "audio/mpeg"): Promise<string> {
  const id = crypto.randomUUID();
  const rec: AudioRecord = { id, ts: Date.now(), mime, size: blob.size, blob };
  await tx("readwrite", (s) => s.put(rec));
  return id;
}

export async function readAudio(id: string): Promise<Blob | null> {
  const rec = await tx<AudioRecord | undefined>("readonly", (s) => s.get(id));
  return rec ? rec.blob : null;
}

export async function deleteAudio(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function urlForAudio(
  id: string
): Promise<{ url: string; revoke: () => void } | null> {
  const blob = await readAudio(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
