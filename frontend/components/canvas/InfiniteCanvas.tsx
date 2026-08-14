"use client";

/**
 * InfiniteCanvas - React wrapper around CanvasEngine
 * Manages canvas lifecycle, syncs nodes from Yjs, handles resize
 */

import { useEffect, useRef } from "react";
import { CanvasEngine } from "@/lib/canvas/CanvasEngine";
import type { CanvasNode, ToolType } from "@/types/canvas";

interface InfiniteCanvasProps {
  nodes: CanvasNode[];
  selectedIds: string[];
  activeTool: ToolType;
  onNodeAdd: (node: Omit<CanvasNode, "id" | "createdBy" | "createdAt">) => string;
  onNodeUpdate: (id: string, updates: Partial<CanvasNode>) => void;
  onNodeDelete: (id: string) => void;
  onSelectionChange: (ids: string[]) => void;
  onCursorMove: (x: number, y: number) => void;
  onZoomChange: (zoom: number) => void;
  onEngineReady?: (engine: CanvasEngine) => void;
}

export function InfiniteCanvas({
  nodes,
  selectedIds,
  activeTool,
  onNodeAdd,
  onNodeUpdate,
  onNodeDelete,
  onSelectionChange,
  onCursorMove,
  onZoomChange,
  onEngineReady,
}: InfiniteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep callback refs always up to date so engine never holds stale closures
  const onNodeAddRef = useRef(onNodeAdd);
  const onNodeUpdateRef = useRef(onNodeUpdate);
  const onNodeDeleteRef = useRef(onNodeDelete);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onCursorMoveRef = useRef(onCursorMove);
  const onZoomChangeRef = useRef(onZoomChange);

  useEffect(() => { onNodeAddRef.current = onNodeAdd; }, [onNodeAdd]);
  useEffect(() => { onNodeUpdateRef.current = onNodeUpdate; }, [onNodeUpdate]);
  useEffect(() => { onNodeDeleteRef.current = onNodeDelete; }, [onNodeDelete]);
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);
  useEffect(() => { onCursorMoveRef.current = onCursorMove; }, [onCursorMove]);
  useEffect(() => { onZoomChangeRef.current = onZoomChange; }, [onZoomChange]);

  // Initialize engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const engine = new CanvasEngine(canvas, {
      // All callbacks delegate to refs — always fresh, never stale
      onNodeAdd: (node) => onNodeAddRef.current(node),
      onNodeUpdate: (id, updates) => onNodeUpdateRef.current(id, updates),
      onNodeDelete: (id) => onNodeDeleteRef.current(id),
      onSelectionChange: (ids) => onSelectionChangeRef.current(ids),
      onCursorMove: (x, y) => onCursorMoveRef.current(x, y),
      onViewportChange: (zoom) => onZoomChangeRef.current(zoom),
    });

    engineRef.current = engine;
    onEngineReady?.(engine);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx2 = canvas.getContext("2d")!;
        ctx2.scale(dpr, dpr);
        engine.resize(width, height);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync nodes from Yjs into engine
  useEffect(() => {
    engineRef.current?.setNodes(nodes);
  }, [nodes]);

  // Sync active tool
  useEffect(() => {
    engineRef.current?.setActiveTool(activeTool);
  }, [activeTool]);

  // Sync selected IDs
  useEffect(() => {
    engineRef.current?.setSelectedIds(selectedIds);
  }, [selectedIds]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{ cursor: "default" }}
      />
    </div>
  );
}
