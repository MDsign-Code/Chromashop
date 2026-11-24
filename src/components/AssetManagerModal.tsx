import React, { useRef, useState } from 'react';
import { Images, Plus, Search, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react';
import { createOffscreenCanvas, generateThumbnail, loadImageFromUrl } from '../lib/canvasEngine';
import type { AssetLibraryItem } from '../types/studio';

interface AssetManagerModalProps {
  open: boolean;
  assets: AssetLibraryItem[];
  onClose: () => void;
  onInsertAssetToCanvas: (asset: AssetLibraryItem) => void;
  onOpenAssetInRaw: (asset: AssetLibraryItem) => void;
  onAddUserAsset: (asset: AssetLibraryItem) => void;
  onDeleteUserAsset: (id: string) => void;
}

const CATEGORIES = ['Semua', 'Photo', 'RAW', 'Texture', 'Overlay', 'Template'] as const;

export const AssetManagerModal: React.FC<AssetManagerModalProps> = ({
  open,
  assets,
  onClose,
  onInsertAssetToCanvas,
  onOpenAssetInRaw,
  onAddUserAsset,
  onDeleteUserAsset,
}) => {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Semua');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const filtered = assets.filter((item) => {
    const matchCat = category === 'Semua' || item.category === category;
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.format.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImageFromUrl(url);
      const c = createOffscreenCanvas(img.naturalWidth, img.naturalHeight);
      c.getContext('2d')?.drawImage(img, 0, 0);
      const previewUrl = generateThumbnail(c, 512, 512);
      URL.revokeObjectURL(url);

      const ext = (file.name.split('.').pop() || 'PNG').toUpperCase();
      const newAsset: AssetLibraryItem = {
        id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        category: ['DNG', 'CR2', 'NEF', 'ARW'].includes(ext) ? 'RAW' : 'Photo',
        format: ext.slice(0, 12),
        width: img.naturalWidth,
        height: img.naturalHeight,
        fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
        tags: ['unggahan', ext.toLowerCase()],
        previewUrl,
        createdAtMs: Date.now(),
      };
      onAddUserAsset(newAsset);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div className="w-full max-w-4xl max-h-[88vh] rounded-xl bg-white dark:bg-[#19191f] border border-zinc-300 dark:border-[#2c2c35] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#2a2a32] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Images className="w-4 h-4 text-blue-500" />
            <h2 className="text-base font-bold font-display text-zinc-900 dark:text-white">
              Sistem Manajemen Aset Studio
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUploadAsset} className="hidden" />
            <button
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Mengunggah...' : 'Tambah Aset'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-5 py-3 border-b border-zinc-200 dark:border-[#2a2a32] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  category === c
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, format, atau tag..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#121216] border border-zinc-300 dark:border-zinc-700 text-xs outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Asset Grid */}
        <div className="flex-1 overflow-y-auto studio-scroll p-5">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              Tidak ada aset yang cocok dengan filter pencarian.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-xl overflow-hidden border border-zinc-200 dark:border-[#2d2d36] bg-zinc-50 dark:bg-[#202027] flex flex-col"
                >
                  <div className="aspect-[4/3] bg-zinc-900 overflow-hidden relative">
                    <img
                      src={asset.previewUrl}
                      alt={asset.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{asset.name}</h3>
                      <div className="mt-1 text-[11px] text-zinc-500 font-mono-nums">
                        {asset.category} · {asset.format} · {asset.width}×{asset.height}
                      </div>
                      {asset.tags.length > 0 && (
                        <div className="mt-1 text-[11px] text-zinc-400 truncate">
                          {asset.tags.join(' · ')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <button
                        onClick={() => {
                          onInsertAssetToCanvas(asset);
                          onClose();
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-[11px] font-medium text-white flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ke Kanvas</span>
                      </button>
                      <button
                        onClick={() => {
                          onClose();
                          onOpenAssetInRaw(asset);
                        }}
                        title="Olahan Camera RAW"
                        className="py-1.5 px-2.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>RAW</span>
                      </button>
                      {!asset.isBuiltIn && (
                        <button
                          onClick={() => onDeleteUserAsset(asset.id)}
                          title="Hapus Aset"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/15"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
