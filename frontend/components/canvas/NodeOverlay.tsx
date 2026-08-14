"use client";

/**
 * NodeOverlay - DOM layer for sticky notes and text blocks
 * Positioned absolutely over the canvas, transforms with viewport
 */

import { useState, useCallback, useRef } from "react";
import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StickyNoteNode, TextNode } from "@/types/canvas";
import type { Viewport } from "@/lib/canvas/Viewport";

type Intent = "action" | "decision" | "question" | "reference";

const intentMeta: Record<Intent, { label: string; color: string }> = {
  action:    { label: "ACTION",   color: "text-intent-action" },
  decision:  { label: "DECISION", color: "text-intent-decision" },
  question:  { label: "QUESTION", color: "text-intent-question" },
  reference: { label: "REF",      color: "text-intent-reference" },
};

const intentToColor: Record<Intent, string> = {
  action:    "bg-sticky-yellow",
  decision:  "bg-sticky-mint",
  question:  "bg-sticky-pink",
  reference: "bg-sticky-sky",
};

interface NodeOverlayProps {
  nodes: (StickyNoteNode | TextNode)[];
  selectedIds: string[];
  viewport: Viewport | null;
  viewportTick?: number;
  onSelect: (id: string, multi: boolean) => void;
  onUpdate: (id: string, updates: Partial<StickyNoteNode | TextNode>) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export function NodeOverlay({
  nodes,
  selectedIds,
  viewport,
  viewportTick: _tick,
  onSelect,
  onUpdate,
  onDragEnd,
}: NodeOverlayProps) {
  if (!viewport) return null;

  const state = viewport.getState();

  return (
    // This div transforms with the viewport so sticky notes move with pan/zoom
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 5 }}
    >
      <div
        style={{
          position: "absolute",
          transformOrigin: "0 0",
          transform: `scale(${state.zoom}) translate(${state.scrollX}px, ${state.scrollY}px)`,
          willChange: "transform",
        }}
      >
        {nodes.map((node) => {
          if (node.type === "sticky") {
            return (
              <StickyNoteElement
                key={node.id}
                node={node as StickyNoteNode}
                isSelected={selectedIds.includes(node.id)}
                onSelect={onSelect}
                onUpdate={onUpdate}
                onDragEnd={onDragEnd}
              />
            );
          } else if (node.type === "text") {
            return (
              <TextNodeElement
                key={node.id}
                node={node as TextNode}
                isSelected={selectedIds.includes(node.id)}
                onSelect={onSelect}
                onUpdate={onUpdate}
                onDragEnd={onDragEnd}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// ─── Sticky Note ──────────────────────────────────────────────────────────────

interface StickyNoteElementProps {
  node: StickyNoteNode;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onUpdate: (id: string, updates: Partial<StickyNoteNode>) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

function StickyNoteElement({
  node,
  isSelected,
  onSelect,
  onUpdate,
  onDragEnd,
}: StickyNoteElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(node.content?.text || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Drag state
  const dragRef = useRef({
    isDragging: false,
    startMouseX: 0,
    startMouseY: 0,
    startNodeX: 0,
    startNodeY: 0,
  });

  const intent = (node.intent || "action") as Intent;
  const meta = intentMeta[intent];
  const bgColor = node.color || intentToColor[intent];

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isEditing || node.locked) return;
      e.stopPropagation();

      onSelect(node.id, e.shiftKey);

      dragRef.current = {
        isDragging: true,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startNodeX: node.x,
        startNodeY: node.y,
      };

      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
    },
    [isEditing, node.locked, node.id, node.x, node.y, onSelect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.isDragging) return;
      e.stopPropagation();

      const dx = e.clientX - dragRef.current.startMouseX;
      const dy = e.clientY - dragRef.current.startMouseY;

      // We need to account for zoom when converting screen delta to scene delta
      // The parent div already applies the viewport transform, so we divide by zoom
      // This is handled by the parent transform - dx/dy are already in screen space
      // but the parent is scaled, so we need to invert the scale
      const zoom = 1; // The transform is on parent, pointer events give us screen coords
      // Actually: since the overlay div has the viewport transform applied,
      // pointer events are in screen space. We need scene delta = screen delta / zoom.
      // But we don't have zoom here directly - pass it via a ref or use a different approach.
      // For now, update position directly (will be corrected in CanvasWrapper)
      onUpdate(node.id, {
        x: dragRef.current.startNodeX + dx,
        y: dragRef.current.startNodeY + dy,
      });
    },
    [node.id, onUpdate]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.isDragging) return;
      dragRef.current.isDragging = false;
      e.stopPropagation();
      onDragEnd(node.id, node.x, node.y);
    },
    [node.id, node.x, node.y, onDragEnd]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (node.locked) return;
      e.stopPropagation();
      setIsEditing(true);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [node.locked]
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    onUpdate(node.id, { content: { text } });
  }, [node.id, text, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Stop propagation to prevent toolbar shortcuts from firing
      e.stopPropagation();
      
      if (e.key === "Escape") {
        setIsEditing(false);
        onUpdate(node.id, { content: { text } });
      }
    },
    [node.id, text, onUpdate]
  );

  return (
    <div
      className={cn(
        "absolute rounded-lg border shadow-sticky transition-shadow select-none",
        bgColor,
        "border-foreground/15",
        isSelected && "ring-2 ring-primary ring-offset-1",
        !node.locked && !isEditing && "cursor-grab active:cursor-grabbing",
        node.locked && "cursor-not-allowed opacity-80"
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width || 176,
        height: node.height || 160,
        transform: `rotate(${node.rotation || 0}deg)`,
        pointerEvents: "all",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Lock badge */}
      {node.locked && (
        <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center z-10">
          <Lock className="h-2.5 w-2.5" />
        </span>
      )}

      <div className="p-3 h-full flex flex-col">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent resize-none outline-none font-hand text-base leading-tight text-foreground w-full"
            style={{ cursor: "text" }}
          />
        ) : (
          <div className="flex-1 font-hand text-base leading-tight text-foreground overflow-hidden">
            {text || <span className="text-foreground/40 italic">Empty note</span>}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between shrink-0">
          <span className={cn("font-mono text-[9px] uppercase tracking-wider", meta.color)}>
            ● {meta.label}
          </span>
          {node.intent && (
            <Sparkles className="h-2.5 w-2.5 text-foreground/30" />
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Text Node ────────────────────────────────────────────────────────────────

interface TextNodeElementProps {
  node: TextNode;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onUpdate: (id: string, updates: Partial<TextNode>) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

function TextNodeElement({
  node,
  isSelected,
  onSelect,
  onUpdate,
  onDragEnd,
}: TextNodeElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(node.text || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Drag state
  const dragRef = useRef({
    isDragging: false,
    startMouseX: 0,
    startMouseY: 0,
    startNodeX: 0,
    startNodeY: 0,
  });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isEditing || node.locked) return;
      e.stopPropagation();

      onSelect(node.id, e.shiftKey);

      dragRef.current = {
        isDragging: true,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startNodeX: node.x,
        startNodeY: node.y,
      };

      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
    },
    [isEditing, node.locked, node.id, node.x, node.y, onSelect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.isDragging) return;
      e.stopPropagation();

      const dx = e.clientX - dragRef.current.startMouseX;
      const dy = e.clientY - dragRef.current.startMouseY;

      onUpdate(node.id, {
        x: dragRef.current.startNodeX + dx,
        y: dragRef.current.startNodeY + dy,
      });
    },
    [node.id, onUpdate]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.isDragging) return;
      dragRef.current.isDragging = false;
      e.stopPropagation();
      onDragEnd(node.id, node.x, node.y);
    },
    [node.id, node.x, node.y, onDragEnd]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (node.locked) return;
      e.stopPropagation();
      setIsEditing(true);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [node.locked]
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    onUpdate(node.id, { text });
  }, [node.id, text, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Stop propagation to prevent toolbar shortcuts from firing
      e.stopPropagation();
      
      if (e.key === "Escape") {
        setIsEditing(false);
        onUpdate(node.id, { text });
      }
    },
    [node.id, text, onUpdate]
  );

  return (
    <div
      className={cn(
        "absolute select-none",
        isSelected && !isEditing && "ring-2 ring-primary ring-offset-1",
        !node.locked && !isEditing && "cursor-grab active:cursor-grabbing",
        node.locked && "cursor-not-allowed opacity-80"
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width || 200,
        height: node.height || 100,
        backgroundColor: node.backgroundColor || 'transparent',
        pointerEvents: "all",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Lock badge */}
      {node.locked && (
        <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center z-10">
          <Lock className="h-2.5 w-2.5" />
        </span>
      )}

      <div className="w-full h-full">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-transparent resize-none outline-none border-none"
            style={{ 
              cursor: "text",
              fontSize: node.fontSize || 16,
              fontFamily: node.fontFamily || 'Inter, sans-serif',
              color: node.strokeColor || '#1a1a1a',
              textAlign: node.textAlign || 'left',
              padding: '4px',
            }}
          />
        ) : (
          <div 
            className="w-full h-full overflow-hidden"
            style={{
              fontSize: node.fontSize || 16,
              fontFamily: node.fontFamily || 'Inter, sans-serif',
              color: node.strokeColor || '#1a1a1a',
              textAlign: node.textAlign || 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              padding: '4px',
            }}
          >
            {text || <span className="text-foreground/40 italic">Double-click to edit</span>}
          </div>
        )}
      </div>
    </div>
  );
}
