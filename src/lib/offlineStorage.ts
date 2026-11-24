import type { BackupSnapshot, ProjectMeta, SerializedLayer } from '../types/studio';

const DB_NAME = 'chromastudio_pro_offline_v1';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_BACKUPS = 'backups';

export interface StoredLocalProject {
  meta: ProjectMeta;
  layers: SerializedLayer[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'meta.id' });
      }
      if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
        const store = db.createObjectStore(STORE_BACKUPS, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalProject(project: StoredLocalProject): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalProject(projectId: string): Promise<StoredLocalProject | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const req = tx.objectStore(STORE_PROJECTS).get(projectId);
    req.onsuccess = () => resolve((req.result as StoredLocalProject) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function listLocalProjects(): Promise<StoredLocalProject[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const req = tx.objectStore(STORE_PROJECTS).getAll();
    req.onsuccess = () => {
      const list = (req.result as StoredLocalProject[]) || [];
      list.sort((a, b) => b.meta.updatedAtMs - a.meta.updatedAtMs);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalProject(projectId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).delete(projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveLocalBackup(backup: BackupSnapshot): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BACKUPS, 'readwrite');
    tx.objectStore(STORE_BACKUPS).put(backup);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listLocalBackups(projectId: string): Promise<BackupSnapshot[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BACKUPS, 'readonly');
    const idx = tx.objectStore(STORE_BACKUPS).index('projectId');
    const req = idx.getAll(IDBKeyRange.only(projectId));
    req.onsuccess = () => {
      const list = (req.result as BackupSnapshot[]) || [];
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      resolve(list.slice(0, 20));
    };
    req.onerror = () => reject(req.error);
  });
}
