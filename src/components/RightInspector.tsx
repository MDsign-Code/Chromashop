import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Brush,
  Copy,
  Eye,
  EyeOff,
  History,
  Layers,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  Type,
  Unlock,
  X,
  Contrast,
} from 'lucide-react';
import { BLEND_MODES } from '../data/defaults';
import { stampBrushDab } from '../lib/canvasEngine';
import type {
  AdjustmentParams,
  AdjustmentType,
  BackupSnapshot,
  BlendMode,
  BrushPreset,
  BrushTipType,
  LayerEffects,
  StudioLayer,
} from '../types/studio';

interface RightInspectorProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  layers: StudioLayer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onAddRasterLayer: () => void;
  onAddAdjustmentLayer: (type: AdjustmentType) => void;
  onDuplicateLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onMoveLayerOrder: (id: string, dir: 'up' | 'down') => void;
  onUpdateLayer: (id: string, patch: Partial<StudioLayer>) => void;
  onUpdateAdjustment: (id: string, patch: Partial<AdjustmentParams>) => void;
  onUpdateEffects: (id: string, effects: LayerEffects) => void;
  onToggleLayerMask: (id: string) => void;
  onMergeDown: () => void;
  // Brush & Stylus
  brushes: BrushPreset[];
  activeBrush: BrushPreset;
  onSelectBrush: (b: BrushPreset) => void;
  onUpdateBrush: (patch: Partial<BrushPreset>) => void;
  onSaveCustomBrush: (name: string) => void;
  pressureCurve: number;
  onChangePressureCurve: (v: number) => void;
  // History & Backups
  historyLabels: string[];
  historyIndex: number;
  onJumpHistory: (idx: number) => void;
  backups: BackupSnapshot[];
  onCreateBackupNow: () => void;
  onRestoreBackup: (b: BackupSnapshot) => void;
}

const ADJUSTMENT_TYPES: { type: AdjustmentType; label: string }[] = [
  { type: 'brightness-contrast', label: 'Brightness / Contrast' },
  { type: 'hue-saturation', label: 'Hue / Saturation' },
  { type: 'exposure', label: 'Exposure & Gamma' },
  { type: 'levels', label: 'Levels (Black / White)' },
  { type: 'color-balance', label: 'Color Balance RGB' },
  { type: 'vibrance', label: 'Vibrance' },
  { type: 'black-white', label: 'Black & White Mix' },
  { type: 'invert', label: 'Invert Warna' },
];

export const RightInspector: React.FC<RightInspectorProps> = (props) => {
  const [tab, setTab] = useState<'layers' | 'adjust' | 'brush' | 'history'>('layers');
  const [showFxPanel, setShowFxPanel] = useState(false);
  const [newBrushName, setNewBrushName] = useState('');
  const testCanvasRef = useRef<HTMLCanvasElement>(null);
  const testDrawingRef = useRef(false);

  const activeLayer = props.layers.find((l) => l.id === props.activeLayerId);
  const reversedLayers = [...props.layers].reverse();

  const handleTestPadDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = testCanvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * c.width;
    const y = ((e.clientY - rect.top) / rect.height) * c.height;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const p = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.7;
    stampBrushDab(ctx, x, y, p, props.activeBrush, '#60a5fa', false, props.pressureCurve);
  };

  const content = (
    <div className="flex flex-col h-full bg-zinc-100 dark:bg-[#1a1a1f] text-zinc-900 dark:text-zinc-100 select-none">
      {/* Inspector Tab Bar */}
      <div className="flex items-center border-b border-zinc-300 dark:border-[#2a2a32] px-1 pt-1 shrink-0">
        {[
          { id: 'layers' as const, label: 'Layers', icon: Layers },
          { id: 'adjust' as const, label: 'Adjust', icon: Sliders },
          { id: 'brush' as const, label: 'Brush', icon: Brush },
          { id: 'history' as const, label: 'Riwayat', icon: History },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-1 text-[11px] font-medium flex items-center justify-center gap-1 border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
        <button
          onClick={props.onCloseMobile}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          aria-label="Tutup Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* TAB 1: LAYERS */}
      {tab === 'layers' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Active Layer Blend Mode & Opacity */}
          {activeLayer && (
            <div className="p-2.5 border-b border-zinc-300 dark:border-[#2a2a32] space-y-2 shrink-0 bg-zinc-50 dark:bg-[#1e1e24]">
              <div className="flex items-center gap-2">
                <select
                  value={activeLayer.blendMode}
                  onChange={(e) => props.onUpdateLayer(activeLayer.id, { blendMode: e.target.value as BlendMode })}
                  className="flex-1 px-2 py-1 rounded bg-white dark:bg-[#141418] border border-zinc-300 dark:border-[#32323d] text-xs text-zinc-800 dark:text-zinc-100"
                >
                  {BLEND_MODES.map((bm) => (
                    <option key={bm.value} value={bm.value}>
                      {bm.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5 w-28">
                  <span className="text-[10px] text-zinc-500">Op</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={activeLayer.opacity}
                    onChange={(e) => props.onUpdateLayer(activeLayer.id, { opacity: Number(e.target.value) })}
                    className="w-full studio-slider"
                  />
                  <span className="text-[10px] font-mono-nums w-7 text-right">{activeLayer.opacity}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-1 text-[11px]">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => props.onUpdateLayer(activeLayer.id, { locked: !activeLayer.locked })}
                    title="Kunci Layer"
                    className={`px-2 py-1 rounded flex items-center gap-1 ${
                      activeLayer.locked
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {activeLayer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span>Kunci</span>
                  </button>

                  {activeLayer.type === 'raster' && (
                    <button
                      onClick={() => props.onToggleLayerMask(activeLayer.id)}
                      title="Tambah / Edit Layer Mask Non-Destruktif"
                      className={`px-2 py-1 rounded flex items-center gap-1 ${
                        activeLayer.editingMask
                          ? 'bg-blue-600 text-white'
                          : activeLayer.maskEnabled
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Contrast className="w-3 h-3" />
                      <span>{activeLayer.editingMask ? 'Edit Mask' : 'Mask'}</span>
                    </button>
                  )}

                  {activeLayer.type !== 'adjustment' && (
                    <button
                      onClick={() => setShowFxPanel((v) => !v)}
                      title="Layer Styles (FX)"
                      className={`px-2 py-1 rounded flex items-center gap-1 ${
                        showFxPanel ||
                        activeLayer.effects.dropShadow.enabled ||
                        activeLayer.effects.outerGlow.enabled ||
                        activeLayer.effects.stroke.enabled
                          ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>FX</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => props.onMoveLayerOrder(activeLayer.id, 'up')}
                    title="Naikkan Layer"
                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => props.onMoveLayerOrder(activeLayer.id, 'down')}
                    title="Turunkan Layer"
                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Layer FX Accordion */}
              {showFxPanel && activeLayer.type !== 'adjustment' && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-[11px]">
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={activeLayer.effects.dropShadow.enabled}
                        onChange={(e) =>
                          props.onUpdateEffects(activeLayer.id, {
                            ...activeLayer.effects,
                            dropShadow: { ...activeLayer.effects.dropShadow, enabled: e.target.checked },
                          })
                        }
                      />
                      Drop Shadow
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={48}
                      value={activeLayer.effects.dropShadow.blur}
                      onChange={(e) =>
                        props.onUpdateEffects(activeLayer.id, {
                          ...activeLayer.effects,
                          dropShadow: { ...activeLayer.effects.dropShadow, blur: Number(e.target.value) },
                        })
                      }
                      className="w-24 studio-slider"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={activeLayer.effects.outerGlow.enabled}
                        onChange={(e) =>
                          props.onUpdateEffects(activeLayer.id, {
                            ...activeLayer.effects,
                            outerGlow: { ...activeLayer.effects.outerGlow, enabled: e.target.checked },
                          })
                        }
                      />
                      Outer Glow
                    </span>
                    <input
                      type="color"
                      value={activeLayer.effects.outerGlow.color}
                      onChange={(e) =>
                        props.onUpdateEffects(activeLayer.id, {
                          ...activeLayer.effects,
                          outerGlow: { ...activeLayer.effects.outerGlow, color: e.target.value },
                        })
                      }
                      className="w-6 h-5 rounded border border-zinc-600 bg-transparent"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={activeLayer.effects.stroke.enabled}
                        onChange={(e) =>
                          props.onUpdateEffects(activeLayer.id, {
                            ...activeLayer.effects,
                            stroke: { ...activeLayer.effects.stroke, enabled: e.target.checked },
                          })
                        }
                      />
                      Stroke ({activeLayer.effects.stroke.width}px)
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={16}
                      value={activeLayer.effects.stroke.width}
                      onChange={(e) =>
                        props.onUpdateEffects(activeLayer.id, {
                          ...activeLayer.effects,
                          stroke: { ...activeLayer.effects.stroke, width: Number(e.target.value) },
                        })
                      }
                      className="w-24 studio-slider"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Layer Stack List */}
          <div className="flex-1 overflow-y-auto studio-scroll divide-y divide-zinc-200 dark:divide-[#26262e]">
            {reversedLayers.map((layer) => {
              const selected = layer.id === props.activeLayerId;
              return (
                <div
                  key={layer.id}
                  onClick={() => props.onSelectLayer(layer.id)}
                  className={`flex items-center gap-2 px-2.5 py-2 cursor-pointer transition-colors ${
                    selected
                      ? 'bg-blue-600/15 dark:bg-blue-600/25'
                      : 'hover:bg-zinc-200/70 dark:hover:bg-[#23232a]'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onUpdateLayer(layer.id, { visible: !layer.visible });
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white shrink-0"
                    title={layer.visible ? 'Sembunyikan Layer' : 'Tampilkan Layer'}
                  >
                    {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-45" />}
                  </button>

                  {/* Layer Thumbnail */}
                  <div className="w-9 h-9 rounded border border-zinc-300 dark:border-zinc-700 overflow-hidden shrink-0 checkerboard-bg flex items-center justify-center">
                    {layer.type === 'raster' && layer.thumbnailDataUrl ? (
                      <img
                        src={layer.thumbnailDataUrl}
                        alt={layer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : layer.type === 'adjustment' ? (
                      <Sliders className="w-4 h-4 text-blue-400" />
                    ) : layer.type === 'text' ? (
                      <Type className="w-4 h-4 text-zinc-300" />
                    ) : (
                      <Square className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>

                  {/* Layer Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate text-zinc-900 dark:text-zinc-100">
                        {layer.name}
                      </span>
                      {layer.locked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-mono-nums">
                      <span className="capitalize">{layer.type === 'adjustment' ? 'Non-Destruktif' : layer.type}</span>
                      <span>·</span>
                      <span>{layer.opacity}%</span>
                      {layer.maskEnabled && (
                        <>
                          <span>·</span>
                          <span className="text-blue-500">Mask</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Layer Bottom Action Bar */}
          <div className="p-2 border-t border-zinc-300 dark:border-[#2a2a32] flex items-center justify-between gap-1 shrink-0 bg-zinc-50 dark:bg-[#17171b]">
            <div className="flex items-center gap-1">
              <button
                onClick={props.onAddRasterLayer}
                title="Tambah Layer Raster Baru"
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTab('adjust')}
                title="Tambah Lapisan Penyesuaian Non-Destruktif"
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-blue-500"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button
                onClick={props.onDuplicateLayer}
                title="Duplikasi Layer"
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={props.onMergeDown}
                title="Gabungkan ke Bawah"
                className="px-2 h-8 rounded text-[11px] font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
              >
                Merge
              </button>
            </div>
            <button
              onClick={() => activeLayer && props.onDeleteLayer(activeLayer.id)}
              disabled={props.layers.length <= 1}
              title="Hapus Layer Aktif"
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/15 text-red-500 disabled:opacity-35"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: NON-DESTRUCTIVE ADJUSTMENT LAYERS */}
      {tab === 'adjust' && (
        <div className="flex-1 overflow-y-auto studio-scroll p-3 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-display">
              Tambah Lapisan Penyesuaian Non-Destruktif
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              Menyesuaikan warna dan pencahayaan secara live tanpa merusak piksel asli.
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {ADJUSTMENT_TYPES.map((adj) => (
                <button
                  key={adj.type}
                  onClick={() => props.onAddAdjustmentLayer(adj.type)}
                  className="px-2.5 py-2 rounded-lg text-left text-[11px] font-medium bg-white dark:bg-[#222229] border border-zinc-300 dark:border-[#30303a] hover:border-blue-500 text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  {adj.label}
                </button>
              ))}
            </div>
          </div>

          {activeLayer?.type === 'adjustment' && activeLayer.adjustmentParams && activeLayer.adjustmentType ? (
            <div className="pt-3 border-t border-zinc-300 dark:border-[#2a2a32] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-500">{activeLayer.name}</span>
                <span className="text-[10px] text-zinc-500 font-mono-nums">Live Non-Destruktif</span>
              </div>

              {activeLayer.adjustmentType === 'brightness-contrast' && (
                <>
                  <SliderRow
                    label="Brightness"
                    value={activeLayer.adjustmentParams.brightness}
                    min={-100}
                    max={100}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { brightness: v })}
                  />
                  <SliderRow
                    label="Contrast"
                    value={activeLayer.adjustmentParams.contrast}
                    min={-100}
                    max={100}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { contrast: v })}
                  />
                </>
              )}

              {activeLayer.adjustmentType === 'hue-saturation' && (
                <>
                  <SliderRow
                    label="Hue (°)"
                    value={activeLayer.adjustmentParams.hue}
                    min={-180}
                    max={180}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { hue: v })}
                  />
                  <SliderRow
                    label="Saturation"
                    value={activeLayer.adjustmentParams.saturation}
                    min={-100}
                    max={100}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { saturation: v })}
                  />
                  <SliderRow
                    label="Lightness"
                    value={activeLayer.adjustmentParams.lightness}
                    min={-100}
                    max={100}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { lightness: v })}
                  />
                </>
              )}

              {activeLayer.adjustmentType === 'exposure' && (
                <>
                  <SliderRow
                    label="Exposure (EV)"
                    value={activeLayer.adjustmentParams.exposure}
                    min={-3}
                    max={3}
                    step={0.1}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { exposure: v })}
                  />
                  <SliderRow
                    label="Gamma"
                    value={activeLayer.adjustmentParams.gamma}
                    min={0.2}
                    max={3}
                    step={0.05}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { gamma: v })}
                  />
                </>
              )}

              {activeLayer.adjustmentType === 'levels' && (
                <>
                  <SliderRow
                    label="Black Point"
                    value={activeLayer.adjustmentParams.blackPoint}
                    min={0}
                    max={120}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { blackPoint: v })}
                  />
                  <SliderRow
                    label="White Point"
                    value={activeLayer.adjustmentParams.whitePoint}
                    min={135}
                    max={255}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { whitePoint: v })}
                  />
                  <SliderRow
                    label="Midtone Gamma"
                    value={activeLayer.adjustmentParams.gamma}
                    min={0.2}
                    max={3}
                    step={0.05}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { gamma: v })}
                  />
                </>
              )}

              {activeLayer.adjustmentType === 'color-balance' && (
                <>
                  <SliderRow
                    label="Cyan — Red"
                    value={activeLayer.adjustmentParams.redShift}
                    min={-100}
                    max={100}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { redShift: v })}
                  />
                  <SliderRow
                    label="Magenta — Green"
                    value={activeLayer.adjustmentParams.greenShift}
                    min={-100}
                    max={100}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { greenShift: v })}
                  />
                  <SliderRow
                    label="Yellow — Blue"
                    value={activeLayer.adjustmentParams.blueShift}
                    min={-100}
                    max={100}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { blueShift: v })}
                  />
                </>
              )}

              {activeLayer.adjustmentType === 'vibrance' && (
                <SliderRow
                  label="Vibrance"
                  value={activeLayer.adjustmentParams.vibrance}
                  min={-100}
                  max={100}
                  onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { vibrance: v })}
                />
              )}

              {activeLayer.adjustmentType === 'black-white' && (
                <>
                  <SliderRow
                    label="Red Mix"
                    value={activeLayer.adjustmentParams.bwWeightR}
                    min={0}
                    max={100}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { bwWeightR: v })}
                  />
                  <SliderRow
                    label="Green Mix"
                    value={activeLayer.adjustmentParams.bwWeightG}
                    min={0}
                    max={100}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { bwWeightG: v })}
                  />
                  <SliderRow
                    label="Blue Mix"
                    value={activeLayer.adjustmentParams.bwWeightB}
                    min={0}
                    max={100}
                    onChange={(v) => props.onUpdateAdjustment(activeLayer.id, { bwWeightB: v })}
                  />
                </>
              )}

              {activeLayer.adjustmentType === 'invert' && (
                <p className="text-xs text-zinc-500">
                  Lapisan Invert aktif. Atur Opacity di tab Layers untuk memadukan efek inversi.
                </p>
              )}
            </div>
          ) : (
            <div className="pt-3 border-t border-zinc-300 dark:border-[#2a2a32] text-xs text-zinc-500 dark:text-zinc-400">
              Pilih atau buat lapisan penyesuaian di atas untuk mengedit parameter secara non-destruktif.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CUSTOM BRUSHES & STYLUS PRESSURE */}
      {tab === 'brush' && (
        <div className="flex-1 overflow-y-auto studio-scroll p-3 space-y-4">
          {/* Preset List */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-display mb-2">
              Preset Brush & Stylus
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto studio-scroll pr-1">
              {props.brushes.map((b) => (
                <button
                  key={b.id}
                  onClick={() => props.onSelectBrush(b)}
                  className={`w-full px-2.5 py-2 rounded-lg text-left flex items-center justify-between text-xs border transition-colors ${
                    props.activeBrush.id === b.id
                      ? 'bg-blue-600/15 border-blue-500 text-blue-600 dark:text-blue-300'
                      : 'bg-white dark:bg-[#222229] border-zinc-300 dark:border-[#30303a] text-zinc-700 dark:text-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <span className="font-medium truncate">{b.name}</span>
                  <span className="text-[10px] font-mono-nums opacity-70 shrink-0 ml-2">
                    {b.size}px · {b.tipType}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Live Stylus Test Pad */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Uji Goresan Stylus</span>
              <button
                onClick={() => {
                  const ctx = testCanvasRef.current?.getContext('2d');
                  if (ctx && testCanvasRef.current) {
                    ctx.clearRect(0, 0, testCanvasRef.current.width, testCanvasRef.current.height);
                  }
                }}
                className="text-[10px] text-blue-500 hover:underline"
              >
                Bersihkan
              </button>
            </div>
            <canvas
              ref={testCanvasRef}
              width={260}
              height={72}
              onPointerDown={(e) => {
                testDrawingRef.current = true;
                handleTestPadDraw(e);
              }}
              onPointerMove={(e) => {
                if (testDrawingRef.current) handleTestPadDraw(e);
              }}
              onPointerUp={() => (testDrawingRef.current = false)}
              onPointerLeave={() => (testDrawingRef.current = false)}
              className="w-full h-[72px] rounded-lg bg-[#111115] border border-zinc-300 dark:border-[#30303a] touch-none cursor-crosshair"
            />
          </div>

          {/* Brush Geometry & Pressure Controls */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-300 dark:border-[#2a2a32]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-600 dark:text-zinc-400">Ujung Brush</span>
              <select
                value={props.activeBrush.tipType}
                onChange={(e) => props.onUpdateBrush({ tipType: e.target.value as BrushTipType })}
                className="px-2 py-1 rounded bg-white dark:bg-[#141418] border border-zinc-300 dark:border-[#32323d] text-xs"
              >
                <option value="round">Round Soft/Hard</option>
                <option value="chisel">Calligraphy Chisel</option>
                <option value="bristle">Oil Bristle</option>
                <option value="charcoal">Charcoal Dry</option>
                <option value="spray">Airbrush Spray</option>
              </select>
            </div>

            <SliderRow label="Hardness" value={props.activeBrush.hardness} min={0} max={100} onChange={(v) => props.onUpdateBrush({ hardness: v })} />
            <SliderRow label="Spacing (%)" value={props.activeBrush.spacing} min={1} max={150} onChange={(v) => props.onUpdateBrush({ spacing: v })} />
            <SliderRow label="Scatter (%)" value={props.activeBrush.scatter} min={0} max={150} onChange={(v) => props.onUpdateBrush({ scatter: v })} />
            <SliderRow label="Sudut (°)" value={props.activeBrush.angle} min={0} max={360} onChange={(v) => props.onUpdateBrush({ angle: v })} />
            <SliderRow label="Roundness (%)" value={props.activeBrush.roundness} min={10} max={100} onChange={(v) => props.onUpdateBrush({ roundness: v })} />
            <SliderRow
              label="Kurva Tekanan Stylus"
              value={props.pressureCurve}
              min={0.3}
              max={2.5}
              step={0.1}
              onChange={props.onChangePressureCurve}
            />

            <div className="flex items-center gap-3 pt-1 text-[11px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={props.activeBrush.pressureSize}
                  onChange={(e) => props.onUpdateBrush({ pressureSize: e.target.checked })}
                />
                Tekanan → Ukuran
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={props.activeBrush.pressureOpacity}
                  onChange={(e) => props.onUpdateBrush({ pressureOpacity: e.target.checked })}
                />
                Tekanan → Opacity
              </label>
            </div>
          </div>

          {/* Save Custom Brush Preset */}
          <div className="pt-2 border-t border-zinc-300 dark:border-[#2a2a32] flex gap-1.5">
            <input
              type="text"
              value={newBrushName}
              onChange={(e) => setNewBrushName(e.target.value)}
              placeholder="Nama preset brush baru..."
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#141418] border border-zinc-300 dark:border-[#32323d] text-xs outline-none focus:border-blue-500"
            />
            <button
              onClick={() => {
                if (newBrushName.trim()) {
                  props.onSaveCustomBrush(newBrushName.trim());
                  setNewBrushName('');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shrink-0 flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              Simpan
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORY & AUTO-BACKUPS */}
      {tab === 'history' && (
        <div className="flex-1 overflow-y-auto studio-scroll p-3 space-y-4">
          <div>
            <h3 className="text-xs font-semibold font-display mb-2">Riwayat Edit Sesi Ini</h3>
            <div className="space-y-1 max-h-44 overflow-y-auto studio-scroll">
              {props.historyLabels.map((label, idx) => (
                <button
                  key={`${label}-${idx}`}
                  onClick={() => props.onJumpHistory(idx)}
                  className={`w-full px-2.5 py-1.5 rounded text-left text-xs flex items-center justify-between transition-colors ${
                    idx === props.historyIndex
                      ? 'bg-blue-600 text-white font-medium'
                      : idx > props.historyIndex
                      ? 'text-zinc-400 dark:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="truncate">{label}</span>
                  <span className="text-[10px] font-mono-nums opacity-70">#{idx + 1}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-300 dark:border-[#2a2a32]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold font-display">Pencadangan Otomatis</h3>
              <button
                onClick={props.onCreateBackupNow}
                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-medium text-white"
              >
                Cadangkan
              </button>
            </div>

            {props.backups.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Belum ada cadangan otomatis. Sistem mencadangkan progres setiap 45 detik atau saat Anda menekan Cadangkan.
              </p>
            ) : (
              <div className="space-y-2">
                {props.backups.map((bk) => (
                  <div
                    key={bk.id}
                    className="p-2 rounded-lg bg-white dark:bg-[#222229] border border-zinc-300 dark:border-[#30303a] flex items-center gap-2.5"
                  >
                    {bk.thumbnailUrl ? (
                      <img
                        src={bk.thumbnailUrl}
                        alt={bk.label}
                        className="w-11 h-9 rounded object-cover border border-zinc-700 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-9 rounded bg-zinc-800 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{bk.label}</div>
                      <div className="text-[10px] text-zinc-500 font-mono-nums">
                        {new Date(bk.createdAtMs).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {bk.layerCount} layer
                      </div>
                    </div>
                    {bk.layers && (
                      <button
                        onClick={() => props.onRestoreBackup(bk)}
                        title="Pulihkan Snapshot Ini"
                        className="p-1.5 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Docked Right Inspector */}
      <aside className="hidden lg:flex w-[300px] shrink-0 border-l border-zinc-300 dark:border-[#2a2a32] h-full overflow-hidden">
        <div className="w-full h-full">{content}</div>
      </aside>

      {/* Android / Mobile Slide-Over Inspector Drawer */}
      {props.mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
          <div className="fixed inset-0 bg-black/55" onClick={props.onCloseMobile} />
          <div className="relative w-[310px] max-w-[88vw] h-full shadow-2xl border-l border-zinc-300 dark:border-[#2a2a32]">
            {content}
          </div>
        </div>
      )}
    </>
  );
};

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, onChange }) => (
  <label className="block space-y-1">
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="font-mono-nums text-zinc-800 dark:text-zinc-200">{Number(value.toFixed(2))}</span>
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
