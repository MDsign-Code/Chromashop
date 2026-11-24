import React from 'react';
import { BarChart3, Clock, Download, Layers, PenTool, X } from 'lucide-react';
import { triggerBlobDownload } from '../lib/canvasEngine';
import type { AnalyticsSessionItem } from '../types/studio';

interface AnalyticsModalProps {
  open: boolean;
  currentSession: AnalyticsSessionItem;
  historicalSessions: AnalyticsSessionItem[];
  toolUsageSeconds: Record<string, number>;
  onClose: () => void;
}

function formatDuration(sec: number): string {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const rem = sec % 60;
  if (hrs > 0) return `${hrs}j ${mins}m`;
  if (mins > 0) return `${mins}m ${rem}d`;
  return `${rem}d`;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  open,
  currentSession,
  historicalSessions,
  toolUsageSeconds,
  onClose,
}) => {
  if (!open) return null;

  const allSessions = [
    currentSession,
    ...historicalSessions.filter((s) => s.id !== currentSession.id),
  ];

  const totalSec = allSessions.reduce((acc, s) => acc + s.durationSec, 0);
  const totalStrokes = allSessions.reduce((acc, s) => acc + s.strokesCount, 0);
  const totalLayers = allSessions.reduce((acc, s) => acc + s.layersCreated, 0);
  const totalExports = allSessions.reduce((acc, s) => acc + s.exportsCount, 0);

  const toolEntries = Object.entries(toolUsageSeconds)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxToolSec = Math.max(1, ...toolEntries.map(([, s]) => s));

  const exportCsv = () => {
    const header = 'Tanggal,Proyek,DurasiDetik,GoresanBrush,LayerDibuat,Ekspor,AlatUtama\n';
    const rows = allSessions
      .map(
        (s) =>
          `${s.dateKey},"${s.projectTitle.replace(/"/g, '""')}",${s.durationSec},${s.strokesCount},${s.layersCreated},${s.exportsCount},${s.activeTool}`
      )
      .join('\n');
    triggerBlobDownload(new Blob([header + rows], { type: 'text/csv;charset=utf-8;' }), 'ChromaStudio_Analytics.csv');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div className="w-full max-w-4xl max-h-[88vh] rounded-xl bg-white dark:bg-[#19191f] border border-zinc-300 dark:border-[#2c2c35] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#2a2a32] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <h2 className="text-base font-bold font-display text-zinc-900 dark:text-white">
              Dasbor Analitik Waktu & Produktivitas Desain
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-medium flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-5 space-y-6">
          {/* KPI Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricTile
              icon={Clock}
              label="Total Waktu Aktif"
              value={formatDuration(totalSec)}
              sub={`Sesi ini: ${formatDuration(currentSession.durationSec)}`}
            />
            <MetricTile
              icon={PenTool}
              label="Goresan Brush / Stylus"
              value={totalStrokes.toLocaleString('id-ID')}
              sub={`Sesi ini: ${currentSession.strokesCount}`}
            />
            <MetricTile
              icon={Layers}
              label="Layer & Adjustment"
              value={totalLayers.toLocaleString('id-ID')}
              sub={`Sesi ini: ${currentSession.layersCreated}`}
            />
            <MetricTile
              icon={Download}
              label="Ekspor Selesai"
              value={totalExports.toLocaleString('id-ID')}
              sub="PSD, PDF Cetak, PNG, TIFF"
            />
          </div>

          {/* Tool Usage Breakdown */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#202027] border border-zinc-200 dark:border-[#2e2e37]">
            <h3 className="text-xs font-semibold font-display text-zinc-900 dark:text-white mb-3">
              Distribusi Waktu per Alat (Sesi Aktif)
            </h3>
            {toolEntries.length === 0 ? (
              <p className="text-xs text-zinc-500">Mulai berkarya di kanvas untuk merekam distribusi waktu alat.</p>
            ) : (
              <div className="space-y-2.5">
                {toolEntries.map(([tool, secs]) => (
                  <div key={tool} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="capitalize text-zinc-700 dark:text-zinc-300">{tool}</span>
                      <span className="font-mono-nums text-zinc-500">{formatDuration(secs)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.max(4, (secs / maxToolSec) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session History Table */}
          <div>
            <h3 className="text-xs font-semibold font-display text-zinc-900 dark:text-white mb-2">
              Riwayat Sesi Pengerjaan Proyek
            </h3>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-[#2e2e37]">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 dark:bg-[#222229] text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Tanggal</th>
                    <th className="py-2.5 px-3 font-medium">Proyek</th>
                    <th className="py-2.5 px-3 font-medium text-right">Durasi</th>
                    <th className="py-2.5 px-3 font-medium text-right">Goresan</th>
                    <th className="py-2.5 px-3 font-medium text-right">Layer</th>
                    <th className="py-2.5 px-3 font-medium text-right">Ekspor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#292932]">
                  {allSessions.slice(0, 15).map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-[#202026]">
                      <td className="py-2.5 px-3 font-mono-nums text-zinc-500">{s.dateKey}</td>
                      <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">{s.projectTitle}</td>
                      <td className="py-2.5 px-3 text-right font-mono-nums">{formatDuration(s.durationSec)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-nums">{s.strokesCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono-nums">{s.layersCreated}</td>
                      <td className="py-2.5 px-3 text-right font-mono-nums">{s.exportsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricTile: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}> = ({ icon: Icon, label, value, sub }) => (
  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#202027] border border-zinc-200 dark:border-[#2e2e37]">
    <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
      <span className="text-[11px]">{label}</span>
      <Icon className="w-3.5 h-3.5 text-blue-500" />
    </div>
    <div className="mt-1.5 text-xl font-bold font-mono-nums text-zinc-900 dark:text-white">{value}</div>
    <div className="mt-0.5 text-[11px] text-zinc-500 font-mono-nums">{sub}</div>
  </div>
);
