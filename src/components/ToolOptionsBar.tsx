import React from 'react';
import {
  Check,
  PenTool,
  Redo2,
  RotateCcw,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  PanelRight,
} from 'lucide-react';
import type { BrushPreset, SelectionRect, StylusTelemetry, ToolId } from '../types/studio';

interface ToolOptionsBarProps {
  activeTool: ToolId;
  activeBrush: BrushPreset;
  onUpdateBrush: (patch: Partial<BrushPreset>) => void;
  shapeType: 'rectangle' | 'ellipse' | 'rounded' | 'line';
  onChangeShapeType: (s: 'rectangle' | 'ellipse' | 'rounded' | 'line') => void;
  shapeStrokeWidth: number;
  onChangeShapeStrokeWidth: (w: number) => void;
  textSize: number;
  onChangeTextSize: (s: number) => void;
  textFont: string;
  onChangeTextFont: (f: string) => void;
  stylusOnly: boolean;
  onToggleStylusOnly: () => void;
  stylusTelemetry: StylusTelemetry;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  selection: SelectionRect | null;
  onClearSelection: () => void;
  onApplyCrop: () => void;
  onToggleInspectorMobile: () => void;
}

export const ToolOptionsBar: React.FC<ToolOptionsBarProps> = ({
  activeTool,
  activeBrush,
  onUpdateBrush,
  shapeType,
  onChangeShapeType,
  shapeStrokeWidth,
  onChangeShapeStrokeWidth,
  textSize,
  onChangeTextSize,
  textFont,
  onChangeTextFont,
  stylusOnly,
  onToggleStylusOnly,
  stylusTelemetry,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selection,
  onClearSelection,
  onApplyCrop,
  onToggleInspectorMobile,
}) => {
  const isDrawingTool = activeTool === 'brush' || activeTool === 'eraser';

  return (
    <div className="h-10 shrink-0 flex items-center justify-between gap-2 px-2.5 bg-zinc-50 dark:bg-[#1e1e23] border-b border-zinc-300 dark:border-[#2a2a32] overflow-x-auto studio-scroll select-none z-30">
      {/* Left: Context Controls */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-zinc-300 dark:border-[#2e2e37]">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Urungkan (Ctrl+Z)"
            className="w-8 h-8 flex items-center justify-center rounded text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-35"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Ulangi (Ctrl+Shift+Z)"
            className="w-8 h-8 flex items-center justify-center rounded text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-35"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Brush / Eraser Options */}
        {isDrawingTool && (
          <div className="flex items-center gap-3 text-xs text-zinc-700 dark:text-zinc-300">
            <label className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Ukuran</span>
              <input
                type="range"
                min={1}
                max={200}
                value={activeBrush.size}
                onChange={(e) => onUpdateBrush({ size: Number(e.target.value) })}
                className="w-20 studio-slider"
              />
              <span className="w-8 text-right font-mono-nums text-[11px]">{activeBrush.size}px</span>
            </label>

            <label className="hidden sm:flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Opacity</span>
              <input
                type="range"
                min={1}
                max={100}
                value={activeBrush.opacity}
                onChange={(e) => onUpdateBrush({ opacity: Number(e.target.value) })}
                className="w-16 studio-slider"
              />
              <span className="w-8 text-right font-mono-nums text-[11px]">{activeBrush.opacity}%</span>
            </label>

            <label className="hidden md:flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Flow</span>
              <input
                type="range"
                min={1}
                max={100}
                value={activeBrush.flow}
                onChange={(e) => onUpdateBrush({ flow: Number(e.target.value) })}
                className="w-16 studio-slider"
              />
              <span className="w-8 text-right font-mono-nums text-[11px]">{activeBrush.flow}%</span>
            </label>

            <button
              onClick={() => onUpdateBrush({ pressureSize: !activeBrush.pressureSize })}
              title="Sensitivitas Tekanan Stylus ke Ukuran Brush"
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap ${
                activeBrush.pressureSize
                  ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/40'
                  : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-transparent'
              }`}
            >
              <PenTool className="w-3 h-3" />
              <span>Tekanan</span>
            </button>

            <button
              onClick={onToggleStylusOnly}
              title="Tolak Sentuhan Telapak Tangan (Hanya Stylus / S-Pen)"
              className={`hidden sm:inline-flex px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                stylusOnly
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                  : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-transparent'
              }`}
            >
              {stylusOnly ? 'Mode Stylus Saja' : 'Sentuh + Stylus'}
            </button>

            {/* Live Stylus Pressure Gauge */}
            <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-zinc-300 dark:border-[#2e2e37]">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                {stylusTelemetry.pointerType === 'pen' ? 'Stylus' : 'Input'}
              </span>
              <div className="w-14 h-2 rounded-full bg-zinc-300 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-[width] duration-75"
                  style={{ width: `${Math.round(stylusTelemetry.pressure * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono-nums text-zinc-500 dark:text-zinc-400 w-7">
                {Math.round(stylusTelemetry.pressure * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Shape Tool Options */}
        {activeTool === 'shape' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Bentuk:</span>
            {(['rectangle', 'rounded', 'ellipse', 'line'] as const).map((s) => (
              <button
                key={s}
                onClick={() => onChangeShapeType(s)}
                className={`px-2 py-1 rounded text-[11px] capitalize ${
                  shapeType === s
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                {s === 'rectangle' ? 'Persegi' : s === 'rounded' ? 'Sudut Halus' : s === 'ellipse' ? 'Elips' : 'Garis'}
              </button>
            ))}
            <label className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-zinc-500">Garis</span>
              <input
                type="number"
                min={0}
                max={40}
                value={shapeStrokeWidth}
                onChange={(e) => onChangeShapeStrokeWidth(Math.max(0, Number(e.target.value)))}
                className="w-12 px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs font-mono-nums"
              />
            </label>
          </div>
        )}

        {/* Text Tool Options */}
        {activeTool === 'text' && (
          <div className="flex items-center gap-2.5 text-xs">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Klik kanvas untuk menambah teks</span>
            <select
              value={textFont}
              onChange={(e) => onChangeTextFont(e.target.value)}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200"
            >
              <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
              <option value="DM Sans">DM Sans</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Georgia">Georgia Serif</option>
            </select>
            <label className="flex items-center gap-1">
              <span className="text-[11px] text-zinc-500">Ukuran</span>
              <input
                type="number"
                min={10}
                max={240}
                value={textSize}
                onChange={(e) => onChangeTextSize(Math.max(10, Number(e.target.value)))}
                className="w-14 px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs font-mono-nums"
              />
            </label>
          </div>
        )}

        {/* Crop / Marquee Selection Actions */}
        {selection && (
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-300 dark:border-[#2e2e37] text-xs">
            <span className="font-mono-nums text-[11px] text-zinc-500 dark:text-zinc-400">
              {Math.round(selection.width)} × {Math.round(selection.height)} px
            </span>
            {activeTool === 'crop' && (
              <button
                onClick={onApplyCrop}
                className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] font-medium flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Terapkan Crop
              </button>
            )}
            <button
              onClick={onClearSelection}
              className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Hapus Seleksi
            </button>
          </div>
        )}

        {activeTool === 'pin' && (
          <span className="text-xs text-zinc-600 dark:text-zinc-300">
            Klik di mana saja pada kanvas untuk menaruh pin komentar kolaborasi tim
          </span>
        )}
        {activeTool === 'move' && (
          <span className="text-xs text-zinc-600 dark:text-zinc-300">
            Seret pada kanvas untuk memindahkan posisi layer aktif
          </span>
        )}
        {activeTool === 'eyedropper' && (
          <span className="text-xs text-zinc-600 dark:text-zinc-300">
            Klik piksel pada kanvas untuk mengambil sampel warna depan
          </span>
        )}
        {activeTool === 'fill' && (
          <span className="text-xs text-zinc-600 dark:text-zinc-300">
            Klik area pada layer raster aktif untuk mengisi warna depan
          </span>
        )}
      </div>

      {/* Right: Zoom Controls + Mobile Inspector Toggle */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onZoomOut}
          title="Perkecil"
          className="w-7 h-7 flex items-center justify-center rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onZoomFit}
          title="Sesuaikan Layar"
          className="px-1.5 h-7 rounded text-[11px] font-mono-nums text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onZoomIn}
          title="Perbesar"
          className="w-7 h-7 flex items-center justify-center rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onZoomFit}
          title="Fit Kanvas"
          className="hidden sm:flex w-7 h-7 items-center justify-center rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onToggleInspectorMobile}
          title="Buka Panel Layer & Brush"
          className="lg:hidden ml-1 px-2 h-7 rounded bg-blue-600/15 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-center gap-1"
        >
          <PanelRight className="w-3.5 h-3.5" />
          <span>Panel</span>
        </button>
      </div>
    </div>
  );
};
