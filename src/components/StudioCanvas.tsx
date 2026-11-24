import React, { useEffect, useRef, useState } from 'react';
import {
  compositeLayers,
  drawBrushSegment,
  floodFillCanvas,
  stampBrushDab,
} from '../lib/canvasEngine';
import type {
  BrushPreset,
  CollabComment,
  CollabPeer,
  SelectionRect,
  StudioLayer,
  StylusTelemetry,
  ToolId,
} from '../types/studio';

interface StudioCanvasProps {
  width: number;
  height: number;
  layers: StudioLayer[];
  activeLayerId: string;
  renderVersion: number;
  activeTool: ToolId;
  activeBrush: BrushPreset;
  foregroundColor: string;
  backgroundColor: string;
  pressureCurve: number;
  stylusOnly: boolean;
  zoom: number;
  pan: { x: number; y: number };
  onChangeZoom: (z: number) => void;
  onChangePan: (p: { x: number; y: number }) => void;
  selection: SelectionRect | null;
  onChangeSelection: (rect: SelectionRect | null) => void;
  shapeType: 'rectangle' | 'ellipse' | 'rounded' | 'line';
  shapeStrokeWidth: number;
  textSize: number;
  textFont: string;
  peers: CollabPeer[];
  comments: CollabComment[];
  onStrokeComplete: (layerId: string) => void;
  onMoveLayer: (layerId: string, dx: number, dy: number, commit: boolean) => void;
  onPickColor: (hex: string) => void;
  onAddTextAt: (x: number, y: number, content: string) => void;
  onAddShapeRect: (x: number, y: number, w: number, h: number) => void;
  onAddCommentPin: (x: number, y: number, text: string, urgent: boolean) => void;
  onPointerMoveCollab: (x: number, y: number, pressure: number, tool: string) => void;
  onStylusTelemetry: (t: StylusTelemetry) => void;
  onDisplayCanvasRef: (canvas: HTMLCanvasElement | null) => void;
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  width,
  height,
  layers,
  activeLayerId,
  renderVersion,
  activeTool,
  activeBrush,
  foregroundColor,
  pressureCurve,
  stylusOnly,
  zoom,
  pan,
  onChangeZoom,
  onChangePan,
  selection,
  onChangeSelection,
  shapeType,
  shapeStrokeWidth,
  peers,
  comments,
  onStrokeComplete,
  onMoveLayer,
  onPickColor,
  onAddTextAt,
  onAddShapeRect,
  onAddCommentPin,
  onPointerMoveCollab,
  onStylusTelemetry,
  onDisplayCanvasRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number; p: number; t: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [cursorCanvasPos, setCursorCanvasPos] = useState<{ x: number; y: number } | null>(null);
  const [shapePreview, setShapePreview] = useState<SelectionRect | null>(null);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [textModalPos, setTextModalPos] = useState<{ x: number; y: number } | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [pinModalPos, setPinModalPos] = useState<{ x: number; y: number } | null>(null);
  const [pinDraft, setPinDraft] = useState('');
  const [pinUrgent, setPinUrgent] = useState(false);

  // Two-finger Android pinch zoom tracking
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    onDisplayCanvasRef(displayCanvasRef.current);
  }, [onDisplayCanvasRef]);

  // Re-composite visible layers whenever layers or renderVersion changes
  useEffect(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    compositeLayers(canvas, layers, width, height);
  }, [layers, width, height, renderVersion]);

  // Spacebar temporary Hand/Pan tool (Photoshop muscle memory)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSpacePressed(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const clientToCanvas = (clientX: number, clientY: number) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height,
    };
  };

  const getEffectivePressure = (e: React.PointerEvent, prev: { x: number; y: number; t: number } | null) => {
    if (e.pointerType === 'pen' && e.pressure > 0) {
      return Math.min(1, Math.max(0.05, e.pressure));
    }
    if (e.pressure > 0 && e.pressure !== 0.5) {
      return Math.min(1, Math.max(0.1, e.pressure));
    }
    // Smooth velocity-responsive pressure for mouse/finger
    if (!prev) return 0.72;
    const dt = Math.max(4, performance.now() - prev.t);
    const pt = clientToCanvas(e.clientX, e.clientY);
    const speed = Math.hypot(pt.x - prev.x, pt.y - prev.y) / dt;
    return Math.min(0.95, Math.max(0.32, 0.85 - speed * 0.14));
  };

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch zoom on Android / touch devices
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartRef.current = { dist, zoom };
      isDrawingRef.current = false;
      return;
    }

    const pt = clientToCanvas(e.clientX, e.clientY);
    const effectiveTool: ToolId = spacePressed || e.button === 1 ? 'hand' : activeTool;

    if (effectiveTool === 'hand') {
      dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (effectiveTool === 'zoom') {
      onChangeZoom(e.altKey ? Math.max(0.15, zoom / 1.25) : Math.min(6, zoom * 1.25));
      return;
    }

    if (effectiveTool === 'eyedropper') {
      const ctx = displayCanvasRef.current?.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const px = Math.min(width - 1, Math.max(0, Math.floor(pt.x)));
        const py = Math.min(height - 1, Math.max(0, Math.floor(pt.y)));
        const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
        const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
        onPickColor(hex);
      }
      return;
    }

    if (effectiveTool === 'text') {
      setTextModalPos(pt);
      setTextDraft('');
      return;
    }

    if (effectiveTool === 'pin') {
      setPinModalPos(pt);
      setPinDraft('');
      setPinUrgent(false);
      return;
    }

    if (effectiveTool === 'move') {
      if (!activeLayer || activeLayer.locked) return;
      dragStartRef.current = { x: pt.x, y: pt.y, panX: 0, panY: 0 };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (effectiveTool === 'marquee' || effectiveTool === 'crop' || effectiveTool === 'shape') {
      dragStartRef.current = { x: pt.x, y: pt.y, panX: 0, panY: 0 };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (effectiveTool === 'lasso') {
      setLassoPoints([pt]);
      isDrawingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (effectiveTool === 'fill') {
      if (!activeLayer || activeLayer.locked || activeLayer.type !== 'raster' || !activeLayer.canvas) return;
      floodFillCanvas(activeLayer.canvas, pt.x - activeLayer.x, pt.y - activeLayer.y, foregroundColor);
      if (displayCanvasRef.current) compositeLayers(displayCanvasRef.current, layers, width, height);
      onStrokeComplete(activeLayer.id);
      return;
    }

    if (effectiveTool === 'brush' || effectiveTool === 'eraser') {
      if (stylusOnly && e.pointerType === 'touch') return; // Android palm rejection
      if (!activeLayer || activeLayer.locked || activeLayer.type !== 'raster') return;
      const targetCanvas =
        activeLayer.editingMask && activeLayer.maskCanvas ? activeLayer.maskCanvas : activeLayer.canvas;
      if (!targetCanvas) return;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      const p = getEffectivePressure(e, null);
      const lx = pt.x - (activeLayer.editingMask ? 0 : activeLayer.x);
      const ly = pt.y - (activeLayer.editingMask ? 0 : activeLayer.y);

      const isMaskErase = activeLayer.editingMask && foregroundColor.toLowerCase() === '#000000';
      const eraseMode = effectiveTool === 'eraser' || isMaskErase;

      ctx.save();
      if (selection) {
        ctx.beginPath();
        ctx.rect(
          selection.x - (activeLayer.editingMask ? 0 : activeLayer.x),
          selection.y - (activeLayer.editingMask ? 0 : activeLayer.y),
          selection.width,
          selection.height
        );
        ctx.clip();
      }
      stampBrushDab(
        ctx,
        lx,
        ly,
        p,
        activeBrush,
        activeLayer.editingMask ? '#ffffff' : foregroundColor,
        eraseMode,
        pressureCurve
      );
      ctx.restore();

      lastPointRef.current = { x: pt.x, y: pt.y, p, t: performance.now() };
      onStylusTelemetry({
        pointerType: e.pointerType,
        pressure: p,
        tiltX: e.tiltX || 0,
        tiltY: e.tiltY || 0,
        isDrawing: true,
      });

      if (displayCanvasRef.current) compositeLayers(displayCanvasRef.current, layers, width, height);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scale = dist / Math.max(10, pinchStartRef.current.dist);
      onChangeZoom(Math.min(6, Math.max(0.15, pinchStartRef.current.zoom * scale)));
      return;
    }

    const pt = clientToCanvas(e.clientX, e.clientY);
    setCursorCanvasPos(pt);
    onPointerMoveCollab(pt.x, pt.y, e.pressure || 0, activeTool);

    const effectiveTool: ToolId = spacePressed ? 'hand' : activeTool;

    if (effectiveTool === 'hand' && dragStartRef.current) {
      onChangePan({
        x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
        y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
      });
      return;
    }

    if (effectiveTool === 'move' && dragStartRef.current && activeLayer) {
      const dx = pt.x - dragStartRef.current.x;
      const dy = pt.y - dragStartRef.current.y;
      dragStartRef.current.x = pt.x;
      dragStartRef.current.y = pt.y;
      onMoveLayer(activeLayer.id, dx, dy, false);
      return;
    }

    if ((effectiveTool === 'marquee' || effectiveTool === 'crop') && dragStartRef.current) {
      const x = Math.min(dragStartRef.current.x, pt.x);
      const y = Math.min(dragStartRef.current.y, pt.y);
      const w = Math.abs(pt.x - dragStartRef.current.x);
      const h = Math.abs(pt.y - dragStartRef.current.y);
      onChangeSelection({ x, y, width: w, height: h });
      return;
    }

    if (effectiveTool === 'shape' && dragStartRef.current) {
      setShapePreview({
        x: Math.min(dragStartRef.current.x, pt.x),
        y: Math.min(dragStartRef.current.y, pt.y),
        width: Math.abs(pt.x - dragStartRef.current.x),
        height: Math.abs(pt.y - dragStartRef.current.y),
      });
      return;
    }

    if (effectiveTool === 'lasso' && isDrawingRef.current) {
      setLassoPoints((prev) => [...prev, pt]);
      return;
    }

    if ((effectiveTool === 'brush' || effectiveTool === 'eraser') && isDrawingRef.current && lastPointRef.current && activeLayer) {
      const targetCanvas =
        activeLayer.editingMask && activeLayer.maskCanvas ? activeLayer.maskCanvas : activeLayer.canvas;
      if (!targetCanvas) return;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      const p = getEffectivePressure(e, lastPointRef.current);
      const ox = activeLayer.editingMask ? 0 : activeLayer.x;
      const oy = activeLayer.editingMask ? 0 : activeLayer.y;
      const isMaskErase = activeLayer.editingMask && foregroundColor.toLowerCase() === '#000000';
      const eraseMode = effectiveTool === 'eraser' || isMaskErase;

      ctx.save();
      if (selection) {
        ctx.beginPath();
        ctx.rect(selection.x - ox, selection.y - oy, selection.width, selection.height);
        ctx.clip();
      }
      drawBrushSegment(
        ctx,
        lastPointRef.current.x - ox,
        lastPointRef.current.y - oy,
        lastPointRef.current.p,
        pt.x - ox,
        pt.y - oy,
        p,
        activeBrush,
        activeLayer.editingMask ? '#ffffff' : foregroundColor,
        eraseMode,
        pressureCurve
      );
      ctx.restore();

      lastPointRef.current = { x: pt.x, y: pt.y, p, t: performance.now() };
      onStylusTelemetry({
        pointerType: e.pointerType,
        pressure: p,
        tiltX: e.tiltX || 0,
        tiltY: e.tiltY || 0,
        isDrawing: true,
      });

      if (displayCanvasRef.current) compositeLayers(displayCanvasRef.current, layers, width, height);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }

    if (activeTool === 'move' && dragStartRef.current && activeLayer) {
      onMoveLayer(activeLayer.id, 0, 0, true);
    }

    if (activeTool === 'shape' && shapePreview && shapePreview.width > 4 && shapePreview.height > 4) {
      onAddShapeRect(shapePreview.x, shapePreview.y, shapePreview.width, shapePreview.height);
      setShapePreview(null);
    }

    if (activeTool === 'lasso' && isDrawingRef.current && lassoPoints.length > 3) {
      const xs = lassoPoints.map((p) => p.x);
      const ys = lassoPoints.map((p) => p.y);
      const minX = Math.max(0, Math.min(...xs));
      const minY = Math.max(0, Math.min(...ys));
      const maxX = Math.min(width, Math.max(...xs));
      const maxY = Math.min(height, Math.max(...ys));
      if (maxX - minX > 4 && maxY - minY > 4) {
        onChangeSelection({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
      }
      setLassoPoints([]);
    }

    if (isDrawingRef.current && (activeTool === 'brush' || activeTool === 'eraser') && activeLayer) {
      onStrokeComplete(activeLayer.id);
      onStylusTelemetry({
        pointerType: e.pointerType,
        pressure: 0,
        tiltX: 0,
        tiltY: 0,
        isDrawing: false,
      });
    }

    isDrawingRef.current = false;
    lastPointRef.current = null;
    dragStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || activeTool === 'zoom') {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      onChangeZoom(Math.min(6, Math.max(0.15, zoom * factor)));
    } else {
      onChangePan({ x: pan.x - e.deltaX * 0.6, y: pan.y - e.deltaY * 0.6 });
    }
  };

  const cursorClass =
    spacePressed || activeTool === 'hand'
      ? 'cursor-grab active:cursor-grabbing'
      : activeTool === 'zoom'
      ? 'cursor-zoom-in'
      : activeTool === 'move'
      ? 'cursor-move'
      : activeTool === 'brush' || activeTool === 'eraser'
      ? 'cursor-crosshair'
      : 'cursor-crosshair';

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => setCursorCanvasPos(null)}
      onWheel={handleWheel}
      className={`relative flex-1 overflow-hidden bg-zinc-200 dark:bg-[#111114] touch-none select-none flex items-center justify-center ${cursorClass}`}
    >
      {/* Transformed Artboard Container */}
      <div
        className="relative shadow-2xl ring-1 ring-black/40 checkerboard-bg"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <canvas ref={displayCanvasRef} width={width} height={height} className="block w-full h-full" />

        {/* Selection / Crop Marching Box */}
        {selection && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-blue-400 bg-blue-500/10"
            style={{
              left: `${selection.x}px`,
              top: `${selection.y}px`,
              width: `${selection.width}px`,
              height: `${selection.height}px`,
            }}
          />
        )}

        {/* Shape Preview */}
        {shapePreview && (
          <div
            className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/15"
            style={{
              left: `${shapePreview.x}px`,
              top: `${shapePreview.y}px`,
              width: `${shapePreview.width}px`,
              height: `${shapePreview.height}px`,
              borderRadius: shapeType === 'ellipse' ? '9999px' : shapeType === 'rounded' ? '16px' : '0px',
              borderWidth: `${Math.max(1, shapeStrokeWidth)}px`,
            }}
          />
        )}

        {/* Lasso Preview SVG */}
        {lassoPoints.length > 1 && (
          <svg className="pointer-events-none absolute inset-0 w-full h-full">
            <polyline
              fill="rgba(59,130,246,0.12)"
              stroke="#60a5fa"
              strokeWidth={2 / zoom}
              strokeDasharray={`${4 / zoom} ${4 / zoom}`}
              points={lassoPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          </svg>
        )}

        {/* Live Brush Ring Preview */}
        {cursorCanvasPos && (activeTool === 'brush' || activeTool === 'eraser') && (
          <div
            className="pointer-events-none absolute rounded-full border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.65)]"
            style={{
              left: `${cursorCanvasPos.x - activeBrush.size / 2}px`,
              top: `${cursorCanvasPos.y - activeBrush.size / 2}px`,
              width: `${activeBrush.size}px`,
              height: `${activeBrush.size}px`,
            }}
          />
        )}

        {/* Live Collaborator Cursors */}
        {peers.map((peer) => (
          <div
            key={peer.clientId}
            className="pointer-events-none absolute z-20 transition-transform duration-75"
            style={{
              left: `${peer.x}px`,
              top: `${peer.y}px`,
              transform: `scale(${1 / Math.max(0.35, zoom)})`,
              transformOrigin: 'top left',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 2L7.5 16L10 10L16 7.5L2 2Z" fill={peer.color} stroke="#fff" strokeWidth="1.5" />
            </svg>
            <div
              className="mt-0.5 ml-3 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap shadow"
              style={{ backgroundColor: peer.color }}
            >
              {peer.name}
            </div>
          </div>
        ))}

        {/* Collaborative Comment Pins */}
        {comments
          .filter((c) => !c.resolved)
          .map((comment, idx) => (
            <div
              key={comment.id}
              title={`${comment.authorName}: ${comment.text}`}
              className={`absolute z-10 w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2 border-white ${
                comment.urgent ? 'bg-red-600' : 'bg-blue-600'
              }`}
              style={{
                left: `${comment.x}px`,
                top: `${comment.y}px`,
                transform: `scale(${1 / Math.max(0.5, zoom)})`,
              }}
            >
              {idx + 1}
            </div>
          ))}
      </div>

      {/* Inline Text Layer Creation Popover */}
      {textModalPos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#1e1e24] border border-zinc-300 dark:border-zinc-700 p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white font-display">
              Tambahkan Layer Teks
            </h3>
            <textarea
              rows={3}
              autoFocus
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Ketik judul atau teks desain..."
              className="mt-3 w-full rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 p-2.5 text-sm text-zinc-900 dark:text-white outline-none focus:border-blue-500"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setTextModalPos(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (textDraft.trim()) {
                    onAddTextAt(textModalPos.x, textModalPos.y, textDraft.trim());
                  }
                  setTextModalPos(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
              >
                Tempatkan Teks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Comment Pin Modal */}
      {pinModalPos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#1e1e24] border border-zinc-300 dark:border-zinc-700 p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white font-display">
              Pin Komentar Kolaborasi
            </h3>
            <textarea
              rows={3}
              autoFocus
              value={pinDraft}
              onChange={(e) => setPinDraft(e.target.value)}
              placeholder="Catatan revisi untuk tim..."
              className="mt-3 w-full rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 p-2.5 text-sm text-zinc-900 dark:text-white outline-none focus:border-blue-500"
            />
            <label className="mt-2.5 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={pinUrgent}
                onChange={(e) => setPinUrgent(e.target.checked)}
                className="rounded border-zinc-500"
              />
              <span>Tandai Mendesak (kirim notifikasi push ke anggota ruang)</span>
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setPinModalPos(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (pinDraft.trim()) {
                    onAddCommentPin(pinModalPos.x, pinModalPos.y, pinDraft.trim(), pinUrgent);
                  }
                  setPinModalPos(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
              >
                Kirim Pin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiet Canvas Dimension Readout (Bottom-Left) */}
      <div className="pointer-events-none absolute bottom-2.5 left-3 flex items-center gap-2 text-[11px] font-mono-nums text-zinc-600 dark:text-zinc-400">
        <span>{width} × {height} px</span>
        <span>·</span>
        <span>{Math.round(zoom * 100)}%</span>
        {activeLayer?.editingMask && (
          <>
            <span>·</span>
            <span className="text-amber-500 font-medium">Mode Masking Aktif</span>
          </>
        )}
      </div>
    </div>
  );
};
