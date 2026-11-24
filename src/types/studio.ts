export type ToolId =
  | 'move'
  | 'marquee'
  | 'lasso'
  | 'brush'
  | 'eraser'
  | 'fill'
  | 'text'
  | 'shape'
  | 'eyedropper'
  | 'crop'
  | 'pin'
  | 'hand'
  | 'zoom';

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export type LayerType = 'raster' | 'text' | 'shape' | 'adjustment';

export type AdjustmentType =
  | 'brightness-contrast'
  | 'hue-saturation'
  | 'exposure'
  | 'levels'
  | 'color-balance'
  | 'black-white'
  | 'vibrance'
  | 'invert';

export interface AdjustmentParams {
  brightness: number; // -100..100
  contrast: number; // -100..100
  hue: number; // -180..180
  saturation: number; // -100..100
  lightness: number; // -100..100
  exposure: number; // -3..3
  gamma: number; // 0.2..3.0
  blackPoint: number; // 0..100
  whitePoint: number; // 155..255
  redShift: number; // -100..100
  greenShift: number; // -100..100
  blueShift: number; // -100..100
  vibrance: number; // -100..100
  bwWeightR: number; // 0..100
  bwWeightG: number; // 0..100
  bwWeightB: number; // 0..100
}

export interface LayerEffects {
  dropShadow: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
    opacity: number;
  };
  outerGlow: {
    enabled: boolean;
    color: string;
    blur: number;
    opacity: number;
  };
  stroke: {
    enabled: boolean;
    color: string;
    width: number;
  };
}

export interface TextLayerData {
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  fontWeight: '400' | '600' | '700';
  align: 'left' | 'center' | 'right';
}

export interface ShapeLayerData {
  shapeType: 'rectangle' | 'ellipse' | 'rounded' | 'line';
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  width: number;
  height: number;
}

export interface StudioLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0..100
  blendMode: BlendMode;
  x: number;
  y: number;
  clippingMask: boolean;
  maskEnabled: boolean;
  editingMask: boolean;
  canvas?: HTMLCanvasElement;
  maskCanvas?: HTMLCanvasElement;
  adjustmentType?: AdjustmentType;
  adjustmentParams?: AdjustmentParams;
  textData?: TextLayerData;
  shapeData?: ShapeLayerData;
  effects: LayerEffects;
  thumbnailDataUrl?: string;
}

export interface SerializedLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  x: number;
  y: number;
  clippingMask: boolean;
  maskEnabled: boolean;
  editingMask: boolean;
  imageDataUrl?: string;
  maskDataUrl?: string;
  adjustmentType?: AdjustmentType;
  adjustmentParams?: AdjustmentParams;
  textData?: TextLayerData;
  shapeData?: ShapeLayerData;
  effects: LayerEffects;
}

export type BrushTipType = 'round' | 'chisel' | 'bristle' | 'spray' | 'charcoal';

export interface BrushPreset {
  id: string;
  name: string;
  category: 'Basic' | 'Calligraphy' | 'Texture' | 'Airbrush' | 'Custom';
  size: number; // 1..500
  hardness: number; // 0..100
  opacity: number; // 1..100
  flow: number; // 1..100
  spacing: number; // 1..200 (%)
  scatter: number; // 0..200 (%)
  angle: number; // 0..360
  roundness: number; // 10..100 (%)
  pressureSize: boolean;
  pressureOpacity: boolean;
  tipType: BrushTipType;
  isBuiltIn?: boolean;
}

export interface RawDevelopSettings {
  temperature: number; // -100..100
  tint: number; // -100..100
  exposure: number; // -3..3
  contrast: number; // -100..100
  highlights: number; // -100..100
  shadows: number; // -100..100
  whites: number; // -100..100
  blacks: number; // -100..100
  clarity: number; // -100..100
  vibrance: number; // -100..100
  saturation: number; // -100..100
  noiseReduction: number; // 0..100
  sharpening: number; // 0..100
}

export interface RawFileMetadata {
  fileName: string;
  format: string;
  cameraModel: string;
  bitDepth: string;
  iso: string;
  aperture: string;
  shutter: string;
  width: number;
  height: number;
  fileSizeKb: number;
}

export interface StudioPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  isBuiltIn?: boolean;
  builtInKey?: 'halftone' | 'film-grain' | 'chromatic' | 'duotone' | 'vignette' | 'oil-paint' | 'mosaic';
  intensity?: number;
  code: string;
}

export interface AssetLibraryItem {
  id: string;
  name: string;
  category: 'Photo' | 'RAW' | 'Texture' | 'Overlay' | 'Template';
  format: string;
  width: number;
  height: number;
  fileSizeKb: number;
  tags: string[];
  previewUrl: string;
  isBuiltIn?: boolean;
  createdAtMs: number;
}

export type ColorProfile = 'sRGB' | 'AdobeRGB' | 'CMYK-Fogra39' | 'DisplayP3';

export interface ProjectMeta {
  id: string;
  title: string;
  width: number;
  height: number;
  dpi: number;
  colorProfile: ColorProfile;
  roomCode: string;
  layerCount: number;
  thumbnailUrl: string;
  updatedAtMs: number;
  syncedToCloud: boolean;
}

export interface BackupSnapshot {
  id: string;
  projectId: string;
  label: string;
  layerCount: number;
  width: number;
  height: number;
  thumbnailUrl: string;
  snapshotSummary: string;
  createdAtMs: number;
  layers?: SerializedLayer[];
  isCloud?: boolean;
}

export interface CollabPeer {
  clientId: string;
  name: string;
  color: string;
  tool: string;
  x: number;
  y: number;
  pressure: number;
  lastActive: number;
}

export interface CollabComment {
  id: string;
  authorName: string;
  authorColor: string;
  text: string;
  x: number;
  y: number;
  urgent: boolean;
  resolved: boolean;
  createdAt: number;
}

export interface PushNotificationItem {
  id: string;
  title: string;
  body: string;
  roomCode?: string;
  createdAt: number;
  urgent: boolean;
  read: boolean;
}

export interface AnalyticsSessionItem {
  id: string;
  projectId: string;
  projectTitle: string;
  durationSec: number;
  strokesCount: number;
  layersCreated: number;
  exportsCount: number;
  activeTool: string;
  dateKey: string;
  updatedAtMs: number;
}

export interface ShortcutItem {
  action: string;
  label: string;
  category: 'Alat' | 'File' | 'Layer' | 'Tampilan';
  key: string;
}

export type ShortcutMap = Record<string, string>;

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StylusTelemetry {
  pointerType: string;
  pressure: number;
  tiltX: number;
  tiltY: number;
  isDrawing: boolean;
}
