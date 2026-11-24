import React, { useEffect, useState } from 'react';
import { Keyboard, RotateCcw, X } from 'lucide-react';
import { DEFAULT_SHORTCUT_MAP, SHORTCUT_DEFINITIONS } from '../data/defaults';
import type { ShortcutMap } from '../types/studio';

interface ShortcutsModalProps {
  open: boolean;
  shortcuts: ShortcutMap;
  onUpdateShortcuts: (next: ShortcutMap) => void;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  open,
  shortcuts,
  onUpdateShortcuts,
  onClose,
}) => {
  const [capturingAction, setCapturingAction] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !capturingAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
      if (e.key === 'Escape') {
        setCapturingAction(null);
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());
      const combo = parts.join('+');

      const existing = Object.entries(shortcuts).find(
        ([act, k]) => k === combo && act !== capturingAction
      );
      if (existing) {
        setConflictMsg(`Tombol "${combo.toUpperCase()}" sebelumnya dipakai oleh ${existing[0]}, telah dialihkan.`);
      } else {
        setConflictMsg(null);
      }

      const next = { ...shortcuts };
      if (existing) next[existing[0]] = '';
      next[capturingAction] = combo;
      onUpdateShortcuts(next);
      setCapturingAction(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, capturingAction, shortcuts, onUpdateShortcuts]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div className="w-full max-w-2xl max-h-[85vh] rounded-xl bg-white dark:bg-[#19191f] border border-zinc-300 dark:border-[#2c2c35] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#2a2a32] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-500" />
            <h2 className="text-base font-bold font-display text-zinc-900 dark:text-white">
              Pintasan Keyboard Kustom (Photoshop Mapping)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onUpdateShortcuts({ ...DEFAULT_SHORTCUT_MAP });
                setConflictMsg('Semua pintasan dikembalikan ke standar Photoshop.');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-medium flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {conflictMsg && (
          <div className="px-5 py-2 bg-amber-500/15 border-b border-amber-500/30 text-xs text-amber-600 dark:text-amber-300">
            {conflictMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto studio-scroll p-5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Klik tombol pintasan di sebelah kanan perintah, lalu tekan kombinasi tombol baru pada keyboard Anda.
          </p>
          <div className="divide-y divide-zinc-200 dark:divide-[#292932] border border-zinc-200 dark:border-[#2e2e37] rounded-xl overflow-hidden">
            {SHORTCUT_DEFINITIONS.map((def) => {
              const currentKey = shortcuts[def.action] ?? def.key;
              const isCapturing = capturingAction === def.action;
              return (
                <div
                  key={def.action}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-4 bg-white dark:bg-[#1d1d24] hover:bg-zinc-50 dark:hover:bg-[#23232b]"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{def.label}</div>
                    <div className="text-[10px] text-zinc-500">{def.category}</div>
                  </div>
                  <button
                    onClick={() => setCapturingAction(isCapturing ? null : def.action)}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs min-w-[110px] text-center transition-colors border ${
                      isCapturing
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-zinc-100 dark:bg-[#131318] text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:border-blue-500'
                    }`}
                  >
                    {isCapturing ? 'Tekan tombol...' : currentKey ? currentKey.toUpperCase() : 'Belum diatur'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
