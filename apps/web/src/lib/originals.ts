/**
 * The exact bytes of each registered original, kept in this browser's IndexedDB (GAPS.md G4).
 * They are the only thing that can prove a record, so losing them loses the proof. Nothing leaves the device.
 */
const DB_NAME = "origo";
const STORE = "originals";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveOriginal(recordId: number, file: File): Promise<void> {
  await run("readwrite", (s) => s.put(file, recordId));
}

export async function loadOriginal(recordId: number): Promise<File | undefined> {
  try {
    const value = await run<File | undefined>("readonly", (s) => s.get(recordId));
    return value instanceof Blob ? value : undefined;
  } catch {
    // Private mode or blocked storage: the person can still drop the file by hand.
    return undefined;
  }
}
