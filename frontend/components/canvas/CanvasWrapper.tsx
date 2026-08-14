"use client";

/**
 * CanvasWrapper - Top-level canvas orchestrator
 * Wires together: InfiniteCanvas + NodeOverlay + CursorLayer + ToolBar
 * Connects to useCanvas (Yjs) and usePresence (cursors)
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Frame, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { NodeOverlay } from "./NodeOverlay";
import { CursorLayer } from "./CursorLayer";
import { ToolBar } from "./ToolBar";
import type { CanvasEngine } from "@/lib/canvas/CanvasEngine";
import type { Viewport } from "@/lib/canvas/Viewport";
import type { CanvasNode, ToolType, StickyNoteNode, TextNode } from "@/types/canvas";
import type { UserCursor } from "@/lib/yjs/awareness";

interface CanvasWrapperProps {
  // Data from useCanvas hook
  nodes: CanvasNode[];
  onNodeAdd: (node: Omit<CanvasNode, "id" | "createdBy" | "createdAt">) => string;
  onNodeUpdate: (id: string, updates: Partial<CanvasNode>) => void;
  onNodeDelete: (id: string) => void;

  // Data from usePresence hook
  cursors: UserCursor[];
  onCursorMove: (x: number, y: number) => void;

  // External selection sync (e.g. right panel)
  externalSelectedId?: string | null;
  onSelectionChange?: (ids: string[]) => void;
}

export function CanvasWrapper({
  nodes,
  onNodeAdd,
  onNodeUpdate,
  onNodeDelete,
  cursors,
  onCursorMove,
  externalSelectedId,
  onSelectionChange,
}: CanvasWrapperProps) {
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(100);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [viewportTick, setViewportTick] = useState(0); // forces overlay re-render on pan/zoom
  const engineRef = useRef<CanvasEngine | null>(null);

  // Sync external selection (e.g. clicking a note in the right panel)
  useEffect(() => {
    if (externalSelectedId !== undefined && externalSelectedId !== null) {
      setSelectedIds([externalSelectedId]);
    }
  }, [externalSelectedId]);

  // Listen for scroll-to-node events
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { nodeId } = customEvent.detail;
      
      // Find the node
      const node = nodes.find(n => n.id === nodeId);
      if (!node || !engineRef.current) {
        console.warn('[CanvasWrapper] Cannot scroll to node:', nodeId);
        return;
      }

      // Get viewport and calculate center position
      const viewport = engineRef.current.getViewport();
      const canvasWidth = viewport.getWidth();
      const canvasHeight = viewport.getHeight();
      
      // Pan to center the node on screen
      const targetX = -node.x + canvasWidth / 2;
      const targetY = -node.y + canvasHeight / 2;
      
      viewport.panTo(targetX, targetY);
      setViewportTick(t => t + 1);
      
      console.log('[CanvasWrapper] Scrolled to node:', nodeId, { x: node.x, y: node.y });
    };

    window.addEventListener('canvas:scrollToNode', handler);
    return () => window.removeEventListener('canvas:scrollToNode', handler);
  }, [nodes]);

  // Handle engine ready
  const handleEngineReady = useCallback((engine: CanvasEngine) => {
    engineRef.current = engine;
    setViewport(engine.getViewport());
  }, []);

  // Selection change from canvas engine
  const handleSelectionChange = useCallback(
    (ids: string[]) => {
      setSelectedIds(ids);
      onSelectionChange?.(ids);
    },
    [onSelectionChange]
  );

  // Cursor move
  const handleCursorMove = useCallback(
    (sceneX: number, sceneY: number) => {
      onCursorMove(sceneX, sceneY);
      // Tick so cursor overlay re-renders with updated viewport during pan
      setViewportTick(t => t + 1);
    },
    [onCursorMove]
  );

  // Zoom change from engine — tick forces NodeOverlay + CursorLayer to re-render
  const handleZoomChange = useCallback((z: number) => {
    setZoom(Math.round(z * 100));
    setViewportTick(t => t + 1);
  }, []);

  // Tool change
  const handleToolChange = useCallback((tool: ToolType) => {
    setActiveTool(tool);
    engineRef.current?.setActiveTool(tool);
  }, []);

  // Sticky note drag (DOM layer) — needs zoom-aware delta
  const handleStickyDragUpdate = useCallback(
    (id: string, updates: Partial<StickyNoteNode | TextNode>) => {
      // The NodeOverlay gives us raw screen deltas; we need to convert to scene
      // Since the overlay div has the viewport transform, pointer events are in
      // screen space. We divide by zoom to get scene delta.
      const currentZoom = engineRef.current?.getViewport().getZoom() ?? 1;
      if ("x" in updates && "y" in updates) {
        const node = nodes.find((n) => n.id === id);
        if (!node) return;
        // The NodeOverlay already computed scene position via its own drag logic
        onNodeUpdate(id, updates);
      } else {
        onNodeUpdate(id, updates);
      }
    },
    [nodes, onNodeUpdate]
  );

  const handleStickyDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      onNodeUpdate(id, { x, y });
    },
    [onNodeUpdate]
  );

  // Sticky note selection from DOM layer
  const handleStickySelect = useCallback(
    (id: string, multi: boolean) => {
      setSelectedIds((prev) => {
        if (multi) {
          return prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
        }
        return [id];
      });
      onSelectionChange?.([id]);
    },
    [onSelectionChange]
  );

  // Separate sticky/text nodes (DOM) from canvas nodes
  const domNodes = nodes.filter(
    (n): n is StickyNoteNode | TextNode =>
      n.type === "sticky" || n.type === "text"
  );

  return (
    <div className="relative w-full h-full overflow-hidden bg-paper">
      {/* ── Canvas layer (shapes, freehand, arrows) ── */}
      <InfiniteCanvas
        nodes={nodes}
        selectedIds={selectedIds}
        activeTool={activeTool}
        onNodeAdd={onNodeAdd}
        onNodeUpdate={onNodeUpdate}
        onNodeDelete={onNodeDelete}
        onSelectionChange={handleSelectionChange}
        onCursorMove={handleCursorMove}
        onZoomChange={handleZoomChange}
        onEngineReady={handleEngineReady}
      />

      {/* ── DOM overlay: sticky notes ── */}
      <NodeOverlay
        nodes={domNodes}
        selectedIds={selectedIds}
        viewport={viewport}
        viewportTick={viewportTick}
        onSelect={handleStickySelect}
        onUpdate={handleStickyDragUpdate}
        onDragEnd={handleStickyDragEnd}
      />

      {/* ── DOM overlay: remote cursors ── */}
      <CursorLayer cursors={cursors} viewport={viewport} viewportTick={viewportTick} />

      {/* ── Tool bar (left side) ── */}
      <ToolBar activeTool={activeTool} onToolChange={handleToolChange} />

      {/* ── Zoom controls (bottom center) ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-xl border-2 border-foreground/15 bg-card px-2 py-1.5 shadow-soft">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => engineRef.current?.zoomOut()}
        >
          −
        </Button>
        <span className="font-mono text-xs px-2 w-14 text-center">{zoom}%</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => engineRef.current?.zoomIn()}
        >
          +
        </Button>
        <span className="w-px h-4 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => engineRef.current?.fitToScreen()}
        >
          <Frame className="h-3 w-3 mr-1" /> Fit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => engineRef.current?.resetZoom()}
        >
          100%
        </Button>
      </div>

      {/* ── Active tool indicator ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-wider border",
            "bg-card/90 backdrop-blur border-foreground/10 text-muted-foreground",
            activeTool !== "select" && "text-foreground border-primary/30 bg-primary/5"
          )}
        >
          {activeTool}
        </span>
      </div>
    </div>
  );
}
