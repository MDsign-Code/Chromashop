import React from 'react';
import {
  ArrowLeftRight,
  Brush,
  Crop,
  Eraser,
  Hand,
  Lasso,
  MessageSquarePlus,
  Move,
  PaintBucket,
  Pipette,
  RotateCcw,
  Search,
  Square,
  SquareDashed,
  Type,
} from 'lucide-react';
import type { ShortcutMap, ToolId } from '../types/studio';

interface LeftToolbarProps {
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  foregroundColor: string;
  backgroundColor: string;
  onChangeForeground: (color: string) => void;
  onChangeBackground: (color: string) => void;
  onSwapColors: () => void;
  onResetColors: () => void;
  shortcuts: ShortcutMap;
}

const TOOLS: { id: ToolId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'move', label: 'Move Tool', icon: Move },
  { id: 'marquee', label: 'Rectangular Marquee', icon: SquareDashed },
  { id: 'lasso', label: 'Lasso Selection', icon: Lasso },
  { id: 'brush', label: 'Brush Tool (Stylus)', icon: Brush },
  { id: 'eraser', label: 'Eraser Tool', icon: Eraser },
  { id: 'fill', label: 'Paint Bucket', icon: PaintBucket },
  { id: 'text', label: 'Type Tool', icon: Type },
  { id: 'shape', label: 'Shape Tool', icon: Square },
  { id: 'eyedropper', label: 'Eyedropper', icon: Pipette },
  { id: 'crop', label: 'Crop Tool', icon: Crop },
  { id: 'pin', label: 'Pin Komentar Tim', icon: MessageSquarePlus },
  { id: 'hand', label: 'Hand / Pan', icon: Hand },
  { id: 'zoom', label: 'Zoom Tool', icon: Search },
];

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  activeTool,
  onSelectTool,
  foregroundColor,
  backgroundColor,
  onChangeForeground,
  onChangeBackground,
  onSwapColors,
  onResetColors,
  shortcuts,
}) => {
  return (
    <aside
      aria-label="Alat Photoshop"
      className="w-12 sm:w-[52px] shrink-0 bg-zinc-100 dark:bg-[#19191e] border-r border-zinc-300 dark:border-[#2a2a32] flex flex-col items-center py-2 gap-1 overflow-y-auto studio-scroll select-none z-20"
    >
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const keyHint = shortcuts[`tool:${tool.id}`]?.toUpperCase() || '';
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            title={`${tool.label}${keyHint ? ` (${keyHint})` : ''}`}
            className={`relative w-10 h-10 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Icon className="w-[18px] h-[18px]" />
            {keyHint && (
              <span
                className={`absolute bottom-0.5 right-1 text-[8px] font-mono leading-none ${
                  isActive ? 'text-blue-100' : 'text-zinc-400 dark:text-zinc-500'
                }`}
              >
                {keyHint}
              </span>
            )}
          </button>
        );
      })}

      {/* Photoshop Foreground / Background Color Swatches */}
      <div className="mt-auto pt-3 border-t border-zinc-300 dark:border-[#2a2a32] flex flex-col items-center gap-2 w-full">
        <div className="relative w-9 h-9">
          <label
            title="Warna Latar Belakang (Background)"
            className="absolute bottom-0 right-0 w-6 h-6 rounded border-2 border-zinc-300 dark:border-zinc-700 cursor-pointer overflow-hidden shadow-sm"
            style={{ backgroundColor: backgroundColor }}
          >
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => onChangeBackground(e.target.value)}
              className="opacity-0 w-full h-full cursor-pointer"
            />
          </label>
          <label
            title="Warna Depan (Foreground)"
            className="absolute top-0 left-0 w-6 h-6 rounded border-2 border-white dark:border-zinc-900 cursor-pointer overflow-hidden shadow-md ring-1 ring-zinc-400 dark:ring-zinc-600"
            style={{ backgroundColor: foregroundColor }}
          >
            <input
              type="color"
              value={foregroundColor}
              onChange={(e) => onChangeForeground(e.target.value)}
              className="opacity-0 w-full h-full cursor-pointer"
            />
          </label>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onSwapColors}
            title="Tukar Warna (X)"
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <ArrowLeftRight className="w-3 h-3" />
          </button>
          <button
            onClick={onResetColors}
            title="Reset Hitam/Putih (D)"
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>
    </aside>
  );
};
