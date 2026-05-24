// IndexedDB store for photo blobs: DB "cockpit-media", STORE "photos"
// API preserved: savePhoto, readPhoto, urlForPhoto, deletePhoto

type PhotoRecord = {
  id: string;
  ts: number;
  mime: string; // e.g. "image/jpeg"
  size: number;
  blob: Blob;
};

const DB_NAME = "cockpit-media";
const STORE = "photos";

function openDBEnsureStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Probe current DB without specifying a version (avoids VersionError)
    const probe = indexedDB.open(DB_NAME);
    probe.onerror = () => reject(probe.error);
    probe.onsuccess = () => {
      const db = probe.result;
      if (db.objectStoreNames.contains(STORE)) {
        resolve(db);
        return;
      }
      // Store missing → bump version by +1 and create it
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
    // First-ever open path
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

export async function savePhoto(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  const rec: PhotoRecord = {
    id,
    ts: Date.now(),
    mime: blob.type || "image/jpeg",
    size: blob.size,
    blob,
  };
  await tx("readwrite", (s) => s.put(rec));
  return id;
}

export async function readPhoto(id: string): Promise<Blob | null> {
  const rec = await tx<PhotoRecord | undefined>("readonly", (s) => s.get(id));
  return rec ? rec.blob : null;
}

export async function urlForPhoto(id: string): Promise<string | null> {
  const blob = await readPhoto(id);
  if (!blob) return null;
  return URL.createObjectURL(blob); // caller revokes it later
}

export async function deletePhoto(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}
