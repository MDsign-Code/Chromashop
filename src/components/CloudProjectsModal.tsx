import React, { useState } from 'react';
import { Cloud, FolderOpen, HardDrive, Plus, Trash2, X } from 'lucide-react';
import { CANVAS_PRESETS } from '../data/defaults';
import type { ColorProfile, ProjectMeta } from '../types/studio';

interface CloudProjectsModalProps {
  open: boolean;
  currentProjectId: string;
  projects: ProjectMeta[];
  isSignedIn: boolean;
  onSignIn: () => void;
  onCreateProject: (opts: { title: string; width: number; height: number; dpi: number; colorProfile: ColorProfile }) => void;
  onOpenProject: (project: ProjectMeta) => void;
  onDeleteProject: (projectId: string) => void;
  onClose: () => void;
}

export const CloudProjectsModal: React.FC<CloudProjectsModalProps> = ({
  open,
  currentProjectId,
  projects,
  isSignedIn,
  onSignIn,
  onCreateProject,
  onOpenProject,
  onDeleteProject,
  onClose,
}) => {
  const [tab, setTab] = useState<'list' | 'new'>('list');
  const [title, setTitle] = useState('Proyek Desain Baru');
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [dpi, setDpi] = useState(300);
  const [colorProfile, setColorProfile] = useState<ColorProfile>('sRGB');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div className="w-full max-w-3xl max-h-[88vh] rounded-xl bg-white dark:bg-[#19191f] border border-zinc-300 dark:border-[#2c2c35] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#2a2a32] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-500" />
            <h2 className="text-base font-bold font-display text-zinc-900 dark:text-white">
              Proyek Cloud & Penyimpanan Offline
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-zinc-200 dark:bg-zinc-800 p-0.5 text-xs">
              <button
                onClick={() => setTab('list')}
                className={`px-3 py-1 rounded-md font-medium ${
                  tab === 'list' ? 'bg-white dark:bg-[#141418] text-zinc-900 dark:text-white' : 'text-zinc-500'
                }`}
              >
                Daftar Proyek ({projects.length})
              </button>
              <button
                onClick={() => setTab('new')}
                className={`px-3 py-1 rounded-md font-medium ${
                  tab === 'new' ? 'bg-white dark:bg-[#141418] text-zinc-900 dark:text-white' : 'text-zinc-500'
                }`}
              >
                Kanvas Baru
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-5">
          {tab === 'new' ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Preset Cepat (Digital & Percetakan)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CANVAS_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => {
                        setWidth(p.width);
                        setHeight(p.height);
                        setDpi(p.dpi);
                        setColorProfile(p.colorProfile);
                      }}
                      className="p-3 rounded-lg border border-zinc-200 dark:border-[#2e2e37] hover:border-blue-500 text-left bg-zinc-50 dark:bg-[#202027]"
                    >
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white">{p.name}</div>
                      <div className="text-[11px] font-mono-nums text-zinc-500 mt-0.5">
                        {p.width} × {p.height} px · {p.dpi} DPI · {p.colorProfile}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs">
                <label className="sm:col-span-2 space-y-1">
                  <span className="text-zinc-500">Judul Proyek</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#131318] border border-zinc-300 dark:border-zinc-700"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-zinc-500">Lebar (px)</span>
                  <input
                    type="number"
                    min={64}
                    max={4096}
                    value={width}
                    onChange={(e) => setWidth(Math.min(4096, Math.max(64, Number(e.target.value))))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#131318] border border-zinc-300 dark:border-zinc-700 font-mono-nums"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-zinc-500">Tinggi (px)</span>
                  <input
                    type="number"
                    min={64}
                    max={4096}
                    value={height}
                    onChange={(e) => setHeight(Math.min(4096, Math.max(64, Number(e.target.value))))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#131318] border border-zinc-300 dark:border-zinc-700 font-mono-nums"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-zinc-500">Resolusi Cetak (DPI)</span>
                  <input
                    type="number"
                    min={72}
                    max={600}
                    value={dpi}
                    onChange={(e) => setDpi(Math.min(600, Math.max(72, Number(e.target.value))))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#131318] border border-zinc-300 dark:border-zinc-700 font-mono-nums"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-zinc-500">Profil Warna</span>
                  <select
                    value={colorProfile}
                    onChange={(e) => setColorProfile(e.target.value as ColorProfile)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#131318] border border-zinc-300 dark:border-zinc-700"
                  >
                    <option value="sRGB">sRGB IEC61966-2.1</option>
                    <option value="DisplayP3">Display P3 Wide Gamut</option>
                    <option value="AdobeRGB">Adobe RGB (1998)</option>
                    <option value="CMYK-Fogra39">CMYK Fogra39 (Cetak)</option>
                  </select>
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    onCreateProject({ title: title.trim() || 'Kanvas Baru', width, height, dpi, colorProfile });
                    onClose();
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Kanvas Baru</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!isSignedIn && (
                <div className="p-3.5 rounded-xl bg-blue-600/10 border border-blue-500/30 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-zinc-800 dark:text-zinc-200">
                    Masuk dengan akun Google untuk menyinkronkan proyek, brush kustom, dan cadangan otomatis di semua perangkat Android & Desktop.
                  </div>
                  <button
                    onClick={onSignIn}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shrink-0"
                  >
                    Masuk Google Cloud
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projects.map((proj) => {
                  const isCurrent = proj.id === currentProjectId;
                  return (
                    <div
                      key={proj.id}
                      className={`p-3 rounded-xl border flex gap-3 ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-600/10'
                          : 'border-zinc-200 dark:border-[#2e2e37] bg-zinc-50 dark:bg-[#202027]'
                      }`}
                    >
                      <div className="w-20 h-16 rounded-lg overflow-hidden checkerboard-bg border border-zinc-700 shrink-0">
                        {proj.thumbnailUrl && (
                          <img src={proj.thumbnailUrl} alt={proj.title} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{proj.title}</div>
                          <div className="text-[10px] font-mono-nums text-zinc-500 mt-0.5">
                            {proj.width}×{proj.height} · {proj.layerCount} layer · {proj.dpi} DPI
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                            {proj.syncedToCloud ? (
                              <>
                                <Cloud className="w-3 h-3 text-emerald-500" />
                                Cloud
                              </>
                            ) : (
                              <>
                                <HardDrive className="w-3 h-3 text-amber-500" />
                                Lokal
                              </>
                            )}
                          </span>
                          <div className="flex items-center gap-1">
                            {!isCurrent && (
                              <button
                                onClick={() => {
                                  onOpenProject(proj);
                                  onClose();
                                }}
                                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-medium text-white flex items-center gap-1"
                              >
                                <FolderOpen className="w-3 h-3" />
                                Buka
                              </button>
                            )}
                            {!isCurrent && (
                              <button
                                onClick={() => onDeleteProject(proj.id)}
                                className="p-1 rounded text-red-500 hover:bg-red-500/15"
                                title="Hapus Proyek"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
