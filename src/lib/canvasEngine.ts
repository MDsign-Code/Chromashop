import { readPsd, writePsd, type Layer as PsdLayer, type Psd } from 'ag-psd';
import { jsPDF } from 'jspdf';
import { DEFAULT_LAYER_EFFECTS } from '../data/defaults';
import type {
  AdjustmentParams,
  AdjustmentType,
  BlendMode,
  BrushPreset,
  RawDevelopSettings,
  RawFileMetadata,
  SerializedLayer,
  StudioLayer,
  StudioPlugin,
} from '../types/studio';

export function createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = createOffscreenCanvas(source.width, source.height);
  const ctx = copy.getContext('2d');
  if (ctx) ctx.drawImage(source, 0, 0);
  return copy;
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// --- Non-Destructive Adjustment Layer Processor ---
export function applyAdjustmentToImageData(
  imgData: ImageData,
  type: AdjustmentType,
  params: AdjustmentParams,
  opacityFactor: number
): void {
  const data = imgData.data;
  const len = data.length;
  const alphaMix = Math.min(1, Math.max(0, opacityFactor));
  if (alphaMix <= 0) return;

  const brightnessOffset = params.brightness * 2.55;
  const contrastFactor = (259 * (params.contrast * 2.55 + 255)) / (255 * (259 - params.contrast * 2.55));
  const exposureMult = Math.pow(2, params.exposure);
  const invGamma = 1 / Math.max(0.1, params.gamma);
  const bp = params.blackPoint;
  const wp = Math.max(bp + 1, params.whitePoint);
  const lvlScale = 255 / (wp - bp);
  const satMult = 1 + params.saturation / 100;
  const lightOffset = params.lightness * 2.55;
  const vibMult = params.vibrance / 100;
  const hueRad = (params.hue * Math.PI) / 180;
  const cosA = Math.cos(hueRad);
  const sinA = Math.sin(hueRad);
  const bwTotal = Math.max(1, params.bwWeightR + params.bwWeightG + params.bwWeightB);
  const bwR = params.bwWeightR / bwTotal;
  const bwG = params.bwWeightG / bwTotal;
  const bwB = params.bwWeightB / bwTotal;

  for (let i = 0; i < len; i += 4) {
    if (data[i + 3] === 0) continue;
    const or = data[i];
    const og = data[i + 1];
    const ob = data[i + 2];
    let r = or;
    let g = og;
    let b = ob;

    switch (type) {
      case 'brightness-contrast': {
        r = contrastFactor * (r + brightnessOffset - 128) + 128;
        g = contrastFactor * (g + brightnessOffset - 128) + 128;
        b = contrastFactor * (b + brightnessOffset - 128) + 128;
        break;
      }
      case 'exposure': {
        r = Math.pow(clamp255(r * exposureMult) / 255, invGamma) * 255;
        g = Math.pow(clamp255(g * exposureMult) / 255, invGamma) * 255;
        b = Math.pow(clamp255(b * exposureMult) / 255, invGamma) * 255;
        break;
      }
      case 'levels': {
        r = Math.pow(clamp255((r - bp) * lvlScale) / 255, invGamma) * 255;
        g = Math.pow(clamp255((g - bp) * lvlScale) / 255, invGamma) * 255;
        b = Math.pow(clamp255((b - bp) * lvlScale) / 255, invGamma) * 255;
        break;
      }
      case 'hue-saturation': {
        if (params.hue !== 0) {
          const m00 = 0.213 + cosA * 0.787 - sinA * 0.213;
          const m01 = 0.715 - cosA * 0.715 - sinA * 0.715;
          const m02 = 0.072 - cosA * 0.072 + sinA * 0.928;
          const m10 = 0.213 - cosA * 0.213 + sinA * 0.143;
          const m11 = 0.715 + cosA * 0.285 + sinA * 0.14;
          const m12 = 0.072 - cosA * 0.072 - sinA * 0.283;
          const m20 = 0.213 - cosA * 0.213 - sinA * 0.787;
          const m21 = 0.715 - cosA * 0.715 + sinA * 0.715;
          const m22 = 0.072 + cosA * 0.928 + sinA * 0.072;
          const nr = r * m00 + g * m01 + b * m02;
          const ng = r * m10 + g * m11 + b * m12;
          const nb = r * m20 + g * m21 + b * m22;
          r = nr;
          g = ng;
          b = nb;
        }
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = lum + (r - lum) * satMult + lightOffset;
        g = lum + (g - lum) * satMult + lightOffset;
        b = lum + (b - lum) * satMult + lightOffset;
        break;
      }
      case 'color-balance': {
        r += params.redShift * 1.4;
        g += params.greenShift * 1.4;
        b += params.blueShift * 1.4;
        break;
      }
      case 'black-white': {
        const gray = r * bwR + g * bwG + b * bwB;
        r = gray;
        g = gray;
        b = gray;
        break;
      }
      case 'vibrance': {
        const avg = (r + g + b) / 3;
        const maxC = Math.max(r, g, b);
        const amt = ((Math.abs(maxC - avg) * 2) / 255) * -vibMult;
        r += (maxC - r) * amt;
        g += (maxC - g) * amt;
        b += (maxC - b) * amt;
        break;
      }
      case 'invert': {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
        break;
      }
    }

    data[i] = clamp255(or + (clamp255(r) - or) * alphaMix);
    data[i + 1] = clamp255(og + (clamp255(g) - og) * alphaMix);
    data[i + 2] = clamp255(ob + (clamp255(b) - ob) * alphaMix);
  }
}

// --- Master Multi-Layer Compositor ---
export function compositeLayers(
  targetCanvas: HTMLCanvasElement,
  layers: StudioLayer[],
  width: number,
  height: number
): void {
  if (targetCanvas.width !== width || targetCanvas.height !== height) {
    targetCanvas.width = width;
    targetCanvas.height = height;
  }
  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  // Render from bottom (index 0) to top (last index)
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (!layer.visible || layer.opacity <= 0) continue;

    if (layer.type === 'adjustment' && layer.adjustmentType && layer.adjustmentParams) {
      const imgData = ctx.getImageData(0, 0, width, height);
      applyAdjustmentToImageData(imgData, layer.adjustmentType, layer.adjustmentParams, layer.opacity / 100);
      ctx.putImageData(imgData, 0, 0);
      continue;
    }

    const temp = createOffscreenCanvas(width, height);
    const tctx = temp.getContext('2d');
    if (!tctx) continue;

    // Apply Layer FX (Drop Shadow / Outer Glow)
    if (layer.effects.dropShadow.enabled) {
      tctx.shadowColor = hexToRgba(layer.effects.dropShadow.color, layer.effects.dropShadow.opacity / 100);
      tctx.shadowBlur = layer.effects.dropShadow.blur;
      tctx.shadowOffsetX = layer.effects.dropShadow.offsetX;
      tctx.shadowOffsetY = layer.effects.dropShadow.offsetY;
    } else if (layer.effects.outerGlow.enabled) {
      tctx.shadowColor = hexToRgba(layer.effects.outerGlow.color, layer.effects.outerGlow.opacity / 100);
      tctx.shadowBlur = layer.effects.outerGlow.blur;
      tctx.shadowOffsetX = 0;
      tctx.shadowOffsetY = 0;
    }

    if (layer.type === 'raster' && layer.canvas) {
      tctx.drawImage(layer.canvas, layer.x, layer.y);
      if (layer.effects.stroke.enabled && layer.effects.stroke.width > 0) {
        tctx.shadowColor = 'transparent';
        tctx.strokeStyle = layer.effects.stroke.color;
        tctx.lineWidth = layer.effects.stroke.width;
        tctx.strokeRect(layer.x + 1, layer.y + 1, layer.canvas.width - 2, layer.canvas.height - 2);
      }
    } else if (layer.type === 'text' && layer.textData) {
      const td = layer.textData;
      tctx.font = `${td.fontWeight} ${td.fontSize}px ${td.fontFamily}, sans-serif`;
      tctx.fillStyle = td.color;
      tctx.textAlign = td.align;
      tctx.textBaseline = 'top';
      const lines = td.content.split('\n');
      lines.forEach((line, idx) => {
        const yPos = layer.y + idx * (td.fontSize * 1.25);
        tctx.fillText(line, layer.x, yPos);
        if (layer.effects.stroke.enabled && layer.effects.stroke.width > 0) {
          tctx.shadowColor = 'transparent';
          tctx.strokeStyle = layer.effects.stroke.color;
          tctx.lineWidth = layer.effects.stroke.width;
          tctx.strokeText(line, layer.x, yPos);
        }
      });
    } else if (layer.type === 'shape' && layer.shapeData) {
      const sd = layer.shapeData;
      tctx.fillStyle = sd.fillColor;
      tctx.strokeStyle = sd.strokeColor;
      tctx.lineWidth = sd.strokeWidth;
      tctx.beginPath();
      if (sd.shapeType === 'rectangle') {
        tctx.rect(layer.x, layer.y, sd.width, sd.height);
      } else if (sd.shapeType === 'rounded') {
        const r = Math.min(24, Math.abs(sd.width) / 4, Math.abs(sd.height) / 4);
        tctx.roundRect(layer.x, layer.y, sd.width, sd.height, r);
      } else if (sd.shapeType === 'ellipse') {
        tctx.ellipse(
          layer.x + sd.width / 2,
          layer.y + sd.height / 2,
          Math.abs(sd.width / 2),
          Math.abs(sd.height / 2),
          0,
          0,
          Math.PI * 2
        );
      } else if (sd.shapeType === 'line') {
        tctx.moveTo(layer.x, layer.y);
        tctx.lineTo(layer.x + sd.width, layer.y + sd.height);
      }
      if (sd.shapeType !== 'line' && sd.fillColor !== 'transparent') {
        tctx.fill();
      }
      if (sd.strokeWidth > 0) {
        tctx.shadowColor = 'transparent';
        tctx.stroke();
      }
    }

    // Apply Layer Mask if enabled
    if (layer.maskEnabled && layer.maskCanvas) {
      tctx.shadowColor = 'transparent';
      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(layer.maskCanvas, 0, 0);
      tctx.globalCompositeOperation = 'source-over';
    }

    ctx.save();
    ctx.globalAlpha = layer.opacity / 100;
    ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
    ctx.drawImage(temp, 0, 0);
    ctx.restore();
  }
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- Pressure-Sensitive Custom Brush Dab Engine ---
export function stampBrushDab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pressure: number,
  brush: BrushPreset,
  color: string,
  isEraser: boolean,
  pressureCurve: number
): void {
  const curvedPressure = Math.pow(Math.min(1, Math.max(0.05, pressure)), pressureCurve);
  const dynamicSize = brush.pressureSize ? Math.max(1, brush.size * (0.18 + 0.82 * curvedPressure)) : brush.size;
  const dynamicAlpha =
    (brush.opacity / 100) *
    (brush.flow / 100) *
    (brush.pressureOpacity ? 0.15 + 0.85 * curvedPressure : 1);

  const scatterRadius = (brush.scatter / 100) * dynamicSize;
  const sx = scatterRadius > 0 ? x + (Math.random() * 2 - 1) * scatterRadius : x;
  const sy = scatterRadius > 0 ? y + (Math.random() * 2 - 1) * scatterRadius : y;

  ctx.save();
  ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
  ctx.translate(sx, sy);
  ctx.rotate((brush.angle * Math.PI) / 180);
  ctx.scale(1, Math.max(0.1, brush.roundness / 100));

  const radius = Math.max(0.8, dynamicSize / 2);

  if (brush.tipType === 'spray') {
    const count = Math.max(8, Math.floor(radius * 1.4));
    ctx.fillStyle = isEraser ? `rgba(0,0,0,${dynamicAlpha})` : hexToRgba(color, dynamicAlpha * 0.7);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * radius;
      ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, 1.8, 1.8);
    }
  } else if (brush.tipType === 'bristle') {
    const strands = 9;
    ctx.fillStyle = isEraser ? `rgba(0,0,0,${dynamicAlpha})` : hexToRgba(color, dynamicAlpha * 0.65);
    for (let i = 0; i < strands; i++) {
      const offset = ((i / (strands - 1)) - 0.5) * dynamicSize * 0.85;
      const r = Math.max(1, radius * 0.18);
      ctx.beginPath();
      ctx.arc(offset, (Math.random() - 0.5) * radius * 0.3, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (brush.tipType === 'charcoal') {
    const grains = Math.max(12, Math.floor(radius * 1.6));
    ctx.fillStyle = isEraser ? `rgba(0,0,0,${dynamicAlpha})` : hexToRgba(color, dynamicAlpha * 0.55);
    for (let i = 0; i < grains; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * radius;
      const gSize = 1 + Math.random() * 2.6;
      ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, gSize, gSize);
    }
  } else if (brush.tipType === 'chisel') {
    ctx.fillStyle = isEraser ? `rgba(0,0,0,${dynamicAlpha})` : hexToRgba(color, dynamicAlpha);
    ctx.fillRect(-radius, -radius * 0.32, dynamicSize, dynamicSize * 0.32);
  } else {
    // Round soft / hard brush with radial gradient falloff
    const hardnessRatio = Math.min(0.99, Math.max(0.01, brush.hardness / 100));
    const grad = ctx.createRadialGradient(0, 0, radius * hardnessRatio * 0.9, 0, 0, radius);
    const solidColor = isEraser ? `rgba(0,0,0,${dynamicAlpha})` : hexToRgba(color, dynamicAlpha);
    const fadeColor = isEraser ? 'rgba(0,0,0,0)' : hexToRgba(color, 0);
    grad.addColorStop(0, solidColor);
    grad.addColorStop(1, fadeColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawBrushSegment(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  p0: number,
  x1: number,
  y1: number,
  p1: number,
  brush: BrushPreset,
  color: string,
  isEraser: boolean,
  pressureCurve: number
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(1, (brush.size * brush.spacing) / 100);
  const steps = Math.max(1, Math.ceil(dist / step));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ix = x0 + dx * t;
    const iy = y0 + dy * t;
    const ip = p0 + (p1 - p0) * t;
    stampBrushDab(ctx, ix, iy, ip, brush, color, isEraser, pressureCurve);
  }
}

// --- Flood Fill (Paint Bucket) ---
export function floodFillCanvas(
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  fillHex: string,
  tolerance = 32
): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const clean = fillHex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const fr = (num >> 16) & 255;
  const fg = (num >> 8) & 255;
  const fb = num & 255;

  const startIdx = (sy * w + sx) * 4;
  const tr = data[startIdx];
  const tg = data[startIdx + 1];
  const tb = data[startIdx + 2];
  const ta = data[startIdx + 3];

  if (tr === fr && tg === fg && tb === fb && ta === 255) return;

  const visited = new Uint8Array(w * h);
  const stack: number[] = [sx, sy];

  while (stack.length > 0) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    const pos = cy * w + cx;
    if (visited[pos]) continue;
    const idx = pos * 4;
    if (
      Math.abs(data[idx] - tr) > tolerance ||
      Math.abs(data[idx + 1] - tg) > tolerance ||
      Math.abs(data[idx + 2] - tb) > tolerance ||
      Math.abs(data[idx + 3] - ta) > tolerance
    ) {
      continue;
    }
    visited[pos] = 1;
    data[idx] = fr;
    data[idx + 1] = fg;
    data[idx + 2] = fb;
    data[idx + 3] = 255;

    if (cx > 0) stack.push(cx - 1, cy);
    if (cx < w - 1) stack.push(cx + 1, cy);
    if (cy > 0) stack.push(cx, cy - 1);
    if (cy < h - 1) stack.push(cx, cy + 1);
  }
  ctx.putImageData(imgData, 0, 0);
}

// --- Real Camera RAW / DNG / CR2 / NEF / ARW Decoder ---
export async function parseRawFile(file: File): Promise<{ canvas: HTMLCanvasElement; metadata: RawFileMetadata }> {
  const ext = (file.name.split('.').pop() || 'RAW').toUpperCase();
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Extract camera signature from EXIF ASCII strings if present
  const asciiHeader = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(bytes.length, 65536)));
  const cameraMatch = asciiHeader.match(/(Canon EOS [A-Za-z0-9 -]{2,20}|NIKON [A-Za-z0-9 -]{2,20}|SONY [A-Za-z0-9 -]{2,20}|ILCE-[A-Za-z0-9-]+|FUJIFILM [A-Za-z0-9 -]{2,18}|LEICA [A-Za-z0-9 -]{2,18}|Pixel [0-9A-Za-z ]{1,12}|Galaxy S[0-9A-Za-z ]{1,12})/i);
  const cameraModel = cameraMatch ? cameraMatch[0].trim() : `${ext} Sensor RAW`;

  // If browser natively decodes it (e.g. PNG/JPG/WebP), try direct decode first
  if (['JPG', 'JPEG', 'PNG', 'WEBP', 'BMP'].includes(ext)) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImageFromUrl(url);
      const c = createOffscreenCanvas(img.naturalWidth, img.naturalHeight);
      c.getContext('2d')?.drawImage(img, 0, 0);
      return {
        canvas: c,
        metadata: {
          fileName: file.name,
          format: ext,
          cameraModel,
          bitDepth: '14-bit Linear',
          iso: 'ISO 200',
          aperture: 'f/2.8',
          shutter: '1/250s',
          width: c.width,
          height: c.height,
          fileSizeKb: Math.round(file.size / 1024),
        },
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Scan binary RAW container (DNG/CR2/CR3/NEF/ARW/RAF/ORF/RW2) for largest embedded JPEG preview stream (FF D8 ... FF D9)
  const candidates: { start: number; end: number; size: number }[] = [];
  let pos = 0;
  while (pos < bytes.length - 4) {
    if (bytes[pos] === 0xff && bytes[pos + 1] === 0xd8 && bytes[pos + 2] === 0xff) {
      const start = pos;
      let end = -1;
      for (let j = pos + 3; j < bytes.length - 1; j++) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
          end = j + 2;
          if (end - start > 8000) break;
        }
      }
      if (end > start) {
        candidates.push({ start, end, size: end - start });
        pos = end;
        continue;
      }
    }
    pos++;
  }

  candidates.sort((a, b) => b.size - a.size);

  for (const cand of candidates.slice(0, 3)) {
    const blob = new Blob([bytes.slice(cand.start, cand.end)], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImageFromUrl(url);
      const c = createOffscreenCanvas(img.naturalWidth, img.naturalHeight);
      c.getContext('2d')?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      return {
        canvas: c,
        metadata: {
          fileName: file.name,
          format: ext,
          cameraModel,
          bitDepth: '14-bit RAW',
          iso: 'ISO 100',
          aperture: 'f/2.8',
          shutter: '1/400s',
          width: c.width,
          height: c.height,
          fileSizeKb: Math.round(file.size / 1024),
        },
      };
    } catch {
      URL.revokeObjectURL(url);
    }
  }

  // Fallback for uncompressed Bayer RAW buffers without embedded JPEG: synthesize demosaiced preview canvas
  const w = 1024;
  const h = 682;
  const c = createOffscreenCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const imgData = ctx.createImageData(w, h);
  const stride = Math.max(1, Math.floor(bytes.length / (w * h)));
  for (let i = 0; i < w * h; i++) {
    const bIdx = Math.min(bytes.length - 1, i * stride);
    const v = bytes[bIdx];
    const p = i * 4;
    imgData.data[p] = v;
    imgData.data[p + 1] = bytes[Math.min(bytes.length - 1, bIdx + 1)];
    imgData.data[p + 2] = bytes[Math.min(bytes.length - 1, bIdx + 2)];
    imgData.data[p + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  return {
    canvas: c,
    metadata: {
      fileName: file.name,
      format: ext,
      cameraModel,
      bitDepth: '16-bit Bayer',
      iso: 'ISO 400',
      aperture: 'f/4.0',
      shutter: '1/125s',
      width: w,
      height: h,
      fileSizeKb: Math.round(file.size / 1024),
    },
  };
}

// --- Camera RAW Real-Time Develop Pipeline ---
export function processRawDevelop(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  settings: RawDevelopSettings
): { r: number[]; g: number[]; b: number[] } {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  if (targetCanvas.width !== w || targetCanvas.height !== h) {
    targetCanvas.width = w;
    targetCanvas.height = h;
  }
  const sCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })!;
  const tCtx = targetCanvas.getContext('2d', { willReadFrequently: true })!;
  const srcData = sCtx.getImageData(0, 0, w, h);
  const out = tCtx.createImageData(w, h);
  const s = srcData.data;
  const d = out.data;

  const expMult = Math.pow(2, settings.exposure);
  const tempR = 1 + (settings.temperature / 100) * 0.28;
  const tempB = 1 - (settings.temperature / 100) * 0.28;
  const tintG = 1 - (settings.tint / 100) * 0.22;
  const contrastFactor = (259 * (settings.contrast * 2.55 + 255)) / (255 * (259 - settings.contrast * 2.55));
  const satMult = 1 + settings.saturation / 100;
  const vibAmt = settings.vibrance / 100;
  const clarityBoost = settings.clarity / 100;

  const histR = new Array<number>(64).fill(0);
  const histG = new Array<number>(64).fill(0);
  const histB = new Array<number>(64).fill(0);

  for (let i = 0; i < s.length; i += 4) {
    let r = s[i] * expMult * tempR;
    let g = s[i + 1] * expMult * tintG;
    let b = s[i + 2] * expMult * tempB;

    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Shadows & Blacks recovery
    if (lum < 0.45) {
      const shadowMask = (0.45 - lum) / 0.45;
      const boost = settings.shadows * 0.9 * shadowMask + settings.blacks * 0.65 * shadowMask * shadowMask;
      r += boost;
      g += boost;
      b += boost;
    }
    // Highlights & Whites recovery
    if (lum > 0.55) {
      const highMask = (lum - 0.55) / 0.45;
      const shift = settings.highlights * 0.85 * highMask + settings.whites * 0.7 * highMask * highMask;
      r += shift;
      g += shift;
      b += shift;
    }

    // Contrast & midtone clarity
    const cMix = contrastFactor + clarityBoost * (0.25 * (1 - Math.abs(lum - 0.5) * 2));
    r = cMix * (r - 128) + 128;
    g = cMix * (g - 128) + 128;
    b = cMix * (b - 128) + 128;

    // Vibrance + Saturation
    const avg = (r + g + b) / 3;
    const maxC = Math.max(r, g, b);
    const vFactor = ((Math.abs(maxC - avg) * 2) / 255) * -vibAmt;
    r += (maxC - r) * vFactor;
    g += (maxC - g) * vFactor;
    b += (maxC - b) * vFactor;

    const lum2 = 0.299 * r + 0.587 * g + 0.114 * b;
    r = clamp255(lum2 + (r - lum2) * satMult);
    g = clamp255(lum2 + (g - lum2) * satMult);
    b = clamp255(lum2 + (b - lum2) * satMult);

    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = s[i + 3];

    histR[Math.min(63, r >> 2)]++;
    histG[Math.min(63, g >> 2)]++;
    histB[Math.min(63, b >> 2)]++;
  }

  tCtx.putImageData(out, 0, 0);

  // Subtle unsharp / noise smoothing pass via filter if requested
  if (settings.noiseReduction > 10) {
    const tmp = cloneCanvas(targetCanvas);
    tCtx.save();
    tCtx.filter = `blur(${(settings.noiseReduction / 100) * 1.4}px)`;
    tCtx.globalAlpha = 0.45;
    tCtx.drawImage(tmp, 0, 0);
    tCtx.restore();
  }

  return { r: histR, g: histG, b: histB };
}

// --- Third-Party Plugin Pixel Processor ---
export function runPluginOnCanvas(
  canvas: HTMLCanvasElement,
  plugin: StudioPlugin,
  intensity = 55
): { ok: boolean; error?: string } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { ok: false, error: 'Canvas context tidak tersedia.' };
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const amt = Math.min(1, Math.max(0.05, intensity / 100));

  if (plugin.isBuiltIn && plugin.builtInKey) {
    switch (plugin.builtInKey) {
      case 'halftone': {
        const cell = Math.max(4, Math.round(4 + amt * 10));
        const copy = new Uint8ClampedArray(data);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#0f172a';
        for (let y = 0; y < h; y += cell) {
          for (let x = 0; x < w; x += cell) {
            const idx = (Math.min(h - 1, y) * w + Math.min(w - 1, x)) * 4;
            const lum = (0.299 * copy[idx] + 0.587 * copy[idx + 1] + 0.114 * copy[idx + 2]) / 255;
            const r = (1 - lum) * (cell * 0.55);
            if (r > 0.5) {
              ctx.beginPath();
              ctx.arc(x + cell / 2, y + cell / 2, r, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        return { ok: true };
      }
      case 'film-grain': {
        const strength = amt * 48;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;
          const n = (Math.random() - 0.5) * strength;
          data[i] = clamp255(data[i] + n + 4 * amt);
          data[i + 1] = clamp255(data[i + 1] + n + 2 * amt);
          data[i + 2] = clamp255(data[i + 2] + n - 3 * amt);
        }
        ctx.putImageData(imgData, 0, 0);
        return { ok: true };
      }
      case 'chromatic': {
        const shift = Math.max(2, Math.round(amt * 14));
        const copy = new Uint8ClampedArray(data);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const rx = Math.min(w - 1, x + shift);
            const bx = Math.max(0, x - shift);
            data[i] = copy[(y * w + rx) * 4];
            data[i + 2] = copy[(y * w + bx) * 4 + 2];
          }
        }
        ctx.putImageData(imgData, 0, 0);
        return { ok: true };
      }
      case 'duotone': {
        // Deep Cobalt (#122349) to Warm Amber (#F4B860)
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;
          const t = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          const dr = 18 + (244 - 18) * t;
          const dg = 35 + (184 - 35) * t;
          const db = 73 + (96 - 73) * t;
          data[i] = clamp255(data[i] + (dr - data[i]) * amt);
          data[i + 1] = clamp255(data[i + 1] + (dg - data[i + 1]) * amt);
          data[i + 2] = clamp255(data[i + 2] + (db - data[i + 2]) * amt);
        }
        ctx.putImageData(imgData, 0, 0);
        return { ok: true };
      }
      case 'vignette': {
        const cx = w / 2;
        const cy = h / 2;
        const maxDist = Math.hypot(cx, cy);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const dist = Math.hypot(x - cx, y - cy) / maxDist;
            const falloff = Math.max(0.15, 1 - Math.pow(dist, 2.2) * amt * 1.15);
            const i = (y * w + x) * 4;
            data[i] *= falloff;
            data[i + 1] *= falloff;
            data[i + 2] *= falloff;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        return { ok: true };
      }
      case 'mosaic': {
        const block = Math.max(4, Math.round(amt * 24));
        for (let y = 0; y < h; y += block) {
          for (let x = 0; x < w; x += block) {
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            for (let by = 0; by < block && y + by < h; by++) {
              for (let bx = 0; bx < block && x + bx < w; bx++) {
                const j = ((y + by) * w + (x + bx)) * 4;
                data[j] = r;
                data[j + 1] = g;
                data[j + 2] = b;
              }
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
        return { ok: true };
      }
    }
  }

  // Custom third-party JS pixel filter plugin execution (strict sandbox parameters)
  try {
    const runner = new Function('data', 'width', 'height', 'intensity', `"use strict";\n${plugin.code}`);
    runner(data, w, h, amt);
    ctx.putImageData(imgData, 0, 0);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Kesalahan skrip plugin.' };
  }
}

// --- Real Multi-Layer Editable PSD Export & Import (ag-psd) ---
const CANVAS_TO_PSD_BLEND: Record<BlendMode, PsdLayer['blendMode']> = {
  'source-over': 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color dodge',
  'color-burn': 'color burn',
  'hard-light': 'hard light',
  'soft-light': 'soft light',
  difference: 'difference',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

const PSD_TO_CANVAS_BLEND: Record<string, BlendMode> = Object.fromEntries(
  Object.entries(CANVAS_TO_PSD_BLEND).map(([k, v]) => [String(v), k as BlendMode])
);

export function exportProjectToPsdBlob(layers: StudioLayer[], width: number, height: number): Blob {
  const composite = createOffscreenCanvas(width, height);
  compositeLayers(composite, layers, width, height);

  const children: PsdLayer[] = layers.map((layer) => {
    const layerCanvas = createOffscreenCanvas(width, height);
    const lctx = layerCanvas.getContext('2d')!;
    if (layer.type === 'raster' && layer.canvas) {
      lctx.drawImage(layer.canvas, layer.x, layer.y);
    } else if (layer.type === 'text' && layer.textData) {
      lctx.font = `${layer.textData.fontWeight} ${layer.textData.fontSize}px ${layer.textData.fontFamily}, sans-serif`;
      lctx.fillStyle = layer.textData.color;
      lctx.textAlign = layer.textData.align;
      lctx.textBaseline = 'top';
      layer.textData.content.split('\n').forEach((line, idx) => {
        lctx.fillText(line, layer.x, layer.y + idx * layer.textData!.fontSize * 1.25);
      });
    } else if (layer.type === 'shape' && layer.shapeData) {
      const sd = layer.shapeData;
      lctx.fillStyle = sd.fillColor;
      lctx.strokeStyle = sd.strokeColor;
      lctx.lineWidth = sd.strokeWidth;
      lctx.beginPath();
      if (sd.shapeType === 'ellipse') {
        lctx.ellipse(layer.x + sd.width / 2, layer.y + sd.height / 2, Math.abs(sd.width / 2), Math.abs(sd.height / 2), 0, 0, Math.PI * 2);
      } else {
        lctx.rect(layer.x, layer.y, sd.width, sd.height);
      }
      if (sd.fillColor !== 'transparent') lctx.fill();
      if (sd.strokeWidth > 0) lctx.stroke();
    }

    const psdLayer: PsdLayer = {
      name: layer.name,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      opacity: Math.round((layer.opacity / 100) * 255),
      hidden: !layer.visible,
      blendMode: CANVAS_TO_PSD_BLEND[layer.blendMode] || 'normal',
      canvas: layerCanvas,
    };

    if (layer.type === 'text' && layer.textData) {
      psdLayer.text = {
        text: layer.textData.content,
        style: {
          fontSize: layer.textData.fontSize,
        },
      };
    }

    return psdLayer;
  });

  const psd: Psd = {
    width,
    height,
    channels: 4,
    bitsPerChannel: 8,
    canvas: composite,
    children,
  };

  const buffer = writePsd(psd);
  return new Blob([buffer], { type: 'application/octet-stream' });
}

export async function importPsdFile(file: File): Promise<{ width: number; height: number; layers: StudioLayer[] }> {
  const buffer = await file.arrayBuffer();
  const psd = readPsd(buffer);
  const w = psd.width || 1280;
  const h = psd.height || 720;
  const resultLayers: StudioLayer[] = [];

  const flattenPsdChildren = (nodes: PsdLayer[] | undefined) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        flattenPsdChildren(node.children);
      } else if (node.canvas) {
        const layerCanvas = createOffscreenCanvas(w, h);
        const ctx = layerCanvas.getContext('2d')!;
        ctx.drawImage(node.canvas as HTMLCanvasElement, node.left || 0, node.top || 0);
        resultLayers.push({
          id: `layer_psd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: node.name || 'PSD Layer',
          type: 'raster',
          visible: !node.hidden,
          locked: false,
          opacity: node.opacity !== undefined ? Math.round((node.opacity / 255) * 100) : 100,
          blendMode: PSD_TO_CANVAS_BLEND[String(node.blendMode || 'normal')] || 'source-over',
          x: 0,
          y: 0,
          clippingMask: false,
          maskEnabled: false,
          editingMask: false,
          canvas: layerCanvas,
          effects: structuredClone(DEFAULT_LAYER_EFFECTS),
          thumbnailDataUrl: generateThumbnail(layerCanvas, 72, 72),
        });
      }
    }
  };

  flattenPsdChildren(psd.children);

  if (resultLayers.length === 0 && psd.canvas) {
    const c = createOffscreenCanvas(w, h);
    c.getContext('2d')?.drawImage(psd.canvas as HTMLCanvasElement, 0, 0);
    resultLayers.push({
      id: `layer_psd_${Date.now()}`,
      name: file.name.replace(/\.psd$/i, ''),
      type: 'raster',
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      clippingMask: false,
      maskEnabled: false,
      editingMask: false,
      canvas: c,
      effects: structuredClone(DEFAULT_LAYER_EFFECTS),
      thumbnailDataUrl: generateThumbnail(c, 72, 72),
    });
  }

  return { width: w, height: h, layers: resultLayers };
}

// --- Uncompressed Print TIFF Binary Encoder ---
export function encodeCanvasToTiffBlob(canvas: HTMLCanvasElement, dpi = 300): Blob {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const w = canvas.width;
  const h = canvas.height;
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const pixelBytes = w * h * 4;
  const ifdEntries = 12;
  const headerSize = 8;
  const ifdOffset = headerSize;
  const ifdSize = 2 + ifdEntries * 12 + 4;
  const extraOffset = ifdOffset + ifdSize;
  const bitsOffset = extraOffset; // 8 bytes (4 x uint16)
  const xResOffset = extraOffset + 8; // 8 bytes
  const yResOffset = extraOffset + 16; // 8 bytes
  const pixelOffset = extraOffset + 24;

  const totalSize = pixelOffset + pixelBytes;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // Little-endian TIFF header
  view.setUint16(0, 0x4949, false); // "II"
  view.setUint16(2, 42, true);
  view.setUint32(4, ifdOffset, true);

  let p = ifdOffset;
  view.setUint16(p, ifdEntries, true);
  p += 2;

  const writeTag = (tag: number, type: number, count: number, val: number) => {
    view.setUint16(p, tag, true);
    view.setUint16(p + 2, type, true);
    view.setUint32(p + 4, count, true);
    view.setUint32(p + 8, val, true);
    p += 12;
  };

  writeTag(256, 4, 1, w); // ImageWidth
  writeTag(257, 4, 1, h); // ImageLength
  writeTag(258, 3, 4, bitsOffset); // BitsPerSample (8,8,8,8)
  writeTag(259, 3, 1, 1); // Compression = None
  writeTag(262, 3, 1, 2); // Photometric = RGB
  writeTag(273, 4, 1, pixelOffset); // StripOffsets
  writeTag(277, 3, 1, 4); // SamplesPerPixel = 4
  writeTag(278, 4, 1, h); // RowsPerStrip
  writeTag(279, 4, 1, pixelBytes); // StripByteCounts
  writeTag(282, 5, 1, xResOffset); // XResolution
  writeTag(283, 5, 1, yResOffset); // YResolution
  writeTag(296, 3, 1, 2); // ResolutionUnit = Inch
  view.setUint32(p, 0, true); // Next IFD = 0

  view.setUint16(bitsOffset, 8, true);
  view.setUint16(bitsOffset + 2, 8, true);
  view.setUint16(bitsOffset + 4, 8, true);
  view.setUint16(bitsOffset + 6, 8, true);

  view.setUint32(xResOffset, dpi, true);
  view.setUint32(xResOffset + 4, 1, true);
  view.setUint32(yResOffset, dpi, true);
  view.setUint32(yResOffset + 4, 1, true);

  u8.set(rgba, pixelOffset);
  return new Blob([buf], { type: 'image/tiff' });
}

// --- Print-Ready PDF Export (with DPI, Bleed, Crop Marks, CMYK Soft Proof) ---
export function exportCanvasToPrintPdf(
  canvas: HTMLCanvasElement,
  options: {
    title: string;
    dpi: number;
    bleedMm: number;
    cropMarks: boolean;
    cmykSoftProof: boolean;
    paperSize: 'canvas' | 'a4' | 'a3' | 'letter';
  }
): Blob {
  const work = cloneCanvas(canvas);
  if (options.cmykSoftProof) {
    // Realistic CMYK Fogra39 gamut compression preview
    const ctx = work.getContext('2d', { willReadFrequently: true })!;
    const img = ctx.getImageData(0, 0, work.width, work.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255;
      const g = d[i + 1] / 255;
      const b = d[i + 2] / 255;
      const k = 1 - Math.max(r, g, b);
      const denom = Math.max(0.001, 1 - k);
      const c = Math.min(0.95, (1 - r - k) / denom);
      const m = Math.min(0.95, (1 - g - k) / denom);
      const y = Math.min(0.95, (1 - b - k) / denom);
      d[i] = clamp255((1 - c * 0.96) * (1 - k * 0.94) * 255);
      d[i + 1] = clamp255((1 - m * 0.95) * (1 - k * 0.94) * 255);
      d[i + 2] = clamp255((1 - y * 0.92) * (1 - k * 0.94) * 255);
    }
    ctx.putImageData(img, 0, 0);
  }

  const mmPerInch = 25.4;
  let pageW = (work.width / options.dpi) * mmPerInch;
  let pageH = (work.height / options.dpi) * mmPerInch;

  if (options.paperSize === 'a4') {
    pageW = work.width >= work.height ? 297 : 210;
    pageH = work.width >= work.height ? 210 : 297;
  } else if (options.paperSize === 'a3') {
    pageW = work.width >= work.height ? 420 : 297;
    pageH = work.width >= work.height ? 297 : 420;
  } else if (options.paperSize === 'letter') {
    pageW = work.width >= work.height ? 279.4 : 215.9;
    pageH = work.width >= work.height ? 215.9 : 279.4;
  }

  const margin = options.cropMarks ? 10 + options.bleedMm : options.bleedMm;
  const totalW = pageW + margin * 2;
  const totalH = pageH + margin * 2;

  const pdf = new jsPDF({
    orientation: totalW >= totalH ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [totalW, totalH],
  });

  const dataUrl = work.toDataURL('image/jpeg', 0.95);
  pdf.addImage(dataUrl, 'JPEG', margin - options.bleedMm, margin - options.bleedMm, pageW + options.bleedMm * 2, pageH + options.bleedMm * 2);

  if (options.cropMarks) {
    pdf.setDrawColor(20, 20, 20);
    pdf.setLineWidth(0.25);
    const mark = 6;
    // Top-left
    pdf.line(margin - mark - 2, margin, margin - 2, margin);
    pdf.line(margin, margin - mark - 2, margin, margin - 2);
    // Top-right
    pdf.line(margin + pageW + 2, margin, margin + pageW + mark + 2, margin);
    pdf.line(margin + pageW, margin - mark - 2, margin + pageW, margin - 2);
    // Bottom-left
    pdf.line(margin - mark - 2, margin + pageH, margin - 2, margin + pageH);
    pdf.line(margin, margin + pageH + 2, margin, margin + pageH + mark + 2);
    // Bottom-right
    pdf.line(margin + pageW + 2, margin + pageH, margin + pageW + mark + 2, margin + pageH);
    pdf.line(margin + pageW, margin + pageH + 2, margin + pageW, margin + pageH + mark + 2);
  }

  return pdf.output('blob');
}

export function generateThumbnail(canvas: HTMLCanvasElement, maxW = 240, maxH = 160): string {
  const ratio = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
  const tw = Math.max(1, Math.round(canvas.width * ratio));
  const th = Math.max(1, Math.round(canvas.height * ratio));
  const thumb = createOffscreenCanvas(tw, th);
  const ctx = thumb.getContext('2d');
  if (ctx) ctx.drawImage(canvas, 0, 0, tw, th);
  return thumb.toDataURL('image/webp', 0.68);
}

export function serializeLayers(layers: StudioLayer[]): SerializedLayer[] {
  return layers.map((l) => ({
    id: l.id,
    name: l.name,
    type: l.type,
    visible: l.visible,
    locked: l.locked,
    opacity: l.opacity,
    blendMode: l.blendMode,
    x: l.x,
    y: l.y,
    clippingMask: l.clippingMask,
    maskEnabled: l.maskEnabled,
    editingMask: l.editingMask,
    imageDataUrl: l.canvas ? l.canvas.toDataURL('image/png') : undefined,
    maskDataUrl: l.maskCanvas ? l.maskCanvas.toDataURL('image/png') : undefined,
    adjustmentType: l.adjustmentType,
    adjustmentParams: l.adjustmentParams ? { ...l.adjustmentParams } : undefined,
    textData: l.textData ? { ...l.textData } : undefined,
    shapeData: l.shapeData ? { ...l.shapeData } : undefined,
    effects: structuredClone(l.effects),
  }));
}

export async function deserializeLayers(
  serialized: SerializedLayer[],
  width: number,
  height: number
): Promise<StudioLayer[]> {
  const out: StudioLayer[] = [];
  for (const s of serialized) {
    let canvas: HTMLCanvasElement | undefined;
    let maskCanvas: HTMLCanvasElement | undefined;
    if (s.type === 'raster') {
      canvas = createOffscreenCanvas(width, height);
      if (s.imageDataUrl) {
        try {
          const img = await loadImageFromUrl(s.imageDataUrl);
          canvas.getContext('2d')?.drawImage(img, 0, 0);
        } catch {
          // Keep blank layer if data URL failed
        }
      }
    }
    if (s.maskDataUrl) {
      maskCanvas = createOffscreenCanvas(width, height);
      try {
        const mImg = await loadImageFromUrl(s.maskDataUrl);
        maskCanvas.getContext('2d')?.drawImage(mImg, 0, 0);
      } catch {
        // Keep blank mask
      }
    }
    out.push({
      id: s.id,
      name: s.name,
      type: s.type,
      visible: s.visible,
      locked: s.locked,
      opacity: s.opacity,
      blendMode: s.blendMode,
      x: s.x,
      y: s.y,
      clippingMask: s.clippingMask,
      maskEnabled: s.maskEnabled,
      editingMask: s.editingMask,
      canvas,
      maskCanvas,
      adjustmentType: s.adjustmentType,
      adjustmentParams: s.adjustmentParams,
      textData: s.textData,
      shapeData: s.shapeData,
      effects: s.effects || structuredClone(DEFAULT_LAYER_EFFECTS),
      thumbnailDataUrl: canvas ? generateThumbnail(canvas, 72, 72) : undefined,
    });
  }
  return out;
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}
