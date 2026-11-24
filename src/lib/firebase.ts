import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  AnalyticsSessionItem,
  AssetLibraryItem,
  BackupSnapshot,
  BrushPreset,
  ProjectMeta,
  ShortcutMap,
  StudioPlugin,
} from '../types/studio';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export function clampStr(val: string, max: number, fallback = 'Untitled'): string {
  const trimmed = (val || '').trim();
  if (!trimmed) return fallback.slice(0, max);
  return trimmed.slice(0, max);
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuth(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

// --- User Preferences ---
export interface CloudUserPrefs {
  displayName: string;
  theme: 'dark' | 'light';
  stylusPressureCurve: number;
  autoSaveIntervalSec: number;
  notificationsEnabled: boolean;
  shortcuts: ShortcutMap;
}

export async function saveUserPreferencesCloud(uid: string, prefs: CloudUserPrefs): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  const ref = doc(db, 'users', safeUid);
  const safeShortcuts: Record<string, string> = {};
  Object.entries(prefs.shortcuts).slice(0, 40).forEach(([k, v]) => {
    safeShortcuts[k.slice(0, 40)] = String(v).slice(0, 32);
  });

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        displayName: clampStr(prefs.displayName, 80, 'Desainer'),
        theme: prefs.theme === 'light' ? 'light' : 'dark',
        stylusPressureCurve: Math.min(3, Math.max(0.2, Number(prefs.stylusPressureCurve) || 1)),
        autoSaveIntervalSec: Math.min(600, Math.max(5, Number(prefs.autoSaveIntervalSec) || 30)),
        notificationsEnabled: Boolean(prefs.notificationsEnabled),
        shortcuts: safeShortcuts,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: safeUid,
        displayName: clampStr(prefs.displayName, 80, 'Desainer'),
        theme: prefs.theme === 'light' ? 'light' : 'dark',
        stylusPressureCurve: Math.min(3, Math.max(0.2, Number(prefs.stylusPressureCurve) || 1)),
        autoSaveIntervalSec: Math.min(600, Math.max(5, Number(prefs.autoSaveIntervalSec) || 30)),
        notificationsEnabled: Boolean(prefs.notificationsEnabled),
        shortcuts: safeShortcuts,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadUserPreferencesCloud(uid: string): Promise<CloudUserPrefs | null> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  try {
    const snap = await getDoc(doc(db, 'users', safeUid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      displayName: String(d.displayName || 'Desainer'),
      theme: d.theme === 'light' ? 'light' : 'dark',
      stylusPressureCurve: Number(d.stylusPressureCurve) || 1,
      autoSaveIntervalSec: Number(d.autoSaveIntervalSec) || 30,
      notificationsEnabled: Boolean(d.notificationsEnabled),
      shortcuts: (d.shortcuts as ShortcutMap) || {},
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// --- Cloud Projects ---
export async function saveProjectCloud(uid: string, project: ProjectMeta): Promise<void> {
  const safeId = sanitizeId(project.id);
  const path = `projects/${safeId}`;
  const ref = doc(db, 'projects', safeId);
  const safeThumb = (project.thumbnailUrl || '').slice(0, 175000);
  const safeRoom = sanitizeId(project.roomCode || `RM-${safeId.slice(0, 6)}`).slice(0, 32);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        title: clampStr(project.title, 120, 'Proyek Tanpa Judul'),
        width: Math.min(8192, Math.max(64, Math.round(project.width))),
        height: Math.min(8192, Math.max(64, Math.round(project.height))),
        dpi: Math.min(600, Math.max(72, Math.round(project.dpi))),
        colorProfile: project.colorProfile,
        layerCount: Math.min(200, Math.max(0, Math.round(project.layerCount))),
        thumbnailUrl: safeThumb,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: uid,
        title: clampStr(project.title, 120, 'Proyek Tanpa Judul'),
        width: Math.min(8192, Math.max(64, Math.round(project.width))),
        height: Math.min(8192, Math.max(64, Math.round(project.height))),
        dpi: Math.min(600, Math.max(72, Math.round(project.dpi))),
        colorProfile: project.colorProfile,
        roomCode: safeRoom.length >= 4 ? safeRoom : `RM_${safeRoom}`,
        layerCount: Math.min(200, Math.max(0, Math.round(project.layerCount))),
        thumbnailUrl: safeThumb,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeProjectsCloud(uid: string, onData: (projects: ProjectMeta[]) => void): Unsubscribe {
  const q = query(collection(db, 'projects'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items: ProjectMeta[] = snap.docs.map((d) => {
        const data = d.data();
        const ts = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now();
        return {
          id: d.id,
          title: String(data.title || 'Proyek'),
          width: Number(data.width) || 1280,
          height: Number(data.height) || 720,
          dpi: Number(data.dpi) || 300,
          colorProfile: data.colorProfile || 'sRGB',
          roomCode: String(data.roomCode || 'STUDIO-01'),
          layerCount: Number(data.layerCount) || 1,
          thumbnailUrl: String(data.thumbnailUrl || ''),
          updatedAtMs: ts,
          syncedToCloud: true,
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    }
  );
}

export async function deleteProjectCloud(projectId: string): Promise<void> {
  const safeId = sanitizeId(projectId);
  const path = `projects/${safeId}`;
  try {
    await deleteDoc(doc(db, 'projects', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Auto Backups ---
export async function saveBackupCloud(uid: string, backup: BackupSnapshot): Promise<void> {
  const safeProjId = sanitizeId(backup.projectId);
  const safeBackupId = sanitizeId(backup.id);
  const path = `projects/${safeProjId}/backups/${safeBackupId}`;
  try {
    await setDoc(doc(db, 'projects', safeProjId, 'backups', safeBackupId), {
      ownerId: uid,
      projectId: safeProjId,
      label: clampStr(backup.label, 120, 'Cadangan Otomatis'),
      layerCount: Math.min(200, Math.max(0, Math.round(backup.layerCount))),
      width: Math.min(8192, Math.max(64, Math.round(backup.width))),
      height: Math.min(8192, Math.max(64, Math.round(backup.height))),
      thumbnailUrl: (backup.thumbnailUrl || '').slice(0, 175000),
      snapshotSummary: clampStr(backup.snapshotSummary, 500, 'Snapshot layer otomatis'),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listBackupsCloud(uid: string, projectId: string): Promise<BackupSnapshot[]> {
  const safeProjId = sanitizeId(projectId);
  const path = `projects/${safeProjId}/backups`;
  try {
    const q = query(collection(db, 'projects', safeProjId, 'backups'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          projectId: safeProjId,
          label: String(data.label || 'Cadangan'),
          layerCount: Number(data.layerCount) || 1,
          width: Number(data.width) || 1280,
          height: Number(data.height) || 720,
          thumbnailUrl: String(data.thumbnailUrl || ''),
          snapshotSummary: String(data.snapshotSummary || ''),
          createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          isCloud: true,
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// --- Custom Brushes ---
export async function saveBrushCloud(uid: string, brush: BrushPreset): Promise<void> {
  const safeId = sanitizeId(brush.id);
  const path = `brushes/${safeId}`;
  try {
    await setDoc(doc(db, 'brushes', safeId), {
      ownerId: uid,
      name: clampStr(brush.name, 80, 'Brush Kustom'),
      category: brush.category,
      size: Math.min(500, Math.max(1, Number(brush.size) || 24)),
      hardness: Math.min(100, Math.max(0, Number(brush.hardness) || 50)),
      opacity: Math.min(100, Math.max(1, Number(brush.opacity) || 100)),
      flow: Math.min(100, Math.max(1, Number(brush.flow) || 80)),
      spacing: Math.min(200, Math.max(1, Number(brush.spacing) || 12)),
      scatter: Math.min(200, Math.max(0, Number(brush.scatter) || 0)),
      angle: Math.min(360, Math.max(0, Number(brush.angle) || 0)),
      roundness: Math.min(100, Math.max(10, Number(brush.roundness) || 100)),
      pressureSize: Boolean(brush.pressureSize),
      pressureOpacity: Boolean(brush.pressureOpacity),
      tipType: brush.tipType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeBrushesCloud(uid: string, onData: (brushes: BrushPreset[]) => void): Unsubscribe {
  const q = query(collection(db, 'brushes'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || 'Brush'),
            category: data.category || 'Custom',
            size: Number(data.size) || 24,
            hardness: Number(data.hardness) || 50,
            opacity: Number(data.opacity) || 100,
            flow: Number(data.flow) || 80,
            spacing: Number(data.spacing) || 12,
            scatter: Number(data.scatter) || 0,
            angle: Number(data.angle) || 0,
            roundness: Number(data.roundness) || 100,
            pressureSize: Boolean(data.pressureSize),
            pressureOpacity: Boolean(data.pressureOpacity),
            tipType: data.tipType || 'round',
          };
        })
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'brushes')
  );
}

// --- Cloud Assets ---
export async function saveAssetCloud(uid: string, asset: AssetLibraryItem): Promise<void> {
  const safeId = sanitizeId(asset.id);
  const path = `assets/${safeId}`;
  const safeTags = asset.tags
    .map((t) => t.trim().slice(0, 32))
    .filter(Boolean)
    .slice(0, 10);

  try {
    await setDoc(doc(db, 'assets', safeId), {
      ownerId: uid,
      name: clampStr(asset.name, 120, 'Aset Baru'),
      category: asset.category,
      format: clampStr(asset.format, 16, 'PNG'),
      width: Math.min(16384, Math.max(1, Math.round(asset.width))),
      height: Math.min(16384, Math.max(1, Math.round(asset.height))),
      fileSizeKb: Math.min(512000, Math.max(0, Math.round(asset.fileSizeKb))),
      tags: safeTags,
      previewUrl: (asset.previewUrl || '').slice(0, 175000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeAssetsCloud(uid: string, onData: (assets: AssetLibraryItem[]) => void): Unsubscribe {
  const q = query(collection(db, 'assets'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || 'Aset'),
            category: data.category || 'Photo',
            format: String(data.format || 'PNG'),
            width: Number(data.width) || 1000,
            height: Number(data.height) || 1000,
            fileSizeKb: Number(data.fileSizeKb) || 100,
            tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
            previewUrl: String(data.previewUrl || ''),
            createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          };
        })
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'assets')
  );
}

export async function deleteAssetCloud(assetId: string): Promise<void> {
  const safeId = sanitizeId(assetId);
  try {
    await deleteDoc(doc(db, 'assets', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `assets/${safeId}`);
  }
}

// --- Custom Plugins ---
export async function savePluginCloud(uid: string, plugin: StudioPlugin): Promise<void> {
  const safeId = sanitizeId(plugin.id);
  const path = `plugins/${safeId}`;
  try {
    await setDoc(doc(db, 'plugins', safeId), {
      ownerId: uid,
      name: clampStr(plugin.name, 80, 'Plugin Kustom'),
      version: clampStr(plugin.version, 24, '1.0.0'),
      author: clampStr(plugin.author, 80, 'Pengguna'),
      description: clampStr(plugin.description, 300, 'Filter piksel kustom'),
      enabled: Boolean(plugin.enabled),
      code: (plugin.code || '').slice(0, 7900),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribePluginsCloud(uid: string, onData: (plugins: StudioPlugin[]) => void): Unsubscribe {
  const q = query(collection(db, 'plugins'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || 'Plugin'),
            version: String(data.version || '1.0.0'),
            author: String(data.author || 'Komunitas'),
            description: String(data.description || ''),
            enabled: Boolean(data.enabled),
            code: String(data.code || ''),
          };
        })
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'plugins')
  );
}

// --- Analytics Sessions ---
export async function saveAnalyticsSessionCloud(uid: string, session: AnalyticsSessionItem): Promise<void> {
  const safeId = sanitizeId(session.id);
  const path = `analytics/${safeId}`;
  const ref = doc(db, 'analytics', safeId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        durationSec: Math.min(86400, Math.max(0, Math.round(session.durationSec))),
        strokesCount: Math.min(1000000, Math.max(0, Math.round(session.strokesCount))),
        layersCreated: Math.min(10000, Math.max(0, Math.round(session.layersCreated))),
        exportsCount: Math.min(10000, Math.max(0, Math.round(session.exportsCount))),
        activeTool: clampStr(session.activeTool, 40, 'brush'),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: uid,
        projectId: sanitizeId(session.projectId),
        projectTitle: clampStr(session.projectTitle, 120, 'Proyek Studio'),
        durationSec: Math.min(86400, Math.max(0, Math.round(session.durationSec))),
        strokesCount: Math.min(1000000, Math.max(0, Math.round(session.strokesCount))),
        layersCreated: Math.min(10000, Math.max(0, Math.round(session.layersCreated))),
        exportsCount: Math.min(10000, Math.max(0, Math.round(session.exportsCount))),
        activeTool: clampStr(session.activeTool, 40, 'brush'),
        dateKey: session.dateKey.replace(/[^0-9-]/g, '').slice(0, 16) || '2026-01-01',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeAnalyticsCloud(uid: string, onData: (items: AnalyticsSessionItem[]) => void): Unsubscribe {
  const q = query(collection(db, 'analytics'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          projectId: String(data.projectId || ''),
          projectTitle: String(data.projectTitle || 'Proyek'),
          durationSec: Number(data.durationSec) || 0,
          strokesCount: Number(data.strokesCount) || 0,
          layersCreated: Number(data.layersCreated) || 0,
          exportsCount: Number(data.exportsCount) || 0,
          activeTool: String(data.activeTool || 'brush'),
          dateKey: String(data.dateKey || ''),
          updatedAtMs: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
        };
      });
      list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'analytics')
  );
}
