import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { WifiOff } from 'lucide-react';
import {
  BUILT_IN_ASSETS,
  BUILT_IN_BRUSHES,
  BUILT_IN_PLUGINS,
  DEFAULT_ADJUSTMENT_PARAMS,
  DEFAULT_LAYER_EFFECTS,
  DEFAULT_SHORTCUT_MAP,
  SAMPLE_ASSETS_PATHS,
} from './data/defaults';
import {
  cloneCanvas,
  compositeLayers,
  createOffscreenCanvas,
  deserializeLayers,
  generateThumbnail,
  importPsdFile,
  loadImageFromUrl,
  runPluginOnCanvas,
  serializeLayers,
} from './lib/canvasEngine';
import {
  deleteAssetCloud,
  deleteProjectCloud,
  listBackupsCloud,
  loadUserPreferencesCloud,
  saveAnalyticsSessionCloud,
  saveAssetCloud,
  saveBackupCloud,
  saveBrushCloud,
  savePluginCloud,
  saveProjectCloud,
  saveUserPreferencesCloud,
  signInWithGoogle,
  signOutUser,
  subscribeAnalyticsCloud,
  subscribeAssetsCloud,
  subscribeAuth,
  subscribeBrushesCloud,
  subscribePluginsCloud,
  subscribeProjectsCloud,
} from './lib/firebase';
import {
  deleteLocalProject,
  getLocalProject,
  listLocalBackups,
  listLocalProjects,
  saveLocalBackup,
  saveLocalProject,
} from './lib/offlineStorage';
import { useCollabSocket } from './hooks/useCollabSocket';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { PhotoshopMenuBar } from './components/PhotoshopMenuBar';
import { ToolOptionsBar } from './components/ToolOptionsBar';
import { LeftToolbar } from './components/LeftToolbar';
import { StudioCanvas } from './components/StudioCanvas';
import { RightInspector } from './components/RightInspector';
import { RawDevelopModal } from './components/RawDevelopModal';
import { ExportModal } from './components/ExportModal';
import { PluginManagerModal } from './components/PluginManagerModal';
import { AssetManagerModal } from './components/AssetManagerModal';
import { CollabModal } from './components/CollabModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { CloudProjectsModal } from './components/CloudProjectsModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import type {
  AdjustmentParams,
  AdjustmentType,
  AnalyticsSessionItem,
  AssetLibraryItem,
  BackupSnapshot,
  BrushPreset,
  ColorProfile,
  LayerEffects,
  ProjectMeta,
  PushNotificationItem,
  SelectionRect,
  SerializedLayer,
  ShortcutMap,
  StudioLayer,
  StudioPlugin,
  StylusTelemetry,
  ToolId,
} from './types/studio';

interface HistoryEntry {
  label: string;
  layers: SerializedLayer[];
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeRoomCode(): string {
  return `CS-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(10 + Math.random() * 89)}`;
}

export default function App() {
  const isOnline = useOnlineStatus();

  // Auth & Cloud State
  const [user, setUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'offline'>('saved');

  // Theme & User Preferences
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('cs_theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [pressureCurve, setPressureCurve] = useState<number>(() => {
    const saved = Number(localStorage.getItem('cs_pressure_curve'));
    return saved >= 0.2 && saved <= 3 ? saved : 1.0;
  });
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => {
    try {
      const raw = localStorage.getItem('cs_shortcuts');
      return raw ? { ...DEFAULT_SHORTCUT_MAP, ...JSON.parse(raw) } : { ...DEFAULT_SHORTCUT_MAP };
    } catch {
      return { ...DEFAULT_SHORTCUT_MAP };
    }
  });

  // Active Project & Canvas State
  const [projectMeta, setProjectMeta] = useState<ProjectMeta>(() => ({
    id: 'proj_starter_bromo',
    title: 'Kaldera Bromo Studio',
    width: 1280,
    height: 720,
    dpi: 300,
    colorProfile: 'sRGB',
    roomCode: 'CS-BROMO-01',
    layerCount: 3,
    thumbnailUrl: '',
    updatedAtMs: Date.now(),
    syncedToCloud: false,
  }));
  const [layers, setLayers] = useState<StudioLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>('');
  const [renderVersion, setRenderVersion] = useState(0);

  // Tools & Viewport State
  const [activeTool, setActiveTool] = useState<ToolId>('brush');
  const [foregroundColor, setForegroundColor] = useState('#3b82f6');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [shapeType, setShapeType] = useState<'rectangle' | 'ellipse' | 'rounded' | 'line'>('rounded');
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(3);
  const [textSize, setTextSize] = useState(52);
  const [textFont, setTextFont] = useState('Plus Jakarta Sans');
  const [stylusOnly, setStylusOnly] = useState(false);
  const [stylusTelemetry, setStylusTelemetry] = useState<StylusTelemetry>({
    pointerType: 'mouse',
    pressure: 0,
    tiltX: 0,
    tiltY: 0,
    isDrawing: false,
  });
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selection, setSelection] = useState<SelectionRect | null>(null);

  // Brushes, Assets, Plugins, Projects, Backups
  const [userBrushes, setUserBrushes] = useState<BrushPreset[]>([]);
  const [activeBrush, setActiveBrush] = useState<BrushPreset>(BUILT_IN_BRUSHES[0]);
  const [userAssets, setUserAssets] = useState<AssetLibraryItem[]>([]);
  const [plugins, setPlugins] = useState<StudioPlugin[]>(BUILT_IN_PLUGINS);
  const [cloudProjects, setCloudProjects] = useState<ProjectMeta[]>([]);
  const [localProjects, setLocalProjects] = useState<ProjectMeta[]>([]);
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);

  // Undo / Redo History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Notifications & Analytics
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const [sessionStats, setSessionStats] = useState<AnalyticsSessionItem>({
    id: sessionId,
    projectId: 'proj_starter_bromo',
    projectTitle: 'Kaldera Bromo Studio',
    durationSec: 0,
    strokesCount: 0,
    layersCreated: 0,
    exportsCount: 0,
    activeTool: 'brush',
    dateKey: getTodayKey(),
    updatedAtMs: Date.now(),
  });
  const [toolUsageSeconds, setToolUsageSeconds] = useState<Record<string, number>>({});
  const [historicalSessions, setHistoricalSessions] = useState<AnalyticsSessionItem[]>([]);

  // Modals & UI Drawers
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [rawModalOpen, setRawModalOpen] = useState(false);
  const [rawInitialUrl, setRawInitialUrl] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pluginsModalOpen, setPluginsModalOpen] = useState(false);
  const [assetsModalOpen, setAssetsModalOpen] = useState(false);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const psdInputRef = useRef<HTMLInputElement>(null);
  const dirtySinceBackupRef = useRef(false);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const projectMetaRef = useRef(projectMeta);
  projectMetaRef.current = projectMeta;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Apply Dark/Light theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('cs_theme', theme);
  }, [theme]);

  // Trigger Native Browser / Android Push Notification
  const triggerNativePush = useCallback((item: PushNotificationItem) => {
    setNotifications((prev) => [item, ...prev].slice(0, 40));
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(item.title, {
              body: item.body,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: item.id,
            });
          })
          .catch(() => {
            new Notification(item.title, { body: item.body, icon: '/pwa-192x192.png' });
          });
      } else {
        new Notification(item.title, { body: item.body, icon: '/pwa-192x192.png' });
      }
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      showToast('Notifikasi push proyek mendesak diaktifkan.');
    }
  };

  // Real-Time WebSocket Collaboration
  const handleRemoteCanvasOp = useCallback(
    (op: { opId: string; senderId: string; type: string; payload: Record<string, unknown> }) => {
      if (op.type === 'layer:visibility' && typeof op.payload.layerId === 'string') {
        setLayers((prev) =>
          prev.map((l) => (l.id === op.payload.layerId ? { ...l, visible: Boolean(op.payload.visible) } : l))
        );
        setRenderVersion((v) => v + 1);
      } else if (op.type === 'layer:opacity' && typeof op.payload.layerId === 'string') {
        setLayers((prev) =>
          prev.map((l) => (l.id === op.payload.layerId ? { ...l, opacity: Number(op.payload.opacity) || 100 } : l))
        );
        setRenderVersion((v) => v + 1);
      } else if (op.type === 'layer:stroke' && typeof op.payload.layerId === 'string' && typeof op.payload.dataUrl === 'string') {
        loadImageFromUrl(op.payload.dataUrl)
          .then((img) => {
            setLayers((prev) =>
              prev.map((l) => {
                if (l.id !== op.payload.layerId || !l.canvas) return l;
                const ctx = l.canvas.getContext('2d');
                if (ctx) {
                  ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
                  ctx.drawImage(img, 0, 0);
                }
                return { ...l, thumbnailDataUrl: generateThumbnail(l.canvas, 72, 72) };
              })
            );
            setRenderVersion((v) => v + 1);
          })
          .catch(() => {});
      }
    },
    []
  );

  const collab = useCollabSocket({
    roomCode: projectMeta.roomCode,
    userName: user?.displayName || 'Desainer Studio',
    enabled: isOnline,
    onRemoteOp: handleRemoteCanvasOp,
    onUrgentNotification: triggerNativePush,
  });

  // Push History Snapshot
  const pushHistory = useCallback((nextLayers: StudioLayer[], label: string) => {
    const serialized = serializeLayers(nextLayers);
    setHistory((prev) => {
      const sliced = prev.slice(0, Math.max(0, historyIndex + 1));
      const updated = [...sliced, { label, layers: serialized }].slice(-25);
      setHistoryIndex(updated.length - 1);
      return updated;
    });
    dirtySinceBackupRef.current = true;
  }, [historyIndex]);

  // Fit Canvas to Viewport Helper
  const fitCanvasToViewport = useCallback((w: number, h: number) => {
    const availW = Math.max(320, window.innerWidth - (window.innerWidth >= 1024 ? 390 : 76));
    const availH = Math.max(260, window.innerHeight - 130);
    const ratio = Math.min(availW / w, availH / h, 1);
    setZoom(Math.max(0.2, Number((ratio * 0.92).toFixed(2))));
    setPan({ x: 0, y: 0 });
  }, []);

  // Initialize Starter Studio Canvas (or restore last saved local project)
  useEffect(() => {
    let cancelled = false;
    async function initStudio() {
      const storedList = await listLocalProjects().catch(() => []);
      if (!cancelled) {
        setLocalProjects(storedList.map((s) => s.meta));
      }

      if (storedList.length > 0) {
        const latest = storedList[0];
        const restored = await deserializeLayers(latest.layers, latest.meta.width, latest.meta.height);
        if (!cancelled && restored.length > 0) {
          setProjectMeta(latest.meta);
          setLayers(restored);
          setActiveLayerId(restored[restored.length - 1].id);
          setHistory([{ label: 'Dimuat dari Penyimpanan', layers: latest.layers }]);
          setHistoryIndex(0);
          fitCanvasToViewport(latest.meta.width, latest.meta.height);
          const localBks = await listLocalBackups(latest.meta.id).catch(() => []);
          if (!cancelled) setBackups(localBks);
          return;
        }
      }

      // First-time boot: build crisp starter workspace with Mount Bromo RAW landscape + editable brush layer
      const w = 1280;
      const h = 720;
      const bgCanvas = createOffscreenCanvas(w, h);
      try {
        const img = await loadImageFromUrl(SAMPLE_ASSETS_PATHS.mountain);
        const ctx = bgCanvas.getContext('2d')!;
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      } catch {
        const ctx = bgCanvas.getContext('2d')!;
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      const paintCanvas = createOffscreenCanvas(w, h);
      const initialLayers: StudioLayer[] = [
        {
          id: 'layer_bg_raw',
          name: 'Kaldera Bromo (RAW)',
          type: 'raster',
          visible: true,
          locked: false,
          opacity: 100,
          blendMode: 'source-over',
          x: 0,
          y: 0,
          clippingMask: false,
          maskEnabled: false,
          editingMask: false,
          canvas: bgCanvas,
          effects: structuredClone(DEFAULT_LAYER_EFFECTS),
          thumbnailDataUrl: generateThumbnail(bgCanvas, 72, 72),
        },
        {
          id: 'layer_adj_tone',
          name: 'Penyesuaian: Brightness / Contrast',
          type: 'adjustment',
          visible: true,
          locked: false,
          opacity: 100,
          blendMode: 'source-over',
          x: 0,
          y: 0,
          clippingMask: false,
          maskEnabled: false,
          editingMask: false,
          adjustmentType: 'brightness-contrast',
          adjustmentParams: { ...DEFAULT_ADJUSTMENT_PARAMS, contrast: 8 },
          effects: structuredClone(DEFAULT_LAYER_EFFECTS),
        },
        {
          id: 'layer_paint_1',
          name: 'Sketsa & Retouch Stylus',
          type: 'raster',
          visible: true,
          locked: false,
          opacity: 100,
          blendMode: 'source-over',
          x: 0,
          y: 0,
          clippingMask: false,
          maskEnabled: false,
          editingMask: false,
          canvas: paintCanvas,
          effects: structuredClone(DEFAULT_LAYER_EFFECTS),
          thumbnailDataUrl: generateThumbnail(paintCanvas, 72, 72),
        },
      ];

      if (!cancelled) {
        setLayers(initialLayers);
        setActiveLayerId('layer_paint_1');
        const serialized = serializeLayers(initialLayers);
        setHistory([{ label: 'Dokumen Awal Studio', layers: serialized }]);
        setHistoryIndex(0);
        fitCanvasToViewport(w, h);
      }
    }
    initStudio();
    return () => {
      cancelled = true;
    };
  }, [fitCanvasToViewport]);

  // Firebase Auth & Cloud Subscriptions
  useEffect(() => {
    const unsubAuth = subscribeAuth((u) => {
      setUser(u);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setCloudProjects([]);
      setUserBrushes([]);
      setUserAssets([]);
      setHistoricalSessions([]);
      return;
    }

    loadUserPreferencesCloud(user.uid)
      .then((prefs) => {
        if (!prefs) return;
        setTheme(prefs.theme);
        setPressureCurve(prefs.stylusPressureCurve);
        if (prefs.shortcuts && Object.keys(prefs.shortcuts).length > 0) {
          setShortcuts({ ...DEFAULT_SHORTCUT_MAP, ...prefs.shortcuts });
        }
      })
      .catch(() => {});

    const unsubProj = subscribeProjectsCloud(user.uid, setCloudProjects);
    const unsubBrush = subscribeBrushesCloud(user.uid, setUserBrushes);
    const unsubAssets = subscribeAssetsCloud(user.uid, setUserAssets);
    const unsubPlugins = subscribePluginsCloud(user.uid, (cloudPlugs) => {
      setPlugins([...BUILT_IN_PLUGINS, ...cloudPlugs]);
    });
    const unsubAnalytics = subscribeAnalyticsCloud(user.uid, setHistoricalSessions);

    return () => {
      unsubProj();
      unsubBrush();
      unsubAssets();
      unsubPlugins();
      unsubAnalytics();
    };
  }, [user]);

  // Save Project to IndexedDB (always offline-safe) + Cloud Firestore (when signed in & online)
  const persistProjectNow = useCallback(
    async (silent = false) => {
      if (layersRef.current.length === 0) return;
      setSyncState(isOnline ? 'saving' : 'offline');

      const composite = createOffscreenCanvas(projectMetaRef.current.width, projectMetaRef.current.height);
      compositeLayers(composite, layersRef.current, projectMetaRef.current.width, projectMetaRef.current.height);
      const thumb = generateThumbnail(composite, 280, 180);

      const updatedMeta: ProjectMeta = {
        ...projectMetaRef.current,
        layerCount: layersRef.current.length,
        thumbnailUrl: thumb,
        updatedAtMs: Date.now(),
        syncedToCloud: Boolean(user && isOnline),
      };

      const serialized = serializeLayers(layersRef.current);
      await saveLocalProject({ meta: updatedMeta, layers: serialized });
      const storedList = await listLocalProjects().catch(() => []);
      setLocalProjects(storedList.map((s) => s.meta));
      setProjectMeta(updatedMeta);

      if (user && isOnline) {
        try {
          await saveProjectCloud(user.uid, updatedMeta);
          setSyncState('saved');
        } catch {
          setSyncState('offline');
        }
      } else {
        setSyncState(isOnline ? 'saved' : 'offline');
      }

      if (!silent) {
        showToast(user && isOnline ? 'Proyek tersimpan & tersinkronisasi ke Cloud.' : 'Proyek tersimpan aman secara lokal (Offline).');
      }
    },
    [isOnline, user, showToast]
  );

  // Debounced Auto-Save on layer changes
  useEffect(() => {
    if (layers.length === 0) return;
    const timer = window.setTimeout(() => {
      persistProjectNow(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, [layers, renderVersion, projectMeta.title, persistProjectNow]);

  // Sync automatically when coming back online
  useEffect(() => {
    if (isOnline && user && layersRef.current.length > 0) {
      persistProjectNow(true);
    }
  }, [isOnline, user, persistProjectNow]);

  // Create Auto-Backup Snapshot (Local + Cloud)
  const createBackupSnapshot = useCallback(
    async (label = 'Cadangan Otomatis') => {
      if (layersRef.current.length === 0) return;
      const meta = projectMetaRef.current;
      const composite = createOffscreenCanvas(meta.width, meta.height);
      compositeLayers(composite, layersRef.current, meta.width, meta.height);
      const thumb = generateThumbnail(composite, 220, 140);
      const serialized = serializeLayers(layersRef.current);

      const snapshot: BackupSnapshot = {
        id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        projectId: meta.id,
        label,
        layerCount: layersRef.current.length,
        width: meta.width,
        height: meta.height,
        thumbnailUrl: thumb,
        snapshotSummary: `${layersRef.current.length} layer (${meta.width}×${meta.height})`,
        createdAtMs: Date.now(),
        layers: serialized,
        isCloud: Boolean(user && isOnline),
      };

      await saveLocalBackup(snapshot);
      setBackups((prev) => [snapshot, ...prev].slice(0, 20));
      dirtySinceBackupRef.current = false;

      if (user && isOnline) {
        try {
          await saveProjectCloud(user.uid, { ...meta, thumbnailUrl: thumb, layerCount: layersRef.current.length });
          await saveBackupCloud(user.uid, snapshot);
        } catch {
          // Local backup already saved
        }
      }
    },
    [user, isOnline]
  );

  // Periodic Auto-Backup every 45s if modified
  useEffect(() => {
    const id = window.setInterval(() => {
      if (dirtySinceBackupRef.current) {
        createBackupSnapshot('Auto-Backup Berkala');
      }
    }, 45000);
    return () => clearInterval(id);
  }, [createBackupSnapshot]);

  // Productivity & Active Time Analytics Tracker (1s heartbeat when tab visible)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setSessionStats((prev) => ({
        ...prev,
        projectId: projectMetaRef.current.id,
        projectTitle: projectMetaRef.current.title,
        activeTool,
        durationSec: prev.durationSec + 1,
        updatedAtMs: Date.now(),
      }));
      setToolUsageSeconds((prev) => ({
        ...prev,
        [activeTool]: (prev[activeTool] || 0) + 1,
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [activeTool]);

  // Sync Analytics session to Firestore every 30s when signed in
  useEffect(() => {
    if (!user || !isOnline) return;
    const id = window.setInterval(() => {
      if (sessionStats.durationSec >= 5) {
        saveAnalyticsSessionCloud(user.uid, sessionStats).catch(() => {});
      }
    }, 30000);
    return () => clearInterval(id);
  }, [user, isOnline, sessionStats]);

  // --- Layer Operations ---
  const addRasterLayer = useCallback(
    (name?: string, customCanvas?: HTMLCanvasElement) => {
      const c = customCanvas || createOffscreenCanvas(projectMeta.width, projectMeta.height);
      const newLayer: StudioLayer = {
        id: `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: name || `Layer ${layersRef.current.length + 1}`,
        type: 'raster',
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'source-over',
        x: 0,
        y: 0,
        clippingMask: false,
        maskEnabled: false,
        editingMask: false,
        canvas: c,
        effects: structuredClone(DEFAULT_LAYER_EFFECTS),
        thumbnailDataUrl: generateThumbnail(c, 72, 72),
      };
      const next = [...layersRef.current, newLayer];
      setLayers(next);
      setActiveLayerId(newLayer.id);
      setRenderVersion((v) => v + 1);
      pushHistory(next, `Tambah ${newLayer.name}`);
      setSessionStats((s) => ({ ...s, layersCreated: s.layersCreated + 1 }));
    },
    [projectMeta.width, projectMeta.height, pushHistory]
  );

  const addAdjustmentLayer = useCallback(
    (type: AdjustmentType) => {
      const labelMap: Record<AdjustmentType, string> = {
        'brightness-contrast': 'Brightness / Contrast',
        'hue-saturation': 'Hue / Saturation',
        exposure: 'Exposure',
        levels: 'Levels',
        'color-balance': 'Color Balance',
        'black-white': 'Black & White',
        vibrance: 'Vibrance',
        invert: 'Invert',
      };
      const newLayer: StudioLayer = {
        id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `Penyesuaian: ${labelMap[type]}`,
        type: 'adjustment',
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'source-over',
        x: 0,
        y: 0,
        clippingMask: false,
        maskEnabled: false,
        editingMask: false,
        adjustmentType: type,
        adjustmentParams: { ...DEFAULT_ADJUSTMENT_PARAMS },
        effects: structuredClone(DEFAULT_LAYER_EFFECTS),
      };
      const next = [...layersRef.current, newLayer];
      setLayers(next);
      setActiveLayerId(newLayer.id);
      setRenderVersion((v) => v + 1);
      pushHistory(next, `Adjustment ${labelMap[type]}`);
      setSessionStats((s) => ({ ...s, layersCreated: s.layersCreated + 1 }));
    },
    [pushHistory]
  );

  const duplicateActiveLayer = useCallback(() => {
    const src = layersRef.current.find((l) => l.id === activeLayerId);
    if (!src) return;
    const copy: StudioLayer = {
      ...src,
      id: `layer_dup_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: `${src.name} Salinan`,
      canvas: src.canvas ? cloneCanvas(src.canvas) : undefined,
      maskCanvas: src.maskCanvas ? cloneCanvas(src.maskCanvas) : undefined,
      adjustmentParams: src.adjustmentParams ? { ...src.adjustmentParams } : undefined,
      textData: src.textData ? { ...src.textData } : undefined,
      shapeData: src.shapeData ? { ...src.shapeData } : undefined,
      effects: structuredClone(src.effects),
    };
    const idx = layersRef.current.findIndex((l) => l.id === activeLayerId);
    const next = [...layersRef.current];
    next.splice(idx + 1, 0, copy);
    setLayers(next);
    setActiveLayerId(copy.id);
    setRenderVersion((v) => v + 1);
    pushHistory(next, `Duplikasi ${src.name}`);
  }, [activeLayerId, pushHistory]);

  const deleteLayer = useCallback(
    (id: string) => {
      if (layersRef.current.length <= 1) return;
      const next = layersRef.current.filter((l) => l.id !== id);
      setLayers(next);
      if (activeLayerId === id) {
        setActiveLayerId(next[next.length - 1].id);
      }
      setRenderVersion((v) => v + 1);
      pushHistory(next, 'Hapus Layer');
    },
    [activeLayerId, pushHistory]
  );

  const moveLayerOrder = useCallback(
    (id: string, dir: 'up' | 'down') => {
      const idx = layersRef.current.findIndex((l) => l.id === id);
      if (idx === -1) return;
      const targetIdx = dir === 'up' ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= layersRef.current.length) return;
      const next = [...layersRef.current];
      const [item] = next.splice(idx, 1);
      next.splice(targetIdx, 0, item);
      setLayers(next);
      setRenderVersion((v) => v + 1);
      pushHistory(next, 'Ubah Urutan Layer');
    },
    [pushHistory]
  );

  const updateLayer = useCallback(
    (id: string, patch: Partial<StudioLayer>) => {
      setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      setRenderVersion((v) => v + 1);
      if (patch.visible !== undefined) {
        collab.sendCanvasOp('layer:visibility', { layerId: id, visible: patch.visible });
      }
      if (patch.opacity !== undefined) {
        collab.sendCanvasOp('layer:opacity', { layerId: id, opacity: patch.opacity });
      }
    },
    [collab]
  );

  const updateAdjustment = useCallback((id: string, patch: Partial<AdjustmentParams>) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === id && l.adjustmentParams
          ? { ...l, adjustmentParams: { ...l.adjustmentParams, ...patch } }
          : l
      )
    );
    setRenderVersion((v) => v + 1);
  }, []);

  const updateEffects = useCallback((id: string, effects: LayerEffects) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, effects } : l)));
    setRenderVersion((v) => v + 1);
  }, []);

  const toggleLayerMask = useCallback(
    (id: string) => {
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== id || l.type !== 'raster') return l;
          if (!l.maskCanvas) {
            const mc = createOffscreenCanvas(projectMeta.width, projectMeta.height);
            const mctx = mc.getContext('2d')!;
            mctx.fillStyle = '#ffffff';
            mctx.fillRect(0, 0, mc.width, mc.height);
            return { ...l, maskCanvas: mc, maskEnabled: true, editingMask: true };
          }
          return { ...l, maskEnabled: true, editingMask: !l.editingMask };
        })
      );
      setRenderVersion((v) => v + 1);
      showToast('Mode Layer Mask: gunakan warna hitam/eraser untuk menyembunyikan area non-destruktif.');
    },
    [projectMeta.width, projectMeta.height, showToast]
  );

  const mergeDown = useCallback(() => {
    const idx = layersRef.current.findIndex((l) => l.id === activeLayerId);
    if (idx <= 0) return;
    const upper = layersRef.current[idx];
    const lower = layersRef.current[idx - 1];
    const mergedCanvas = createOffscreenCanvas(projectMeta.width, projectMeta.height);
    compositeLayers(mergedCanvas, [lower, upper], projectMeta.width, projectMeta.height);

    const mergedLayer: StudioLayer = {
      ...lower,
      name: `${lower.name} + ${upper.name}`,
      type: 'raster',
      canvas: mergedCanvas,
      x: 0,
      y: 0,
      opacity: 100,
      blendMode: 'source-over',
      maskEnabled: false,
      editingMask: false,
      maskCanvas: undefined,
      effects: structuredClone(DEFAULT_LAYER_EFFECTS),
      thumbnailDataUrl: generateThumbnail(mergedCanvas, 72, 72),
    };
    const next = [...layersRef.current];
    next.splice(idx - 1, 2, mergedLayer);
    setLayers(next);
    setActiveLayerId(mergedLayer.id);
    setRenderVersion((v) => v + 1);
    pushHistory(next, 'Gabungkan Layer (Merge Down)');
  }, [activeLayerId, projectMeta.width, projectMeta.height, pushHistory]);

  const flattenImage = useCallback(() => {
    const flat = createOffscreenCanvas(projectMeta.width, projectMeta.height);
    compositeLayers(flat, layersRef.current, projectMeta.width, projectMeta.height);
    const flatLayer: StudioLayer = {
      id: `layer_flat_${Date.now()}`,
      name: 'Background (Flattened)',
      type: 'raster',
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      clippingMask: false,
      maskEnabled: false,
      editingMask: false,
      canvas: flat,
      effects: structuredClone(DEFAULT_LAYER_EFFECTS),
      thumbnailDataUrl: generateThumbnail(flat, 72, 72),
    };
    setLayers([flatLayer]);
    setActiveLayerId(flatLayer.id);
    setRenderVersion((v) => v + 1);
    pushHistory([flatLayer], 'Flatten Semua Layer');
  }, [projectMeta.width, projectMeta.height, pushHistory]);

  // Undo / Redo Jump
  const jumpHistory = useCallback(
    async (idx: number) => {
      if (idx < 0 || idx >= history.length) return;
      const entry = history[idx];
      const restored = await deserializeLayers(entry.layers, projectMeta.width, projectMeta.height);
      setLayers(restored);
      setHistoryIndex(idx);
      if (restored.length > 0 && !restored.some((l) => l.id === activeLayerId)) {
        setActiveLayerId(restored[restored.length - 1].id);
      }
      setRenderVersion((v) => v + 1);
    },
    [history, projectMeta.width, projectMeta.height, activeLayerId]
  );

  // Canvas Interaction Callbacks
  const handleStrokeComplete = useCallback(
    (layerId: string) => {
      setLayers((prev) => {
        const next = prev.map((l) =>
          l.id === layerId && l.canvas ? { ...l, thumbnailDataUrl: generateThumbnail(l.canvas, 72, 72) } : l
        );
        pushHistory(next, activeTool === 'eraser' ? 'Hapus Goresan' : activeTool === 'fill' ? 'Isi Warna' : 'Goresan Brush');
        const target = next.find((l) => l.id === layerId);
        if (target?.canvas && collab.peers.length > 0) {
          collab.sendCanvasOp('layer:stroke', {
            layerId,
            dataUrl: target.canvas.toDataURL('image/png'),
          });
        }
        return next;
      });
      setSessionStats((s) => ({ ...s, strokesCount: s.strokesCount + 1 }));
    },
    [activeTool, pushHistory, collab]
  );

  const handleMoveLayer = useCallback(
    (layerId: string, dx: number, dy: number, commit: boolean) => {
      if (commit) {
        pushHistory(layersRef.current, 'Pindahkan Layer');
        return;
      }
      setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, x: l.x + dx, y: l.y + dy } : l)));
      setRenderVersion((v) => v + 1);
    },
    [pushHistory]
  );

  const handleAddTextAt = useCallback(
    (x: number, y: number, content: string) => {
      const newLayer: StudioLayer = {
        id: `text_${Date.now()}`,
        name: `Teks: ${content.slice(0, 18)}`,
        type: 'text',
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'source-over',
        x,
        y,
        clippingMask: false,
        maskEnabled: false,
        editingMask: false,
        textData: {
          content,
          fontSize: textSize,
          fontFamily: textFont,
          color: foregroundColor,
          fontWeight: '700',
          align: 'left',
        },
        effects: structuredClone(DEFAULT_LAYER_EFFECTS),
      };
      const next = [...layersRef.current, newLayer];
      setLayers(next);
      setActiveLayerId(newLayer.id);
      setRenderVersion((v) => v + 1);
      pushHistory(next, 'Tambah Layer Teks');
      setSessionStats((s) => ({ ...s, layersCreated: s.layersCreated + 1 }));
    },
    [textSize, textFont, foregroundColor, pushHistory]
  );

  const handleAddShapeRect = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const newLayer: StudioLayer = {
        id: `shape_${Date.now()}`,
        name: `Bentuk (${shapeType})`,
        type: 'shape',
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'source-over',
        x,
        y,
        clippingMask: false,
        maskEnabled: false,
        editingMask: false,
        shapeData: {
          shapeType,
          fillColor: foregroundColor,
          strokeColor: backgroundColor,
          strokeWidth: shapeStrokeWidth,
          width: w,
          height: h,
        },
        effects: structuredClone(DEFAULT_LAYER_EFFECTS),
      };
      const next = [...layersRef.current, newLayer];
      setLayers(next);
      setActiveLayerId(newLayer.id);
      setRenderVersion((v) => v + 1);
      pushHistory(next, 'Tambah Bentuk');
      setSessionStats((s) => ({ ...s, layersCreated: s.layersCreated + 1 }));
    },
    [shapeType, foregroundColor, backgroundColor, shapeStrokeWidth, pushHistory]
  );

  // Canvas Geometry Transforms (Flip / Rotate / Crop)
  const transformAllRasterLayers = (mode: 'flipH' | 'flipV' | 'rot90') => {
    const oldW = projectMeta.width;
    const oldH = projectMeta.height;
    const newW = mode === 'rot90' ? oldH : oldW;
    const newH = mode === 'rot90' ? oldW : oldH;

    const next = layersRef.current.map((l) => {
      if (l.type !== 'raster' || !l.canvas) return l;
      const out = createOffscreenCanvas(newW, newH);
      const ctx = out.getContext('2d')!;
      ctx.save();
      if (mode === 'flipH') {
        ctx.translate(newW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(l.canvas, l.x, l.y);
      } else if (mode === 'flipV') {
        ctx.translate(0, newH);
        ctx.scale(1, -1);
        ctx.drawImage(l.canvas, l.x, l.y);
      } else {
        ctx.translate(newW, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(l.canvas, l.x, l.y);
      }
      ctx.restore();
      return { ...l, x: 0, y: 0, canvas: out, thumbnailDataUrl: generateThumbnail(out, 72, 72) };
    });

    setProjectMeta((m) => ({ ...m, width: newW, height: newH }));
    setLayers(next);
    setRenderVersion((v) => v + 1);
    pushHistory(next, mode === 'flipH' ? 'Balik Horizontal' : mode === 'flipV' ? 'Balik Vertikal' : 'Putar 90°');
  };

  const applyCropSelection = () => {
    if (!selection || selection.width < 16 || selection.height < 16) return;
    const cw = Math.round(selection.width);
    const ch = Math.round(selection.height);
    const cx = Math.round(selection.x);
    const cy = Math.round(selection.y);

    const next = layersRef.current.map((l) => {
      if (l.type === 'raster' && l.canvas) {
        const cropped = createOffscreenCanvas(cw, ch);
        cropped.getContext('2d')?.drawImage(l.canvas, cx - l.x, cy - l.y, cw, ch, 0, 0, cw, ch);
        return { ...l, x: 0, y: 0, canvas: cropped, thumbnailDataUrl: generateThumbnail(cropped, 72, 72) };
      }
      return { ...l, x: l.x - cx, y: l.y - cy };
    });

    setProjectMeta((m) => ({ ...m, width: cw, height: ch }));
    setLayers(next);
    setSelection(null);
    setRenderVersion((v) => v + 1);
    fitCanvasToViewport(cw, ch);
    pushHistory(next, `Crop ${cw}×${ch}`);
  };

  // File Imports (Image / PSD)
  const handleImportImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImageFromUrl(url);
      const c = createOffscreenCanvas(projectMeta.width, projectMeta.height);
      const scale = Math.min(projectMeta.width / img.naturalWidth, projectMeta.height / img.naturalHeight, 1);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      c.getContext('2d')?.drawImage(img, (projectMeta.width - dw) / 2, (projectMeta.height - dh) / 2, dw, dh);
      addRasterLayer(file.name.replace(/\.[^.]+$/, ''), c);
      showToast(`Gambar "${file.name}" ditambahkan sebagai layer baru.`);
    } finally {
      URL.revokeObjectURL(url);
      e.target.value = '';
    }
  };

  const handleImportPsdFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await importPsdFile(file);
      setProjectMeta((m) => ({
        ...m,
        title: file.name.replace(/\.psd$/i, ''),
        width: parsed.width,
        height: parsed.height,
        layerCount: parsed.layers.length,
      }));
      setLayers(parsed.layers);
      setActiveLayerId(parsed.layers[parsed.layers.length - 1]?.id || '');
      setRenderVersion((v) => v + 1);
      fitCanvasToViewport(parsed.width, parsed.height);
      pushHistory(parsed.layers, `Impor PSD: ${file.name}`);
      showToast(`File PSD berhasil dibuka (${parsed.layers.length} layer editable).`);
    } catch {
      showToast('Gagal membaca file PSD. Pastikan file tidak rusak.');
    } finally {
      e.target.value = '';
    }
  };

  // Apply RAW Developed Canvas as Layer
  const handleApplyRawCanvas = (rawCanvas: HTMLCanvasElement, layerName: string) => {
    const fitted = createOffscreenCanvas(projectMeta.width, projectMeta.height);
    const scale = Math.max(projectMeta.width / rawCanvas.width, projectMeta.height / rawCanvas.height);
    const dw = rawCanvas.width * scale;
    const dh = rawCanvas.height * scale;
    fitted.getContext('2d')?.drawImage(rawCanvas, (projectMeta.width - dw) / 2, (projectMeta.height - dh) / 2, dw, dh);
    addRasterLayer(layerName, fitted);
    showToast(`Hasil RAW Develop "${layerName}" dibuka sebagai layer.`);
  };

  // Run Third-Party Plugin on Active Raster Layer
  const handleRunPlugin = (plugin: StudioPlugin, intensity: number) => {
    const target = layersRef.current.find((l) => l.id === activeLayerId && l.type === 'raster' && l.canvas);
    const fallbackTarget = target || [...layersRef.current].reverse().find((l) => l.type === 'raster' && l.canvas);
    if (!fallbackTarget || !fallbackTarget.canvas) {
      return { ok: false, error: 'Pilih layer raster terlebih dahulu.' };
    }
    const res = runPluginOnCanvas(fallbackTarget.canvas, plugin, intensity);
    if (res.ok) {
      setLayers((prev) => {
        const next = prev.map((l) =>
          l.id === fallbackTarget.id && l.canvas
            ? { ...l, thumbnailDataUrl: generateThumbnail(l.canvas, 72, 72) }
            : l
        );
        pushHistory(next, `Plugin: ${plugin.name}`);
        return next;
      });
      setRenderVersion((v) => v + 1);
    }
    return res;
  };

  // Custom Brush Save
  const handleSaveCustomBrush = async (name: string) => {
    const newBrush: BrushPreset = {
      ...activeBrush,
      id: `brush_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      category: 'Custom',
      isBuiltIn: false,
    };
    setUserBrushes((prev) => [newBrush, ...prev]);
    setActiveBrush(newBrush);
    if (user && isOnline) {
      saveBrushCloud(user.uid, newBrush).catch(() => {});
    }
    showToast(`Brush kustom "${name}" disimpan.`);
  };

  // Custom Shortcuts Save
  const handleUpdateShortcuts = (next: ShortcutMap) => {
    setShortcuts(next);
    localStorage.setItem('cs_shortcuts', JSON.stringify(next));
    if (user && isOnline) {
      saveUserPreferencesCloud(user.uid, {
        displayName: user.displayName || 'Desainer',
        theme,
        stylusPressureCurve: pressureCurve,
        autoSaveIntervalSec: 30,
        notificationsEnabled: notifPermission === 'granted',
        shortcuts: next,
      }).catch(() => {});
    }
  };

  // Global Customizable Keyboard Shortcuts Listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (shortcutsModalOpen) return;

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());
      const combo = parts.join('+');

      const matchedAction = Object.entries(shortcuts).find(([, key]) => key === combo)?.[0];
      if (!matchedAction) return;

      e.preventDefault();
      if (matchedAction.startsWith('tool:')) {
        setActiveTool(matchedAction.replace('tool:', '') as ToolId);
      } else if (matchedAction === 'color:swap') {
        setForegroundColor(backgroundColor);
        setBackgroundColor(foregroundColor);
      } else if (matchedAction === 'color:reset') {
        setForegroundColor('#000000');
        setBackgroundColor('#ffffff');
      } else if (matchedAction === 'brush:smaller') {
        setActiveBrush((b) => ({ ...b, size: Math.max(1, b.size - 4) }));
      } else if (matchedAction === 'brush:larger') {
        setActiveBrush((b) => ({ ...b, size: Math.min(300, b.size + 4) }));
      } else if (matchedAction === 'edit:undo' && historyIndex > 0) {
        jumpHistory(historyIndex - 1);
      } else if (matchedAction === 'edit:redo' && historyIndex < history.length - 1) {
        jumpHistory(historyIndex + 1);
      } else if (matchedAction === 'file:save') {
        persistProjectNow(false);
      } else if (matchedAction === 'file:export') {
        setExportModalOpen(true);
      } else if (matchedAction === 'layer:new') {
        addRasterLayer();
      } else if (matchedAction === 'layer:duplicate') {
        duplicateActiveLayer();
      } else if (matchedAction === 'view:fit') {
        fitCanvasToViewport(projectMeta.width, projectMeta.height);
      } else if (matchedAction === 'view:actual') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    shortcuts,
    shortcutsModalOpen,
    foregroundColor,
    backgroundColor,
    historyIndex,
    history.length,
    jumpHistory,
    persistProjectNow,
    addRasterLayer,
    duplicateActiveLayer,
    fitCanvasToViewport,
    projectMeta.width,
    projectMeta.height,
  ]);

  // Create New Project / Open Saved Project
  const handleCreateProject = (opts: { title: string; width: number; height: number; dpi: number; colorProfile: ColorProfile }) => {
    const newId = makeProjectId();
    const bg = createOffscreenCanvas(opts.width, opts.height);
    const ctx = bg.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, opts.width, opts.height);

    const paint = createOffscreenCanvas(opts.width, opts.height);
    const initLayers: StudioLayer[] = [
      {
        id: `bg_${Date.now()}`,
        name: 'Background',
        type: 'raster',
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'source-over',
        x: 0,
        y: 0,
        clippingMask: false,
        maskEnabled: false,
        editingMask: false,
        canvas: bg,
        effects: structuredClone(DEFAULT_LAYER_EFFECTS),
        thumbnailDataUrl: generateThumbnail(bg, 72, 72),
      },
      {
        id: `layer_${Date.now() + 1}`,
        name: 'Layer 1',
        type: 'raster',
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'source-over',
        x: 0,
        y: 0,
        clippingMask: false,
        maskEnabled: false,
        editingMask: false,
        canvas: paint,
        effects: structuredClone(DEFAULT_LAYER_EFFECTS),
        thumbnailDataUrl: generateThumbnail(paint, 72, 72),
      },
    ];

    setProjectMeta({
      id: newId,
      title: opts.title,
      width: opts.width,
      height: opts.height,
      dpi: opts.dpi,
      colorProfile: opts.colorProfile,
      roomCode: makeRoomCode(),
      layerCount: 2,
      thumbnailUrl: generateThumbnail(bg, 220, 140),
      updatedAtMs: Date.now(),
      syncedToCloud: false,
    });
    setLayers(initLayers);
    setActiveLayerId(initLayers[1].id);
    setBackups([]);
    setHistory([{ label: 'Kanvas Baru', layers: serializeLayers(initLayers) }]);
    setHistoryIndex(0);
    setSelection(null);
    fitCanvasToViewport(opts.width, opts.height);
    showToast(`Kanvas "${opts.title}" (${opts.width}×${opts.height}) siap digunakan.`);
  };

  const handleOpenProject = async (proj: ProjectMeta) => {
    const local = await getLocalProject(proj.id).catch(() => null);
    if (local && local.layers.length > 0) {
      const restored = await deserializeLayers(local.layers, local.meta.width, local.meta.height);
      setProjectMeta(proj);
      setLayers(restored);
      setActiveLayerId(restored[restored.length - 1].id);
      setHistory([{ label: 'Proyek Dibuka', layers: local.layers }]);
      setHistoryIndex(0);
      fitCanvasToViewport(proj.width, proj.height);
    } else {
      // Cloud-synced project from another device: hydrate base layer from thumbnail preview
      const c = createOffscreenCanvas(proj.width, proj.height);
      if (proj.thumbnailUrl) {
        try {
          const img = await loadImageFromUrl(proj.thumbnailUrl);
          c.getContext('2d')?.drawImage(img, 0, 0, proj.width, proj.height);
        } catch {}
      }
      const l: StudioLayer = {
        id: `cloud_${Date.now()}`,
        name: `${proj.title} (Cloud Sync)`,
        type: 'raster',
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: 'source-over',
        x: 0,
        y: 0,
        clippingMask: false,
        maskEnabled: false,
        editingMask: false,
        canvas: c,
        effects: structuredClone(DEFAULT_LAYER_EFFECTS),
        thumbnailDataUrl: generateThumbnail(c, 72, 72),
      };
      setProjectMeta(proj);
      setLayers([l]);
      setActiveLayerId(l.id);
      setHistory([{ label: 'Sinkron dari Cloud', layers: serializeLayers([l]) }]);
      setHistoryIndex(0);
      fitCanvasToViewport(proj.width, proj.height);
    }
    const localBks = await listLocalBackups(proj.id).catch(() => []);
    const cloudBks = user && isOnline ? await listBackupsCloud(user.uid, proj.id).catch(() => []) : [];
    const mergedMap = new Map<string, BackupSnapshot>();
    [...localBks, ...cloudBks].forEach((b) => {
      if (!mergedMap.has(b.id)) mergedMap.set(b.id, b);
    });
    setBackups(Array.from(mergedMap.values()).sort((a, b) => b.createdAtMs - a.createdAtMs));
    showToast(`Proyek "${proj.title}" dibuka.`);
  };

  const handleRestoreBackup = async (bk: BackupSnapshot) => {
    if (!bk.layers) return;
    const restored = await deserializeLayers(bk.layers, bk.width, bk.height);
    setLayers(restored);
    setActiveLayerId(restored[restored.length - 1]?.id || '');
    setRenderVersion((v) => v + 1);
    pushHistory(restored, `Pulihkan: ${bk.label}`);
    showToast(`Snapshot "${bk.label}" berhasil dipulihkan.`);
  };

  // Merge Local + Cloud Projects list
  const mergedProjects = (() => {
    const map = new Map<string, ProjectMeta>();
    [projectMeta, ...localProjects, ...cloudProjects].forEach((p) => {
      const prev = map.get(p.id);
      if (!prev || p.updatedAtMs >= prev.updatedAtMs) {
        map.set(p.id, { ...prev, ...p, syncedToCloud: Boolean(prev?.syncedToCloud || p.syncedToCloud) });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  })();

  const allBrushes = [...userBrushes, ...BUILT_IN_BRUSHES];
  const allAssets = [...userAssets, ...BUILT_IN_ASSETS];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-zinc-100 dark:bg-[#121215] text-zinc-900 dark:text-zinc-100">
      {/* Hidden File Inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImportImageFile} className="hidden" />
      <input ref={psdInputRef} type="file" accept=".psd" onChange={handleImportPsdFile} className="hidden" />

      {/* Top Photoshop Menu Bar */}
      <PhotoshopMenuBar
        projectTitle={projectMeta.title}
        onRenameProject={(title) => setProjectMeta((m) => ({ ...m, title }))}
        user={user}
        onSignIn={() => signInWithGoogle().then(() => showToast('Berhasil masuk Google Cloud.')).catch(() => showToast('Login dibatalkan.'))}
        onSignOut={() => signOutUser().then(() => showToast('Keluar dari akun Cloud.'))}
        isOnline={isOnline}
        syncState={syncState}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        unreadNotifications={unreadCount}
        collabPeersCount={collab.allPeersCount}
        collabConnected={collab.connected}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onNewProject={() => setProjectsModalOpen(true)}
        onOpenCloudProjects={() => setProjectsModalOpen(true)}
        onImportImage={() => imageInputRef.current?.click()}
        onImportPsd={() => psdInputRef.current?.click()}
        onOpenRawDevelop={() => {
          setRawInitialUrl(null);
          setRawModalOpen(true);
        }}
        onSaveNow={() => persistProjectNow(false)}
        onCreateBackup={() => {
          createBackupSnapshot('Cadangan Manual').then(() => showToast('Snapshot cadangan berhasil dibuat.'));
        }}
        onOpenExport={() => setExportModalOpen(true)}
        onUndo={() => historyIndex > 0 && jumpHistory(historyIndex - 1)}
        onRedo={() => historyIndex < history.length - 1 && jumpHistory(historyIndex + 1)}
        onClearLayer={() => {
          const target = layers.find((l) => l.id === activeLayerId);
          if (target?.type === 'raster' && target.canvas && !target.locked) {
            target.canvas.getContext('2d')?.clearRect(0, 0, target.canvas.width, target.canvas.height);
            handleStrokeComplete(target.id);
            setRenderVersion((v) => v + 1);
          }
        }}
        onOpenShortcuts={() => setShortcutsModalOpen(true)}
        onFlipCanvasH={() => transformAllRasterLayers('flipH')}
        onFlipCanvasV={() => transformAllRasterLayers('flipV')}
        onRotate90={() => transformAllRasterLayers('rot90')}
        onNewRasterLayer={() => addRasterLayer()}
        onDuplicateLayer={duplicateActiveLayer}
        onAddAdjustmentLayer={addAdjustmentLayer}
        onMergeDown={mergeDown}
        onFlattenImage={flattenImage}
        onToggleLayerMask={() => activeLayerId && toggleLayerMask(activeLayerId)}
        onSelectAll={() => setSelection({ x: 0, y: 0, width: projectMeta.width, height: projectMeta.height })}
        onDeselect={() => setSelection(null)}
        onOpenPlugins={() => setPluginsModalOpen(true)}
        onZoomIn={() => setZoom((z) => Math.min(6, Number((z * 1.2).toFixed(2))))}
        onZoomOut={() => setZoom((z) => Math.max(0.15, Number((z / 1.2).toFixed(2))))}
        onZoomFit={() => fitCanvasToViewport(projectMeta.width, projectMeta.height)}
        onZoom100={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
        onOpenAssets={() => setAssetsModalOpen(true)}
        onOpenCollab={() => setCollabModalOpen(true)}
        onOpenAnalytics={() => setAnalyticsModalOpen(true)}
        onOpenNotifications={() => setNotifDrawerOpen(true)}
        onToggleMobileInspector={() => setMobileInspectorOpen((v) => !v)}
      />

      {/* Context-Sensitive Tool Options Bar */}
      <ToolOptionsBar
        activeTool={activeTool}
        activeBrush={activeBrush}
        onUpdateBrush={(patch) => setActiveBrush((b) => ({ ...b, ...patch }))}
        shapeType={shapeType}
        onChangeShapeType={setShapeType}
        shapeStrokeWidth={shapeStrokeWidth}
        onChangeShapeStrokeWidth={setShapeStrokeWidth}
        textSize={textSize}
        onChangeTextSize={setTextSize}
        textFont={textFont}
        onChangeTextFont={setTextFont}
        stylusOnly={stylusOnly}
        onToggleStylusOnly={() => setStylusOnly((v) => !v)}
        stylusTelemetry={stylusTelemetry}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(6, Number((z * 1.2).toFixed(2))))}
        onZoomOut={() => setZoom((z) => Math.max(0.15, Number((z / 1.2).toFixed(2))))}
        onZoomFit={() => fitCanvasToViewport(projectMeta.width, projectMeta.height)}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={() => historyIndex > 0 && jumpHistory(historyIndex - 1)}
        onRedo={() => historyIndex < history.length - 1 && jumpHistory(historyIndex + 1)}
        selection={selection}
        onClearSelection={() => setSelection(null)}
        onApplyCrop={applyCropSelection}
        onToggleInspectorMobile={() => setMobileInspectorOpen((v) => !v)}
      />

      {/* Main Photoshop Studio Workspace */}
      <main className="flex-1 flex min-h-0 overflow-hidden relative">
        <LeftToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          foregroundColor={foregroundColor}
          backgroundColor={backgroundColor}
          onChangeForeground={setForegroundColor}
          onChangeBackground={setBackgroundColor}
          onSwapColors={() => {
            setForegroundColor(backgroundColor);
            setBackgroundColor(foregroundColor);
          }}
          onResetColors={() => {
            setForegroundColor('#000000');
            setBackgroundColor('#ffffff');
          }}
          shortcuts={shortcuts}
        />

        <StudioCanvas
          width={projectMeta.width}
          height={projectMeta.height}
          layers={layers}
          activeLayerId={activeLayerId}
          renderVersion={renderVersion}
          activeTool={activeTool}
          activeBrush={activeBrush}
          foregroundColor={foregroundColor}
          backgroundColor={backgroundColor}
          pressureCurve={pressureCurve}
          stylusOnly={stylusOnly}
          zoom={zoom}
          pan={pan}
          onChangeZoom={setZoom}
          onChangePan={setPan}
          selection={selection}
          onChangeSelection={setSelection}
          shapeType={shapeType}
          shapeStrokeWidth={shapeStrokeWidth}
          textSize={textSize}
          textFont={textFont}
          peers={collab.peers}
          comments={collab.comments}
          onStrokeComplete={handleStrokeComplete}
          onMoveLayer={handleMoveLayer}
          onPickColor={(hex) => {
            setForegroundColor(hex);
            showToast(`Warna diambil: ${hex.toUpperCase()}`);
          }}
          onAddTextAt={handleAddTextAt}
          onAddShapeRect={handleAddShapeRect}
          onAddCommentPin={(x, y, text, urgent) => {
            collab.addComment(text, x, y, urgent);
            showToast(urgent ? 'Pin komentar mendesak & notifikasi push dikirim.' : 'Pin komentar ditambahkan.');
          }}
          onPointerMoveCollab={collab.sendCursor}
          onStylusTelemetry={setStylusTelemetry}
          onDisplayCanvasRef={(c) => {
            displayCanvasRef.current = c;
          }}
        />

        <RightInspector
          mobileOpen={mobileInspectorOpen}
          onCloseMobile={() => setMobileInspectorOpen(false)}
          layers={layers}
          activeLayerId={activeLayerId}
          onSelectLayer={setActiveLayerId}
          onAddRasterLayer={() => addRasterLayer()}
          onAddAdjustmentLayer={addAdjustmentLayer}
          onDuplicateLayer={duplicateActiveLayer}
          onDeleteLayer={deleteLayer}
          onMoveLayerOrder={moveLayerOrder}
          onUpdateLayer={updateLayer}
          onUpdateAdjustment={updateAdjustment}
          onUpdateEffects={updateEffects}
          onToggleLayerMask={toggleLayerMask}
          onMergeDown={mergeDown}
          brushes={allBrushes}
          activeBrush={activeBrush}
          onSelectBrush={(b) => {
            setActiveBrush(b);
            if (activeTool !== 'brush' && activeTool !== 'eraser') setActiveTool('brush');
          }}
          onUpdateBrush={(patch) => setActiveBrush((b) => ({ ...b, ...patch }))}
          onSaveCustomBrush={handleSaveCustomBrush}
          pressureCurve={pressureCurve}
          onChangePressureCurve={(v) => {
            setPressureCurve(v);
            localStorage.setItem('cs_pressure_curve', String(v));
          }}
          historyLabels={history.map((h) => h.label)}
          historyIndex={historyIndex}
          onJumpHistory={jumpHistory}
          backups={backups}
          onCreateBackupNow={() => {
            createBackupSnapshot('Cadangan Manual').then(() => showToast('Snapshot cadangan dibuat.'));
          }}
          onRestoreBackup={handleRestoreBackup}
        />
      </main>

      {/* Studio Modals */}
      <RawDevelopModal
        open={rawModalOpen}
        initialImageUrl={rawInitialUrl}
        onClose={() => setRawModalOpen(false)}
        onApplyToCanvas={handleApplyRawCanvas}
      />

      <ExportModal
        open={exportModalOpen}
        projectTitle={projectMeta.title}
        width={projectMeta.width}
        height={projectMeta.height}
        dpi={projectMeta.dpi}
        layers={layers}
        onClose={() => setExportModalOpen(false)}
        onExportCompleted={(fmt) => {
          setSessionStats((s) => ({ ...s, exportsCount: s.exportsCount + 1 }));
          showToast(`Ekspor ${fmt} berhasil diunduh.`);
        }}
      />

      <PluginManagerModal
        open={pluginsModalOpen}
        plugins={plugins}
        onClose={() => setPluginsModalOpen(false)}
        onTogglePlugin={(id, enabled) => {
          setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)));
        }}
        onRunPlugin={handleRunPlugin}
        onInstallCustomPlugin={(plug) => {
          const item: StudioPlugin = { ...plug, id: `plug_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
          setPlugins((prev) => [...prev, item]);
          if (user && isOnline) savePluginCloud(user.uid, item).catch(() => {});
        }}
      />

      <AssetManagerModal
        open={assetsModalOpen}
        assets={allAssets}
        onClose={() => setAssetsModalOpen(false)}
        onInsertAssetToCanvas={async (asset) => {
          try {
            const img = await loadImageFromUrl(asset.previewUrl);
            const c = createOffscreenCanvas(projectMeta.width, projectMeta.height);
            const scale = Math.min(projectMeta.width / img.naturalWidth, projectMeta.height / img.naturalHeight, 1);
            const dw = img.naturalWidth * scale;
            const dh = img.naturalHeight * scale;
            c.getContext('2d')?.drawImage(img, (projectMeta.width - dw) / 2, (projectMeta.height - dh) / 2, dw, dh);
            addRasterLayer(asset.name, c);
            showToast(`Aset "${asset.name}" ditambahkan ke kanvas.`);
          } catch {
            showToast('Gagal memuat aset gambar.');
          }
        }}
        onOpenAssetInRaw={(asset) => {
          setRawInitialUrl(asset.previewUrl);
          setRawModalOpen(true);
        }}
        onAddUserAsset={(asset) => {
          setUserAssets((prev) => [asset, ...prev]);
          if (user && isOnline) saveAssetCloud(user.uid, asset).catch(() => {});
          showToast(`Aset "${asset.name}" disimpan ke pustaka.`);
        }}
        onDeleteUserAsset={(id) => {
          setUserAssets((prev) => prev.filter((a) => a.id !== id));
          if (user && isOnline) deleteAssetCloud(id).catch(() => {});
        }}
      />

      <CollabModal
        open={collabModalOpen}
        roomCode={projectMeta.roomCode}
        connected={collab.connected}
        peers={collab.peers}
        userName={user?.displayName || 'Desainer Studio'}
        comments={collab.comments}
        notificationPermission={notifPermission}
        onRequestNotificationPermission={requestNotificationPermission}
        onChangeRoomCode={(code) => {
          setProjectMeta((m) => ({ ...m, roomCode: code }));
          showToast(`Bergabung ke ruang kolaborasi ${code}.`);
        }}
        onResolveComment={collab.toggleResolveComment}
        onSendUrgentAlert={(title, body) => {
          collab.broadcastUrgentAlert(title, body);
          triggerNativePush({
            id: `local_push_${Date.now()}`,
            title,
            body,
            roomCode: projectMeta.roomCode,
            createdAt: Date.now(),
            urgent: true,
            read: false,
          });
          showToast('Notifikasi push mendesak dikirim ke tim.');
        }}
        onClose={() => setCollabModalOpen(false)}
      />

      <AnalyticsModal
        open={analyticsModalOpen}
        currentSession={sessionStats}
        historicalSessions={historicalSessions}
        toolUsageSeconds={toolUsageSeconds}
        onClose={() => setAnalyticsModalOpen(false)}
      />

      <ShortcutsModal
        open={shortcutsModalOpen}
        shortcuts={shortcuts}
        onUpdateShortcuts={handleUpdateShortcuts}
        onClose={() => setShortcutsModalOpen(false)}
      />

      <CloudProjectsModal
        open={projectsModalOpen}
        currentProjectId={projectMeta.id}
        projects={mergedProjects}
        isSignedIn={Boolean(user)}
        onSignIn={() => signInWithGoogle().catch(() => {})}
        onCreateProject={handleCreateProject}
        onOpenProject={handleOpenProject}
        onDeleteProject={async (id) => {
          await deleteLocalProject(id).catch(() => {});
          setLocalProjects((prev) => prev.filter((p) => p.id !== id));
          if (user && isOnline) deleteProjectCloud(id).catch(() => {});
          showToast('Proyek dihapus.');
        }}
        onClose={() => setProjectsModalOpen(false)}
      />

      <NotificationsDrawer
        open={notifDrawerOpen}
        notifications={notifications}
        permission={notifPermission}
        onRequestPermission={requestNotificationPermission}
        onMarkAllRead={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
        onClose={() => setNotifDrawerOpen(false)}
      />

      {/* Offline Mode Indicator Banner */}
      {!isOnline && (
        <div className="fixed bottom-4 left-16 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Mode Offline — Perubahan disimpan lokal & otomatis sinkron saat online.</span>
        </div>
      )}

      {/* Subtle Action Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-lg bg-zinc-900 dark:bg-zinc-800 border border-zinc-700 px-3.5 py-2 text-xs text-zinc-100 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
