import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  Cloud,
  CloudOff,
  Download,
  FolderKanban,
  Keyboard,
  LogIn,
  LogOut,
  Moon,
  Puzzle,
  SlidersHorizontal,
  Sun,
  Users,
  Images,
  Menu,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface MenuEntry {
  label: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
}

interface PhotoshopMenuBarProps {
  projectTitle: string;
  onRenameProject: (title: string) => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isOnline: boolean;
  syncState: 'idle' | 'saving' | 'saved' | 'offline';
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  unreadNotifications: number;
  collabPeersCount: number;
  collabConnected: boolean;
  canUndo: boolean;
  canRedo: boolean;
  // Menu actions
  onNewProject: () => void;
  onOpenCloudProjects: () => void;
  onImportImage: () => void;
  onImportPsd: () => void;
  onOpenRawDevelop: () => void;
  onSaveNow: () => void;
  onCreateBackup: () => void;
  onOpenExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearLayer: () => void;
  onOpenShortcuts: () => void;
  onFlipCanvasH: () => void;
  onFlipCanvasV: () => void;
  onRotate90: () => void;
  onNewRasterLayer: () => void;
  onDuplicateLayer: () => void;
  onAddAdjustmentLayer: (type: 'brightness-contrast' | 'hue-saturation' | 'exposure' | 'levels' | 'black-white' | 'color-balance') => void;
  onMergeDown: () => void;
  onFlattenImage: () => void;
  onToggleLayerMask: () => void;
  onSelectAll: () => void;
  onDeselect: () => void;
  onOpenPlugins: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onZoom100: () => void;
  onOpenAssets: () => void;
  onOpenCollab: () => void;
  onOpenAnalytics: () => void;
  onOpenNotifications: () => void;
  onToggleMobileInspector: () => void;
}

export const PhotoshopMenuBar: React.FC<PhotoshopMenuBarProps> = (props) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(props.projectTitle);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  useEffect(() => {
    setDraftTitle(props.projectTitle);
  }, [props.projectTitle]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, []);

  const menus: Record<string, MenuEntry[]> = {
    File: [
      { label: 'Proyek Baru / Kanvas...', action: props.onNewProject },
      { label: 'Proyek Cloud & Perangkat...', action: props.onOpenCloudProjects },
      { divider: true, label: '' },
      { label: 'Impor Gambar (PNG / JPG / WebP)...', action: props.onImportImage },
      { label: 'Buka File RAW (DNG / CR2 / NEF / ARW)...', action: props.onOpenRawDevelop },
      { label: 'Impor File Photoshop (.PSD)...', action: props.onImportPsd },
      { divider: true, label: '' },
      { label: 'Simpan & Sinkron Cloud', shortcut: 'Ctrl+S', action: props.onSaveNow },
      { label: 'Buat Cadangan Snapshot Sekarang', action: props.onCreateBackup },
      { label: 'Ekspor PSD / PDF Cetak / Format Lain...', shortcut: 'Ctrl+E', action: props.onOpenExport },
    ],
    Edit: [
      { label: 'Urungkan (Undo)', shortcut: 'Ctrl+Z', action: props.onUndo, disabled: !props.canUndo },
      { label: 'Ulangi (Redo)', shortcut: 'Ctrl+Shift+Z', action: props.onRedo, disabled: !props.canRedo },
      { divider: true, label: '' },
      { label: 'Bersihkan Layer Aktif', action: props.onClearLayer },
      { divider: true, label: '' },
      { label: 'Pintasan Keyboard Kustom...', action: props.onOpenShortcuts },
    ],
    Image: [
      { label: 'Camera RAW Develop Studio...', action: props.onOpenRawDevelop },
      { divider: true, label: '' },
      { label: 'Balik Kanvas Horizontal', action: props.onFlipCanvasH },
      { label: 'Balik Kanvas Vertikal', action: props.onFlipCanvasV },
      { label: 'Putar 90° Searah Jarum Jam', action: props.onRotate90 },
    ],
    Layer: [
      { label: 'Layer Raster Baru', shortcut: 'Ctrl+Shift+N', action: props.onNewRasterLayer },
      { label: 'Duplikasi Layer', shortcut: 'Ctrl+J', action: props.onDuplicateLayer },
      { label: 'Toggle Layer Mask (Alpha)', action: props.onToggleLayerMask },
      { divider: true, label: '' },
      { label: 'Adjustment: Brightness / Contrast', action: () => props.onAddAdjustmentLayer('brightness-contrast') },
      { label: 'Adjustment: Hue / Saturation', action: () => props.onAddAdjustmentLayer('hue-saturation') },
      { label: 'Adjustment: Exposure', action: () => props.onAddAdjustmentLayer('exposure') },
      { label: 'Adjustment: Levels', action: () => props.onAddAdjustmentLayer('levels') },
      { label: 'Adjustment: Color Balance', action: () => props.onAddAdjustmentLayer('color-balance') },
      { label: 'Adjustment: Black & White', action: () => props.onAddAdjustmentLayer('black-white') },
      { divider: true, label: '' },
      { label: 'Gabungkan ke Bawah (Merge Down)', action: props.onMergeDown },
      { label: 'Ratakan Semua Layer (Flatten)', action: props.onFlattenImage },
    ],
    Select: [
      { label: 'Pilih Semua (Select All)', shortcut: 'Ctrl+A', action: props.onSelectAll },
      { label: 'Batalkan Seleksi (Deselect)', shortcut: 'Ctrl+D', action: props.onDeselect },
    ],
    Filter: [
      { label: 'Manajer Plugin & Filter Pihak Ketiga...', action: props.onOpenPlugins },
      { label: 'Camera RAW Filter...', action: props.onOpenRawDevelop },
    ],
    View: [
      { label: 'Perbesar (Zoom In)', shortcut: '+', action: props.onZoomIn },
      { label: 'Perkecil (Zoom Out)', shortcut: '-', action: props.onZoomOut },
      { label: 'Sesuaikan Layar (Fit)', shortcut: 'Ctrl+0', action: props.onZoomFit },
      { label: 'Ukuran Asli 100%', shortcut: 'Ctrl+1', action: props.onZoom100 },
      { divider: true, label: '' },
      { label: props.theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap', action: props.onToggleTheme },
    ],
    Window: [
      { label: 'Pustaka Aset & Tekstur', action: props.onOpenAssets },
      { label: 'Kolaborasi Real-Time & Pin', action: props.onOpenCollab },
      { label: 'Dasbor Analitik Produktivitas', action: props.onOpenAnalytics },
      { label: 'Pintasan Keyboard', action: props.onOpenShortcuts },
      { label: 'Panel Layer & Brush (Mobile)', action: props.onToggleMobileInspector },
    ],
    Plugins: [
      { label: 'Kelola & Instal Plugin Pihak Ketiga...', action: props.onOpenPlugins },
    ],
  };

  const commitTitle = () => {
    setEditingTitle(false);
    const cleaned = draftTitle.trim();
    if (cleaned && cleaned !== props.projectTitle) {
      props.onRenameProject(cleaned);
    } else {
      setDraftTitle(props.projectTitle);
    }
  };

  return (
    <>
      <header
        ref={menuRef}
        className="h-11 shrink-0 flex items-center justify-between gap-2 px-2.5 sm:px-3 bg-zinc-100 dark:bg-[#18181c] border-b border-zinc-300 dark:border-[#2a2a32] select-none z-40"
      >
        {/* Left: Brand + Photoshop Classic Menus */}
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Menu Studio"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2 pr-2 shrink-0">
            <div className="w-6 h-6 rounded-md bg-[#1d2b4a] border border-blue-500/80 flex items-center justify-center text-[11px] font-bold text-blue-300 tracking-tight font-display">
              Ps
            </div>
            <span className="hidden sm:inline text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-display whitespace-nowrap">
              ChromaStudio
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Menu Photoshop">
            {Object.keys(menus).map((name) => (
              <div key={name} className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === name ? null : name)}
                  onMouseEnter={() => {
                    if (openMenu && openMenu !== name) setOpenMenu(name);
                  }}
                  className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                    openMenu === name
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {name}
                </button>
                {openMenu === name && (
                  <div className="absolute left-0 top-full mt-1 w-64 rounded-lg bg-white dark:bg-[#202026] border border-zinc-300 dark:border-[#32323d] shadow-2xl py-1.5 z-50">
                    {menus[name].map((entry, idx) =>
                      entry.divider ? (
                        <div key={idx} className="my-1 border-t border-zinc-200 dark:border-[#30303a]" />
                      ) : (
                        <button
                          key={entry.label}
                          disabled={entry.disabled}
                          onClick={() => {
                            setOpenMenu(null);
                            entry.action?.();
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-3 text-zinc-800 dark:text-zinc-200 hover:bg-blue-600 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                          <span className="truncate">{entry.label}</span>
                          {entry.shortcut && (
                            <span className="text-[10px] font-mono opacity-65 shrink-0">{entry.shortcut}</span>
                          )}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Editable Project Title + Sync State */}
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-zinc-300 dark:border-[#2c2c34] min-w-0">
            {editingTitle ? (
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitle();
                  if (e.key === 'Escape') {
                    setDraftTitle(props.projectTitle);
                    setEditingTitle(false);
                  }
                }}
                autoFocus
                className="w-36 sm:w-48 px-1.5 py-0.5 text-xs rounded bg-white dark:bg-zinc-900 border border-blue-500 text-zinc-900 dark:text-white outline-none"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                title="Klik untuk ganti nama proyek"
                className="text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:text-blue-500 truncate max-w-[120px] sm:max-w-[180px]"
              >
                {props.projectTitle}
              </button>
            )}
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              {!props.isOnline ? (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                  <span>Offline</span>
                </>
              ) : props.syncState === 'saving' ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-blue-400" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Tersimpan</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Right: Studio Quick Modules, PWA Install, Account */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={props.onOpenRawDevelop}
            title="Camera RAW Develop Studio"
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>RAW</span>
          </button>

          <button
            onClick={props.onOpenAssets}
            title="Manajemen Aset"
            className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            <Images className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Aset</span>
          </button>

          <button
            onClick={props.onOpenPlugins}
            title="Plugin Pihak Ketiga"
            className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            <Puzzle className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Plugin</span>
          </button>

          <button
            onClick={props.onOpenAnalytics}
            title="Dasbor Analitik Produktivitas"
            className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={props.onOpenCollab}
            title="Kolaborasi Real-Time"
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-mono-nums text-[11px]">{props.collabPeersCount}</span>
          </button>

          <button
            onClick={props.onOpenNotifications}
            title="Notifikasi Proyek Mendesak"
            className="relative p-1.5 rounded-md text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Notifikasi"
          >
            <Bell className="w-4 h-4" />
            {props.unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-600 text-[9px] font-bold text-white flex items-center justify-center font-mono-nums">
                {props.unreadNotifications}
              </span>
            )}
          </button>

          <button
            onClick={props.onToggleTheme}
            title={props.theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            className="p-1.5 rounded-md text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Ubah Tema"
          >
            {props.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* PWA Install Button (Android / Desktop / iOS) */}
          {!isInstalled && isInstallable && (
            <button
              onClick={install}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instal App</span>
            </button>
          )}
          {!isInstalled && !isInstallable && isIOS && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-400 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 whitespace-nowrap"
            >
              Instal iOS
            </button>
          )}

          {/* Primary Export CTA */}
          <button
            onClick={props.onOpenExport}
            className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            Ekspor
          </button>

          {/* Cloud Auth */}
          {props.user ? (
            <button
              onClick={props.onSignOut}
              title={`Masuk sebagai ${props.user.displayName || props.user.email} — Klik untuk keluar`}
              className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 transition-colors"
            >
              {props.user.photoURL ? (
                <img
                  src={props.user.photoURL}
                  alt={props.user.displayName || 'Akun'}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {(props.user.displayName || 'U')[0].toUpperCase()}
                </span>
              )}
              <LogOut className="w-3.5 h-3.5 hidden sm:inline opacity-70" />
            </button>
          ) : (
            <button
              onClick={props.onSignIn}
              title="Masuk dengan Google untuk Sinkronisasi Awan & Pencadangan"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-100 transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sinkron Cloud</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Drawer Menu (Android / Tablet) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-[#1a1a1f] border-r border-zinc-300 dark:border-[#2c2c34] p-4 overflow-y-auto studio-scroll flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <span className="text-sm font-bold font-display text-zinc-900 dark:text-white">Menu ChromaStudio</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {[
              { label: 'Proyek Cloud & Kanvas Baru', icon: FolderKanban, fn: props.onOpenCloudProjects },
              { label: 'Buka RAW Develop Studio', icon: SlidersHorizontal, fn: props.onOpenRawDevelop },
              { label: 'Impor Gambar (PNG/JPG)', icon: Images, fn: props.onImportImage },
              { label: 'Impor File Photoshop (.PSD)', icon: FolderKanban, fn: props.onImportPsd },
              { label: 'Pustaka Aset & Tekstur', icon: Images, fn: props.onOpenAssets },
              { label: 'Plugin Pihak Ketiga', icon: Puzzle, fn: props.onOpenPlugins },
              { label: 'Kolaborasi Real-Time', icon: Users, fn: props.onOpenCollab },
              { label: 'Dasbor Analitik Produktivitas', icon: BarChart3, fn: props.onOpenAnalytics },
              { label: 'Pintasan Keyboard', icon: Keyboard, fn: props.onOpenShortcuts },
              { label: 'Simpan & Cadangkan Sekarang', icon: Cloud, fn: props.onCreateBackup },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setMobileMenuOpen(false);
                  item.fn();
                }}
                className="min-h-[44px] px-3 rounded-lg flex items-center gap-3 text-left text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <item.icon className="w-4 h-4 text-blue-500 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}

            {!isInstalled && isInstallable && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  install();
                }}
                className="mt-2 min-h-[44px] px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Instal ke Layar Utama Android</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* iOS Safari Install Guide */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#1e1e24] border border-zinc-300 dark:border-zinc-700 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white font-display">
              Instal ChromaStudio di iPhone / iPad
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              1. Ketuk tombol <strong>Bagikan (Share)</strong> pada bilah Safari.<br />
              2. Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama</strong>.
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
