import React, { useState } from 'react';
import { Code2, Play, Plus, Puzzle, X } from 'lucide-react';
import type { StudioPlugin } from '../types/studio';

interface PluginManagerModalProps {
  open: boolean;
  plugins: StudioPlugin[];
  onClose: () => void;
  onTogglePlugin: (id: string, enabled: boolean) => void;
  onRunPlugin: (plugin: StudioPlugin, intensity: number) => { ok: boolean; error?: string };
  onInstallCustomPlugin: (plugin: Omit<StudioPlugin, 'id'>) => void;
}

const SAMPLE_CUSTOM_CODE = `// Variabel tersedia: data (Uint8ClampedArray RGBA), width, height, intensity (0..1)
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] === 0) continue;
  const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  // Warm Sepia Film Tint
  data[i] = Math.min(255, data[i] + (lum * 1.07 - data[i]) * intensity);
  data[i + 1] = Math.min(255, data[i + 1] + (lum * 0.92 - data[i + 1]) * intensity);
  data[i + 2] = Math.min(255, data[i + 2] + (lum * 0.74 - data[i + 2]) * intensity);
}`;

export const PluginManagerModal: React.FC<PluginManagerModalProps> = ({
  open,
  plugins,
  onClose,
  onTogglePlugin,
  onRunPlugin,
  onInstallCustomPlugin,
}) => {
  const [intensities, setIntensities] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('Studio Dev');
  const [description, setDescription] = useState('Efek warna film sepia hangat kustom.');
  const [code, setCode] = useState(SAMPLE_CUSTOM_CODE);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!open) return null;

  const handleRun = (plugin: StudioPlugin) => {
    const val = intensities[plugin.id] ?? plugin.intensity ?? 55;
    const res = onRunPlugin(plugin, val);
    if (res.ok) {
      setFeedback(`Plugin "${plugin.name}" berhasil diterapkan pada layer raster aktif.`);
    } else {
      setFeedback(`Gagal: ${res.error}`);
    }
  };

  const handleInstall = () => {
    if (!name.trim() || !code.trim()) return;
    onInstallCustomPlugin({
      name: name.trim(),
      version: '1.0.0',
      author: author.trim() || 'Pengguna',
      description: description.trim() || 'Plugin filter piksel pihak ketiga',
      enabled: true,
      intensity: 65,
      code,
    });
    setName('');
    setCreating(false);
    setFeedback('Plugin kustom berhasil diinstal dan disinkronkan.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div className="w-full max-w-3xl max-h-[88vh] rounded-xl bg-white dark:bg-[#19191f] border border-zinc-300 dark:border-[#2c2c35] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#2a2a32] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-blue-500" />
            <h2 className="text-base font-bold font-display text-zinc-900 dark:text-white">
              Manajer Plugin Pihak Ketiga & SDK Filter
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreating((v) => !v)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white flex items-center gap-1.5"
            >
              {creating ? <Puzzle className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{creating ? 'Daftar Plugin' : 'Instal / Buat Plugin'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {feedback && (
          <div className="px-5 py-2 bg-blue-600/15 border-b border-blue-500/30 text-xs text-blue-600 dark:text-blue-300 flex items-center justify-between">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)} className="text-[11px] underline">
              Tutup
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto studio-scroll p-5">
          {creating ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                <Code2 className="w-4 h-4 text-blue-500" />
                <span>Instal Plugin Filter Piksel JavaScript (Sandbox API)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1 text-xs">
                  <span className="text-zinc-500">Nama Plugin</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Sepia Analog Pro"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#121216] border border-zinc-300 dark:border-zinc-700"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-zinc-500">Pengembang / Vendor</span>
                  <input
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#121216] border border-zinc-300 dark:border-zinc-700"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-xs">
                <span className="text-zinc-500">Deskripsi Singkat</span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#121216] border border-zinc-300 dark:border-zinc-700"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-zinc-500">Skrip Shader ImageData</span>
                <textarea
                  rows={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 text-emerald-300 font-mono text-xs border border-zinc-700 outline-none"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setCreating(false)}
                  className="px-4 py-2 rounded-lg text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  onClick={handleInstall}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                >
                  Simpan & Instal Plugin
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {plugins.map((plugin) => {
                const intensity = intensities[plugin.id] ?? plugin.intensity ?? 55;
                return (
                  <div
                    key={plugin.id}
                    className="p-4 rounded-xl bg-zinc-50 dark:bg-[#202027] border border-zinc-200 dark:border-[#2e2e37] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{plugin.name}</h3>
                        <span className="text-[11px] font-mono-nums text-zinc-500">v{plugin.version}</span>
                        <span className="text-[11px] text-zinc-500">· {plugin.author}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{plugin.description}</p>
                      <div className="mt-2.5 flex items-center gap-3 max-w-xs">
                        <span className="text-[11px] text-zinc-500 whitespace-nowrap">Intensitas</span>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          value={intensity}
                          onChange={(e) =>
                            setIntensities((prev) => ({ ...prev, [plugin.id]: Number(e.target.value) }))
                          }
                          className="w-full studio-slider"
                        />
                        <span className="text-[11px] font-mono-nums w-8 text-right">{intensity}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer mr-1">
                        <input
                          type="checkbox"
                          checked={plugin.enabled}
                          onChange={(e) => onTogglePlugin(plugin.id, e.target.checked)}
                        />
                        <span>Aktif</span>
                      </label>
                      <button
                        disabled={!plugin.enabled}
                        onClick={() => handleRun(plugin)}
                        className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Terapkan</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
