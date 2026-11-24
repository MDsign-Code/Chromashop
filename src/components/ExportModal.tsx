import React, { useState } from 'react';
import { Download, FileImage, Layers, Printer, X } from 'lucide-react';
import {
  compositeLayers,
  createOffscreenCanvas,
  encodeCanvasToTiffBlob,
  exportCanvasToPrintPdf,
  exportProjectToPsdBlob,
  triggerBlobDownload,
} from '../lib/canvasEngine';
import type { StudioLayer } from '../types/studio';

interface ExportModalProps {
  open: boolean;
  projectTitle: string;
  width: number;
  height: number;
  dpi: number;
  layers: StudioLayer[];
  onClose: () => void;
  onExportCompleted: (format: string) => void;
}

type ExportFormat = 'psd' | 'pdf' | 'tiff' | 'png' | 'jpeg' | 'webp' | 'svg';

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  projectTitle,
  width,
  height,
  dpi: initialDpi,
  layers,
  onClose,
  onExportCompleted,
}) => {
  const [format, setFormat] = useState<ExportFormat>('psd');
  const [quality, setQuality] = useState(92);
  const [dpi, setDpi] = useState(initialDpi || 300);
  const [paperSize, setPaperSize] = useState<'canvas' | 'a4' | 'a3' | 'letter'>('a4');
  const [bleedMm, setBleedMm] = useState(3);
  const [cropMarks, setCropMarks] = useState(true);
  const [cmykSoftProof, setCmykSoftProof] = useState(true);
  const [scale, setScale] = useState(1);
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const safeName = (projectTitle || 'ChromaStudio_Project').replace(/[^a-zA-Z0-9_-]/g, '_');

  const handleExport = async () => {
    setExporting(true);
    try {
      const targetW = Math.round(width * scale);
      const targetH = Math.round(height * scale);

      if (format === 'psd') {
        const blob = exportProjectToPsdBlob(layers, width, height);
        triggerBlobDownload(blob, `${safeName}.psd`);
      } else {
        const composite = createOffscreenCanvas(width, height);
        compositeLayers(composite, layers, width, height);

        const outCanvas =
          scale === 1
            ? composite
            : (() => {
                const scaled = createOffscreenCanvas(targetW, targetH);
                scaled.getContext('2d')?.drawImage(composite, 0, 0, targetW, targetH);
                return scaled;
              })();

        if (format === 'pdf') {
          const pdfBlob = exportCanvasToPrintPdf(outCanvas, {
            title: projectTitle,
            dpi,
            bleedMm,
            cropMarks,
            cmykSoftProof,
            paperSize,
          });
          triggerBlobDownload(pdfBlob, `${safeName}_PRINT_${dpi}DPI.pdf`);
        } else if (format === 'tiff') {
          const tiffBlob = encodeCanvasToTiffBlob(outCanvas, dpi);
          triggerBlobDownload(tiffBlob, `${safeName}_${dpi}DPI.tiff`);
        } else if (format === 'svg') {
          const pngData = outCanvas.toDataURL('image/png');
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${targetW}" height="${targetH}" viewBox="0 0 ${targetW} ${targetH}"><image href="${pngData}" width="${targetW}" height="${targetH}"/></svg>`;
          triggerBlobDownload(new Blob([svg], { type: 'image/svg+xml' }), `${safeName}.svg`);
        } else {
          const mime =
            format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';
          const blob = await new Promise<Blob | null>((resolve) =>
            outCanvas.toBlob(resolve, mime, quality / 100)
          );
          if (blob) triggerBlobDownload(blob, `${safeName}.${format === 'jpeg' ? 'jpg' : format}`);
        }
      }

      onExportCompleted(format.toUpperCase());
      onClose();
    } finally {
      setExporting(false);
    }
  };

  const formatOptions: { id: ExportFormat; label: string; desc: string; tag: string }[] = [
    { id: 'psd', label: 'Photoshop (.PSD)', desc: 'Semua layer, opacity, blend mode & nama tetap dapat diedit penuh', tag: 'Editable Layers' },
    { id: 'pdf', label: 'PDF Siap Cetak (.PDF)', desc: 'Profil CMYK Fogra39, DPI cetak, bleed margin & tanda potong', tag: 'Percetakan' },
    { id: 'tiff', label: 'TIFF Tanpa Kompresi (.TIFF)', desc: 'Raster 32-bit lossless dengan metadata DPI untuk cetak resolusi tinggi', tag: 'Percetakan' },
    { id: 'png', label: 'PNG Lossless (.PNG)', desc: 'Mendukung transparansi alpha penuh untuk web & desain UI', tag: 'Digital' },
    { id: 'jpeg', label: 'JPEG (.JPG)', desc: 'Ukuran ringkas dengan kontrol kualitas untuk fotografi & distribusi', tag: 'Digital' },
    { id: 'webp', label: 'WebP Modern (.WEBP)', desc: 'Kompresi modern ringan untuk aplikasi seluler & situs web', tag: 'Digital' },
    { id: 'svg', label: 'SVG Wrapper (.SVG)', desc: 'Format vektor kontainer untuk integrasi grafis responsif', tag: 'Vektor' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#19191f] border border-zinc-300 dark:border-[#2c2c35] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#2a2a32] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold font-display text-zinc-900 dark:text-white">
              Ekspor PSD & Format Percetakan
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono-nums">
              {width} × {height} px · {layers.length} layer aktif
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto studio-scroll p-5 space-y-5">
          {/* Format Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {formatOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFormat(opt.id)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  format === opt.id
                    ? 'border-blue-500 bg-blue-600/10'
                    : 'border-zinc-200 dark:border-[#2e2e37] hover:border-zinc-400 dark:hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white">{opt.label}</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{opt.tag}</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">{opt.desc}</p>
              </button>
            ))}
          </div>

          {/* Format-Specific Settings */}
          {format === 'psd' && (
            <div className="p-3.5 rounded-lg bg-zinc-100 dark:bg-[#222229] border border-zinc-200 dark:border-[#30303a] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-white">
                <Layers className="w-4 h-4 text-blue-500" />
                <span>Struktur Layer PSD yang Akan Disimpan ({layers.length} Layer)</span>
              </div>
              <div className="max-h-28 overflow-y-auto studio-scroll space-y-1 text-[11px] font-mono-nums text-zinc-600 dark:text-zinc-300">
                {[...layers].reverse().map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-0.5">
                    <span className="truncate">{l.name}</span>
                    <span className="opacity-70">
                      {l.type} · {l.opacity}% · {l.visible ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(format === 'pdf' || format === 'tiff') && (
            <div className="p-4 rounded-lg bg-zinc-100 dark:bg-[#222229] border border-zinc-200 dark:border-[#30303a] space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-white">
                <Printer className="w-4 h-4 text-blue-500" />
                <span>Pengaturan Pra-Cetak (Prepress)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-[11px] text-zinc-500">Resolusi (DPI)</span>
                  <select
                    value={dpi}
                    onChange={(e) => setDpi(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 font-mono-nums"
                  >
                    <option value={72}>72 DPI (Screen)</option>
                    <option value={150}>150 DPI (Draft Cetak)</option>
                    <option value={300}>300 DPI (Offset Standar)</option>
                    <option value={600}>600 DPI (Fine Art)</option>
                  </select>
                </label>

                {format === 'pdf' && (
                  <>
                    <label className="space-y-1">
                      <span className="text-[11px] text-zinc-500">Ukuran Kertas</span>
                      <select
                        value={paperSize}
                        onChange={(e) => setPaperSize(e.target.value as 'canvas' | 'a4' | 'a3' | 'letter')}
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700"
                      >
                        <option value="a4">A4 (210 × 297 mm)</option>
                        <option value="a3">A3 (297 × 420 mm)</option>
                        <option value="letter">US Letter</option>
                        <option value="canvas">Sesuai Ukuran Kanvas</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-zinc-500">Bleed Margin (mm)</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={bleedMm}
                        onChange={(e) => setBleedMm(Math.max(0, Number(e.target.value)))}
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 font-mono-nums"
                      />
                    </label>
                  </>
                )}
              </div>

              {format === 'pdf' && (
                <div className="flex flex-wrap gap-4 pt-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cropMarks} onChange={(e) => setCropMarks(e.target.checked)} />
                    <span>Sertakan Tanda Potong (Crop Marks)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cmykSoftProof} onChange={(e) => setCmykSoftProof(e.target.checked)} />
                    <span>Simulasi Gamut CMYK Fogra39</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {(format === 'png' || format === 'jpeg' || format === 'webp') && (
            <div className="p-4 rounded-lg bg-zinc-100 dark:bg-[#222229] border border-zinc-200 dark:border-[#30303a] space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-white">
                <FileImage className="w-4 h-4 text-blue-500" />
                <span>Pengaturan Gambar Digital</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <label className="space-y-1">
                  <span className="text-[11px] text-zinc-500">Skala Resolusi</span>
                  <select
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 font-mono-nums"
                  >
                    <option value={0.5}>0.5x ({Math.round(width * 0.5)} × {Math.round(height * 0.5)})</option>
                    <option value={1}>1x ({width} × {height})</option>
                    <option value={2}>2x Retina ({width * 2} × {height * 2})</option>
                  </select>
                </label>

                {format !== 'png' && (
                  <label className="space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-500">
                      <span>Kualitas Kompresi</span>
                      <span className="font-mono-nums text-zinc-900 dark:text-white">{quality}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className="w-full studio-slider mt-2"
                    />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-200 dark:border-[#2a2a32] flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500 font-mono-nums truncate">
            {safeName}.{format === 'jpeg' ? 'jpg' : format}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              Batal
            </button>
            <button
              disabled={exporting}
              onClick={handleExport}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Memproses...' : `Unduh ${format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
