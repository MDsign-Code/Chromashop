import React, { useState } from 'react';
import { BellRing, CheckCircle2, Copy, Send, Users, X } from 'lucide-react';
import type { CollabComment, CollabPeer } from '../types/studio';

interface CollabModalProps {
  open: boolean;
  roomCode: string;
  connected: boolean;
  peers: CollabPeer[];
  userName: string;
  comments: CollabComment[];
  notificationPermission: NotificationPermission | 'unsupported';
  onRequestNotificationPermission: () => void;
  onChangeRoomCode: (code: string) => void;
  onResolveComment: (id: string, resolved: boolean) => void;
  onSendUrgentAlert: (title: string, body: string) => void;
  onClose: () => void;
}

export const CollabModal: React.FC<CollabModalProps> = ({
  open,
  roomCode,
  connected,
  peers,
  userName,
  comments,
  notificationPermission,
  onRequestNotificationPermission,
  onChangeRoomCode,
  onResolveComment,
  onSendUrgentAlert,
  onClose,
}) => {
  const [joinInput, setJoinInput] = useState(roomCode);
  const [alertTitle, setAlertTitle] = useState('Revisi Mendesak Sebelum Cetak');
  const [alertBody, setAlertBody] = useState('');
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div className="w-full max-w-2xl max-h-[88vh] rounded-xl bg-white dark:bg-[#19191f] border border-zinc-300 dark:border-[#2c2c35] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#2a2a32] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <h2 className="text-base font-bold font-display text-zinc-900 dark:text-white">
              Kolaborasi Real-Time & Notifikasi Tim
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-5 space-y-5">
          {/* Room Connection */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#202027] border border-zinc-200 dark:border-[#2e2e37] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-900 dark:text-white">Ruang Proyek WebSocket</span>
              <span className={`font-mono-nums ${connected ? 'text-emerald-500' : 'text-amber-500'}`}>
                {connected ? `Terhubung · ${peers.length + 1} pengguna aktif` : 'Menghubungkan...'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-[180px] flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700">
                <span className="text-xs text-zinc-500">Kode Ruang:</span>
                <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-white">{roomCode}</span>
                <button
                  onClick={copyRoom}
                  className="ml-auto text-xs text-blue-500 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? 'Disalin' : 'Salin'}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  placeholder="Gabung kode ruang..."
                  className="w-36 px-2.5 py-2 rounded-lg bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-xs font-mono"
                />
                <button
                  onClick={() => {
                    const cleaned = joinInput.trim().replace(/[^a-zA-Z0-9_-]/g, '');
                    if (cleaned.length >= 4) onChangeRoomCode(cleaned);
                  }}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
                >
                  Gabung
                </button>
              </div>
            </div>

            {/* Active Members */}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500 mb-1.5">Anggota Online di Kanvas Ini</div>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>{userName} (Anda)</span>
                </div>
                {peers.map((p) => (
                  <div key={p.clientId} className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span>{p.name}</span>
                    <span className="text-[10px] text-zinc-500">({p.tool})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Urgent Push Notification Broadcast */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#202027] border border-zinc-200 dark:border-[#2e2e37] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-white">
                <BellRing className="w-4 h-4 text-amber-500" />
                <span>Notifikasi Push Pembaruan Proyek Mendesak</span>
              </div>
              {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
                <button
                  onClick={onRequestNotificationPermission}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-[11px] font-medium text-white"
                >
                  Aktifkan Push Browser
                </button>
              )}
              {notificationPermission === 'granted' && (
                <span className="text-[11px] text-emerald-500 font-medium">Push Aktif</span>
              )}
            </div>

            <div className="space-y-2">
              <input
                value={alertTitle}
                onChange={(e) => setAlertTitle(e.target.value)}
                placeholder="Judul pembaruan mendesak..."
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-xs"
              />
              <div className="flex gap-2">
                <input
                  value={alertBody}
                  onChange={(e) => setAlertBody(e.target.value)}
                  placeholder="Pesan mendesak untuk seluruh tim di ruang ini..."
                  className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-xs"
                />
                <button
                  onClick={() => {
                    if (!alertBody.trim()) return;
                    onSendUrgentAlert(alertTitle.trim() || 'Pembaruan Mendesak', alertBody.trim());
                    setAlertBody('');
                  }}
                  className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Push</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pin Comments Feed */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
              Komentar Pin pada Kanvas ({comments.length})
            </h3>
            {comments.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Gunakan alat <strong>Pin Komentar (N)</strong> pada bilah alat kiri lalu klik kanvas untuk menambahkan catatan revisi.
              </p>
            ) : (
              <div className="space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                      c.resolved
                        ? 'opacity-60 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#16161b]'
                        : 'border-zinc-300 dark:border-[#32323d] bg-white dark:bg-[#202027]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-zinc-900 dark:text-white">{c.authorName}</span>
                        <span className="text-[10px] font-mono-nums text-zinc-500">
                          ({Math.round(c.x)}, {Math.round(c.y)})
                        </span>
                        {c.urgent && <span className="text-[10px] font-semibold text-red-500">Mendesak</span>}
                      </div>
                      <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">{c.text}</p>
                    </div>
                    <button
                      onClick={() => onResolveComment(c.id, !c.resolved)}
                      className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 shrink-0 ${
                        c.resolved
                          ? 'text-emerald-500 bg-emerald-500/10'
                          : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{c.resolved ? 'Selesai' : 'Tandai Selesai'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
