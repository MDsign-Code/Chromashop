import React from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import type { PushNotificationItem } from '../types/studio';

interface NotificationsDrawerProps {
  open: boolean;
  notifications: PushNotificationItem[];
  permission: NotificationPermission | 'unsupported';
  onRequestPermission: () => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  notifications,
  permission,
  onRequestPermission,
  onMarkAllRead,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm h-full bg-white dark:bg-[#19191f] border-l border-zinc-300 dark:border-[#2c2c35] shadow-2xl flex flex-col">
        <div className="px-4 py-3.5 border-b border-zinc-200 dark:border-[#2a2a32] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold font-display text-zinc-900 dark:text-white">
              Notifikasi Proyek Mendesak
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <button
                onClick={onMarkAllRead}
                title="Tandai semua sudah dibaca"
                className="p-1.5 rounded text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3 border-b border-zinc-200 dark:border-[#2a2a32] bg-zinc-50 dark:bg-[#1e1e25] flex items-center justify-between gap-2 text-xs">
          <span className="text-zinc-600 dark:text-zinc-300">
            Notifikasi Push OS:{' '}
            <strong className={permission === 'granted' ? 'text-emerald-500' : 'text-amber-500'}>
              {permission === 'granted' ? 'Aktif' : permission === 'denied' ? 'Diblokir' : 'Belum Aktif'}
            </strong>
          </span>
          {permission === 'default' && (
            <button
              onClick={onRequestPermission}
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-medium text-white"
            >
              Izinkan
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-3 space-y-2">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              Belum ada pembaruan proyek mendesak. Notifikasi dari kolaborator ruang atau pencadangan penting akan muncul di sini.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-lg border text-xs ${
                  n.read
                    ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#16161b] opacity-75'
                    : 'border-red-500/40 bg-red-500/5 dark:bg-red-500/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-white">{n.title}</span>
                  <span className="text-[10px] font-mono-nums text-zinc-500 shrink-0">
                    {new Date(n.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">{n.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
