"use client";

/**
 * ToolBar - Canvas tool selector
 * Keyboard shortcuts + visual tool buttons
 */

import { useEffect, useCallback } from "react";
import {
  MousePointer2, Hand, StickyNote, Type, Square,
  Circle as CircleIcon, Diamond, ArrowUpRight, Minus,
  Pencil, Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolType } from "@/types/canvas";

interface Tool {
  type: ToolType;
  icon: React.ElementType;
  label: string;
  shortcut: string;
}

const TOOLS: Tool[] = [
  { type: "select",    icon: MousePointer2, label: "Select",    shortcut: "V" },
  { type: "hand",      icon: Hand,          label: "Pan",       shortcut: "H" },
  { type: "sticky",    icon: StickyNote,    label: "Sticky",    shortcut: "N" },
  { type: "text",      icon: Type,          label: "Text",      shortcut: "T" },
  { type: "rectangle", icon: Square,        label: "Rectangle", shortcut: "R" },
  { type: "ellipse",   icon: CircleIcon,    label: "Ellipse",   shortcut: "O" },
  { type: "diamond",   icon: Diamond,       label: "Diamond",   shortcut: "D" },
  { type: "arrow",     icon: ArrowUpRight,  label: "Arrow",     shortcut: "A" },
  { type: "line",      icon: Minus,         label: "Line",      shortcut: "L" },
  { type: "freedraw",  icon: Pencil,        label: "Draw",      shortcut: "P" },
  { type: "eraser",    icon: Eraser,        label: "Eraser",    shortcut: "E" },
];

const SHORTCUT_MAP: Record<string, ToolType> = {
  v: "select", h: "hand", n: "sticky", t: "text",
  r: "rectangle", o: "ellipse", d: "diamond",
  a: "arrow", l: "line", p: "freedraw", e: "eraser",
};

interface ToolBarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

export function ToolBar({ activeTool, onToolChange }: ToolBarProps) {
  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const tool = SHORTCUT_MAP[e.key.toLowerCase()];
      if (tool) onToolChange(tool);
    },
    [onToolChange]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <aside className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 rounded-xl border-2 border-foreground/10 bg-card p-1.5 shadow-soft">
      {TOOLS.map((tool) => (
        <ToolButton
          key={tool.type}
          tool={tool}
          isActive={activeTool === tool.type}
          onClick={() => onToolChange(tool.type)}
        />
      ))}
    </aside>
  );
}

interface ToolButtonProps {
  tool: Tool;
  isActive: boolean;
  onClick: () => void;
}

function ToolButton({ tool, isActive, onClick }: ToolButtonProps) {
  const Icon = tool.icon;

  return (
    <button
      onClick={onClick}
      title={`${tool.label} (${tool.shortcut})`}
      className={cn(
        "relative h-9 w-9 rounded-lg flex items-center justify-center transition-all group",
        isActive
          ? "bg-foreground text-background"
          : tool.type === "sticky"
          ? "bg-warning/30 hover:bg-warning/50 text-foreground"
          : "hover:bg-muted text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />

      {/* Tooltip */}
      <span className="absolute left-full ml-2 px-1.5 py-0.5 rounded font-mono text-[10px] bg-foreground text-background opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {tool.label}
        <span className="ml-1 opacity-60">{tool.shortcut}</span>
      </span>
    </button>
  );
}
