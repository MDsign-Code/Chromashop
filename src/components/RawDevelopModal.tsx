import React, { useEffect, useRef, useState } from 'react';
import { Eye, RotateCcw, SlidersHorizontal, Upload, X } from 'lucide-react';
import { DEFAULT_RAW_SETTINGS, SAMPLE_ASSETS_PATHS } from '../data/defaults';
import { createOffscreenCanvas, loadImageFromUrl, parseRawFile, processRawDevelop } from '../lib/canvasEngine';
import type { RawDevelopSettings, RawFileMetadata } from '../types/studio';

interface RawDevelopModalProps {
  open: boolean;
  initialImageUrl?: string | null;
  onClose: () => void;
  onApplyToCanvas: (canvas: HTMLCanvasElement, layerName: string) => void;
}

interface RawSample {
  name: string;
  url: string;
  camera: string;
  iso: string;
  aperture: string;
  shutter: string;
}

const RAW_SAMPLES: RawSample[] = [
  {
    name: 'Bromo_Sunrise_14bit.dng',
    url: SAMPLE_ASSETS_PATHS.mountain,
    camera: 'Medium Format GFX 100 II',
    iso: 'ISO 100',
    aperture: 'f/8.0',
    shutter: '1/160s',
  },
  {
    name: 'Studio_Portrait_RAW.arw',
    url: SAMPLE_ASSETS_PATHS.portrait,
    camera: 'Sony ILCE-7RM5',
    iso: 'ISO 200',
    aperture: 'f/2.0',
    shutter: '1/250s',
  },
  {
    name: 'Pavilion_Concrete.nef',
    url: SAMPLE_ASSETS_PATHS.architecture,
    camera: 'Nikon Z8',
    iso: 'ISO 64',
    aperture: 'f/5.6',
    shutter: '1/500s',
  },
];

export const RawDevelopModal: React.FC<RawDevelopModalProps> = ({
  open,
  initialImageUrl,
  onClose,
  onApplyToCanvas,
}) => {
  const [settings, setSettings] = useState<RawDevelopSettings>({ ...DEFAULT_RAW_SETTINGS });
  const [metadata, setMetadata] = useState<RawFileMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  const [histogram, setHistogram] = useState<{ r: number[]; g: number[]; b: number[] } | null>(null);

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSample = async (sample: (typeof RAW_SAMPLES)[number]) => {
    setLoading(true);
    try {
      const img = await loadImageFromUrl(sample.url);
      // Downscale working preview safely while preserving crisp detail
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const c = createOffscreenCanvas(img.naturalWidth * scale, img.naturalHeight * scale);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      sourceCanvasRef.current = c;
      setMetadata({
        fileName: sample.name,
        format: sample.name.split('.').pop()?.toUpperCase() || 'DNG',
        cameraModel: sample.camera,
        bitDepth: '14-bit RAW',
        iso: sample.iso,
        aperture: sample.aperture,
        shutter: sample.shutter,
        width: img.naturalWidth,
        height: img.naturalHeight,
        fileSizeKb: 28400,
      });
      setSettings({ ...DEFAULT_RAW_SETTINGS });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (initialImageUrl) {
      loadSample({
        name: 'Asset_RAW_Develop.dng',
        url: initialImageUrl,
        camera: 'Studio RAW Sensor',
        iso: 'ISO 100',
        aperture: 'f/4.0',
        shutter: '1/250s',
      });
    } else if (!sourceCanvasRef.current) {
      loadSample(RAW_SAMPLES[0]);
    }
  }, [open, initialImageUrl]);

  // Re-develop preview whenever settings or source change
  useEffect(() => {
    if (!open || !sourceCanvasRef.current || !previewCanvasRef.current) return;
    const src = sourceCanvasRef.current;
    const dst = previewCanvasRef.current;
    if (showBefore) {
      dst.width = src.width;
      dst.height = src.height;
      dst.getContext('2d')?.drawImage(src, 0, 0);
      return;
    }
    const hist = processRawDevelop(src, dst, settings);
    setHistogram(hist);
  }, [open, settings, metadata, showBefore]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const parsed = await parseRawFile(file);
      const maxDim = 1400;
      const scale = Math.min(1, maxDim / Math.max(parsed.canvas.width, parsed.canvas.height));
      const work = createOffscreenCanvas(parsed.canvas.width * scale, parsed.canvas.height * scale);
      work.getContext('2d')?.drawImage(parsed.canvas, 0, 0, work.width, work.height);
      sourceCanvasRef.current = work;
      setMetadata(parsed.metadata);
      setSettings({ ...DEFAULT_RAW_SETTINGS });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  if (!open) return null;

  const update = (key: keyof RawDevelopSettings, val: number) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleCommit = () => {
    if (!sourceCanvasRef.current) return;
    const out = createOffscreenCanvas(sourceCanvasRef.current.width, sourceCanvasRef.current.height);
    processRawDevelop(sourceCanvasRef.current, out, settings);
    onApplyToCanvas(out, metadata ? `RAW: ${metadata.fileName}` : 'RAW Layer');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-5">
      <div className="w-full max-w-6xl h-[92vh] rounded-xl bg-white dark:bg-[#17171c] border border-zinc-300 dark:border-[#2c2c35] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 border-b border-zinc-300 dark:border-[#2a2a32] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <SlidersHorizontal className="w-4 h-4 text-blue-500 shrink-0" />
            <h2 className="text-sm font-bold font-display text-zinc-900 dark:text-white truncate">
              Camera RAW Develop Studio
            </h2>
            {metadata && (
              <span className="hidden md:inline text-xs text-zinc-500 font-mono-nums truncate">
                {metadata.fileName} · {metadata.cameraModel} · {metadata.bitDepth} · {metadata.iso} · {metadata.aperture}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".dng,.cr2,.cr3,.nef,.arw,.raf,.orf,.rw2,.jpg,.jpeg,.png,.webp"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Buka File RAW (.DNG / .CR2 / .NEF / .ARW)</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Preview Viewport */}
          <div className="flex-1 bg-[#0e0e11] flex flex-col items-center justify-center p-4 relative overflow-hidden min-h-[260px]">
            {loading ? (
              <div className="text-sm text-zinc-400">Memproses data sensor RAW...</div>
            ) : (
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-full object-contain shadow-2xl rounded"
              />
            )}

            {/* Quick RAW Sample Selector & Before/After */}
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm p-1 rounded-lg border border-white/10">
                {RAW_SAMPLES.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => loadSample(s)}
                    className={`px-2 py-1 rounded text-[11px] transition-colors ${
                      metadata?.fileName === s.name
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {s.name.split('_')[0]} ({s.name.split('.').pop()?.toUpperCase()})
                  </button>
                ))}
              </div>
              <button
                onPointerDown={() => setShowBefore(true)}
                onPointerUp={() => setShowBefore(false)}
                onPointerLeave={() => setShowBefore(false)}
                onClick={() => setShowBefore((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border ${
                  showBefore
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-black/70 text-zinc-200 border-white/15 hover:bg-black/90'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showBefore ? 'Menampilkan Asli (Before)' : 'Bandingkan Asli'}</span>
              </button>
            </div>
          </div>

          {/* Right RAW Develop Controls */}
          <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-300 dark:border-[#2a2a32] bg-zinc-50 dark:bg-[#1b1b21] flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-4">
              {/* Live RGB Histogram */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Histogram RGB Live</span>
                  <button
                    onClick={() => setSettings({ ...DEFAULT_RAW_SETTINGS })}
                    className="text-[11px] text-blue-500 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>
                <div className="h-20 w-full rounded-lg bg-[#111115] border border-zinc-300 dark:border-zinc-800 p-1.5 flex items-end gap-[1px] overflow-hidden">
                  {histogram &&
                    (() => {
                      const maxVal = Math.max(1, ...histogram.r, ...histogram.g, ...histogram.b);
                      return histogram.r.map((_, idx) => {
                        const hr = (histogram.r[idx] / maxVal) * 100;
                        const hg = (histogram.g[idx] / maxVal) * 100;
                        const hb = (histogram.b[idx] / maxVal) * 100;
                        return (
                          <div key={idx} className="flex-1 h-full relative">
                            <div className="absolute bottom-0 inset-x-0 bg-red-500/45" style={{ height: `${hr}%` }} />
                            <div className="absolute bottom-0 inset-x-0 bg-emerald-500/45" style={{ height: `${hg}%` }} />
                            <div className="absolute bottom-0 inset-x-0 bg-blue-500/45" style={{ height: `${hb}%` }} />
                          </div>
                        );
                      });
                    })()}
                </div>
              </div>

              {/* White Balance */}
              <SectionTitle title="White Balance" />
              <RawSlider label="Temperature (Kelvin)" value={settings.temperature} min={-100} max={100} onChange={(v) => update('temperature', v)} />
              <RawSlider label="Tint (Green — Magenta)" value={settings.tint} min={-100} max={100} onChange={(v) => update('tint', v)} />

              {/* Tone */}
              <SectionTitle title="Tone & Dynamic Range" />
              <RawSlider label="Exposure (EV)" value={settings.exposure} min={-3} max={3} step={0.1} onChange={(v) => update('exposure', v)} />
              <RawSlider label="Contrast" value={settings.contrast} min={-100} max={100} onChange={(v) => update('contrast', v)} />
              <RawSlider label="Highlights" value={settings.highlights} min={-100} max={100} onChange={(v) => update('highlights', v)} />
              <RawSlider label="Shadows" value={settings.shadows} min={-100} max={100} onChange={(v) => update('shadows', v)} />
              <RawSlider label="Whites" value={settings.whites} min={-100} max={100} onChange={(v) => update('whites', v)} />
              <RawSlider label="Blacks" value={settings.blacks} min={-100} max={100} onChange={(v) => update('blacks', v)} />

              {/* Presence & Detail */}
              <SectionTitle title="Presence & Detail" />
              <RawSlider label="Clarity" value={settings.clarity} min={-100} max={100} onChange={(v) => update('clarity', v)} />
              <RawSlider label="Vibrance" value={settings.vibrance} min={-100} max={100} onChange={(v) => update('vibrance', v)} />
              <RawSlider label="Saturation" value={settings.saturation} min={-100} max={100} onChange={(v) => update('saturation', v)} />
              <RawSlider label="Noise Reduction" value={settings.noiseReduction} min={0} max={100} onChange={(v) => update('noiseReduction', v)} />
            </div>

            {/* Footer Actions */}
            <div className="p-3 border-t border-zinc-300 dark:border-[#2a2a32] flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                onClick={handleCommit}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
              >
                Buka sebagai Layer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 font-display">
    {title}
  </div>
);

const RawSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, onChange }) => (
  <label className="block space-y-1">
    <div className="flex justify-between text-[11px]">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="font-mono-nums text-zinc-900 dark:text-zinc-200">{Number(value.toFixed(1))}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full studio-slider"
    />
  </label>
);
