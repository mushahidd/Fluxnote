/**
 * CanvasEngine - Main orchestrator for the infinite canvas
 * Manages the RAF render loop, viewport, and element rendering
 */

import { Viewport } from './Viewport';
import {
  renderGrid,
  renderNode,
  renderSelectionBox,
  renderSelectionRect,
  renderDrawingPreview,
} from './Renderer';
import { hitTestNodes, hitTestHandle, isNodeInSelectionBox, getNodesBounds } from './HitTest';
import type { CanvasNode, ToolType } from '../../types/canvas';

export interface EngineCallbacks {
  onNodeAdd: (node: Omit<CanvasNode, 'id' | 'createdBy' | 'createdAt'>) => string;
  onNodeUpdate: (id: string, updates: Partial<CanvasNode>) => void;
  onNodeDelete: (id: string) => void;
  onSelectionChange: (ids: string[]) => void;
  onCursorMove: (sceneX: number, sceneY: number) => void;
  onViewportChange: (zoom: number) => void;
}

export interface DrawingState {
  isDrawing: boolean;
  startSceneX: number;
  startSceneY: number;
  currentSceneX: number;
  currentSceneY: number;
  activeNodeId: string | null;
  freeDrawPoints: number[][];
}

export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewport: Viewport;
  private nodes: CanvasNode[] = [];
  private selectedIds: Set<string> = new Set();
  private hoveredId: string | null = null;
  private activeTool: ToolType = 'select';
  private callbacks: EngineCallbacks;

  // RAF
  private rafId: number | null = null;
  private dirty: boolean = true;

  // Interaction state
  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private panStartScrollX: number = 0;
  private panStartScrollY: number = 0;

  private isDraggingSelection: boolean = false;
  private dragStartSceneX: number = 0;
  private dragStartSceneY: number = 0;
  private dragNodeStartPositions: Map<string, { x: number; y: number; startX?: number; startY?: number }> = new Map();

  private isBoxSelecting: boolean = false;
  private boxSelectStart: { x: number; y: number } | null = null;
  private boxSelectCurrent: { x: number; y: number } | null = null;

  private drawing: DrawingState = {
    isDrawing: false,
    startSceneX: 0,
    startSceneY: 0,
    currentSceneX: 0,
    currentSceneY: 0,
    activeNodeId: null,
    freeDrawPoints: [],
  };

  // Default styles for new elements
  private currentStyle = {
    strokeColor: '#1a1a1a',
    backgroundColor: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid' as const,
    fontSize: 16,
  };

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.viewport = new Viewport(canvas.width, canvas.height);
    this.callbacks = callbacks;

    this.bindEvents();
    this.startRenderLoop();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  setNodes(nodes: CanvasNode[]): void {
    this.nodes = nodes;
    this.dirty = true;
  }

  setActiveTool(tool: ToolType): void {
    this.activeTool = tool;
    this.updateCursor();
    // Deselect when switching tools (except select/hand)
    if (tool !== 'select' && tool !== 'hand') {
      this.selectedIds.clear();
      this.callbacks.onSelectionChange([]);
      this.dirty = true;
    }
  }

  setCurrentStyle(style: Partial<typeof this.currentStyle>): void {
    this.currentStyle = { ...this.currentStyle, ...style };
  }

  setSelectedIds(ids: string[]): void {
    this.selectedIds = new Set(ids);
    this.dirty = true;
  }

  deleteSelected(): void {
    for (const id of this.selectedIds) {
      this.callbacks.onNodeDelete(id);
    }
    this.selectedIds.clear();
    this.callbacks.onSelectionChange([]);
    this.dirty = true;
  }

  fitToScreen(): void {
    const nodeBounds = getNodesBounds(this.nodes);
    if (nodeBounds) {
      // Convert {x, y, width, height} to Bounds {left, top, right, bottom, width, height}
      const bounds = {
        left: nodeBounds.x,
        top: nodeBounds.y,
        right: nodeBounds.x + nodeBounds.width,
        bottom: nodeBounds.y + nodeBounds.height,
        width: nodeBounds.width,
        height: nodeBounds.height,
      };
      this.viewport.fitBounds(bounds);
    } else {
      this.viewport.reset();
    }
    this.callbacks.onViewportChange(this.viewport.getZoom());
    this.dirty = true;
  }

  zoomIn(): void {
    this.viewport.setZoom(this.viewport.getZoom() * 1.2);
    this.callbacks.onViewportChange(this.viewport.getZoom());
    this.dirty = true;
  }

  zoomOut(): void {
    this.viewport.setZoom(this.viewport.getZoom() / 1.2);
    this.callbacks.onViewportChange(this.viewport.getZoom());
    this.dirty = true;
  }

  resetZoom(): void {
    this.viewport.setZoom(1.0);
    this.callbacks.onViewportChange(this.viewport.getZoom());
    this.dirty = true;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.viewport.setCanvasSize(width, height);
    this.dirty = true;
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  destroy(): void {
    this.stopRenderLoop();
    this.unbindEvents();
  }

  // ─── Render Loop ───────────────────────────────────────────────────────────

  private startRenderLoop(): void {
    const loop = () => {
      if (this.dirty) {
        this.render();
        this.dirty = false;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopRenderLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private render(): void {
    const { ctx, canvas, viewport, nodes } = this;

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#fafaf8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    renderGrid(ctx, viewport, canvas.width, canvas.height);

    // Viewport culling: only render visible nodes
    const visibleBounds = viewport.getVisibleBounds();

    for (const node of nodes) {
      // Skip sticky notes (rendered as DOM)
      if (node.type === 'sticky') continue;

      // Viewport culling
      if (!this.isNodeVisible(node, visibleBounds)) continue;

      const isSelected = this.selectedIds.has(node.id);
      const isHovered = this.hoveredId === node.id && !isSelected;

      renderNode(ctx, node, viewport, isSelected, isHovered);
    }

    // Draw selection handles on top
    for (const id of this.selectedIds) {
      const node = this.nodes.find(n => n.id === id);
      if (node && node.type !== 'sticky') {
        renderSelectionBox(ctx, node, viewport);
      }
    }

    // Box selection rectangle
    if (this.isBoxSelecting && this.boxSelectStart && this.boxSelectCurrent) {
      const zoom = viewport.getZoom();
      const scroll = viewport.getScroll();
      const sx = (this.boxSelectStart.x + scroll.x) * zoom;
      const sy = (this.boxSelectStart.y + scroll.y) * zoom;
      const ex = (this.boxSelectCurrent.x + scroll.x) * zoom;
      const ey = (this.boxSelectCurrent.y + scroll.y) * zoom;
      renderSelectionRect(ctx, sx, sy, ex - sx, ey - sy);
    }

    // Drawing preview (while dragging to create shape)
    if (this.drawing.isDrawing && this.activeTool !== 'freedraw' && this.activeTool !== 'sticky') {
      renderDrawingPreview(
        ctx,
        this.activeTool,
        this.drawing.startSceneX,
        this.drawing.startSceneY,
        this.drawing.currentSceneX,
        this.drawing.currentSceneY,
        viewport
      );
    }
  }

  private isNodeVisible(node: CanvasNode, bounds: ReturnType<Viewport['getVisibleBounds']>): boolean {
    if (node.type === 'line' || node.type === 'arrow') {
      const n = node as any;
      const minX = Math.min(n.startX, n.endX);
      const minY = Math.min(n.startY, n.endY);
      const maxX = Math.max(n.startX, n.endX);
      const maxY = Math.max(n.startY, n.endY);
      return this.viewport.isRectVisible(minX, minY, maxX - minX, maxY - minY);
    }
    if (node.type === 'freedraw') {
      const n = node as any;
      if (!n.points?.length) return false;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [px, py] of n.points) {
        minX = Math.min(minX, px); minY = Math.min(minY, py);
        maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
      }
      return this.viewport.isRectVisible(minX, minY, maxX - minX, maxY - minY);
    }
    return this.viewport.isRectVisible(node.x, node.y, node.width, node.height);
  }

  // ─── Event Binding ─────────────────────────────────────────────────────────

  private boundPointerDown!: (e: PointerEvent) => void;
  private boundPointerMove!: (e: PointerEvent) => void;
  private boundPointerUp!: (e: PointerEvent) => void;
  private boundWheel!: (e: WheelEvent) => void;
  private boundKeyDown!: (e: KeyboardEvent) => void;
  private boundContextMenu!: (e: MouseEvent) => void;

  private bindEvents(): void {
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundContextMenu = (e) => e.preventDefault();

    this.canvas.addEventListener('pointerdown', this.boundPointerDown);
    this.canvas.addEventListener('pointermove', this.boundPointerMove);
    this.canvas.addEventListener('pointerup', this.boundPointerUp);
    this.canvas.addEventListener('wheel', this.boundWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.boundContextMenu);
    window.addEventListener('keydown', this.boundKeyDown);
  }

  private unbindEvents(): void {
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundPointerUp);
    this.canvas.removeEventListener('wheel', this.boundWheel);
    this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
    window.removeEventListener('keydown', this.boundKeyDown);
  }

  // ─── Pointer Events ────────────────────────────────────────────────────────

  private getSceneCoords(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return this.viewport.screenToScene(screenX, screenY);
  }

  private getScreenCoords(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onPointerDown(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    const scene = this.getSceneCoords(e);
    const screen = this.getScreenCoords(e);

    // Middle mouse or space+drag = pan
    if (e.button === 1 || this.activeTool === 'hand') {
      this.isPanning = true;
      this.panStartX = screen.x;
      this.panStartY = screen.y;
      const scroll = this.viewport.getScroll();
      this.panStartScrollX = scroll.x;
      this.panStartScrollY = scroll.y;
      return;
    }

    if (this.activeTool === 'select') {
      this.handleSelectPointerDown(e, scene);
      return;
    }

    if (this.activeTool === 'eraser') {
      const hit = hitTestNodes(this.nodes.filter(n => n.type !== 'sticky'), scene.x, scene.y);
      if (hit) this.callbacks.onNodeDelete(hit);
      return;
    }

    // Drawing tools
    this.drawing.isDrawing = true;
    this.drawing.startSceneX = scene.x;
    this.drawing.startSceneY = scene.y;
    this.drawing.currentSceneX = scene.x;
    this.drawing.currentSceneY = scene.y;
    this.drawing.freeDrawPoints = [[scene.x, scene.y]];
    this.drawing.activeNodeId = null;
    this.dirty = true;
  }

  private onPointerMove(e: PointerEvent): void {
    const scene = this.getSceneCoords(e);
    const screen = this.getScreenCoords(e);

    // Broadcast cursor position
    this.callbacks.onCursorMove(scene.x, scene.y);

    if (this.isPanning) {
      const dx = screen.x - this.panStartX;
      const dy = screen.y - this.panStartY;
      const zoom = this.viewport.getZoom();
      this.viewport.setState({
        scrollX: this.panStartScrollX + dx / zoom,
        scrollY: this.panStartScrollY + dy / zoom,
      });
      this.dirty = true;
      return;
    }

    if (this.activeTool === 'select') {
      this.handleSelectPointerMove(e, scene);
      return;
    }

    if (!this.drawing.isDrawing) {
      // Hover detection
      const hit = hitTestNodes(this.nodes.filter(n => n.type !== 'sticky'), scene.x, scene.y);
      if (hit !== this.hoveredId) {
        this.hoveredId = hit;
        this.dirty = true;
      }
      return;
    }

    this.drawing.currentSceneX = scene.x;
    this.drawing.currentSceneY = scene.y;

    if (this.activeTool === 'freedraw') {
      this.drawing.freeDrawPoints.push([scene.x, scene.y]);
      // Live preview: update node points while drawing
      if (this.drawing.activeNodeId) {
        this.callbacks.onNodeUpdate(this.drawing.activeNodeId, {
          points: [...this.drawing.freeDrawPoints],
        } as any);
      } else {
        // Create the node on first move
        const id = this.callbacks.onNodeAdd({
          type: 'freedraw',
          x: scene.x, y: scene.y,
          width: 1, height: 1,
          points: [...this.drawing.freeDrawPoints],
          strokeColor: this.currentStyle.strokeColor,
          strokeWidth: this.currentStyle.strokeWidth,
        } as any);
        this.drawing.activeNodeId = id;
      }
    }

    this.dirty = true;
  }

  private onPointerUp(e: PointerEvent): void {
    const scene = this.getSceneCoords(e);

    if (this.isPanning) {
      this.isPanning = false;
      this.updateCursor();
      return;
    }

    if (this.activeTool === 'select') {
      this.handleSelectPointerUp(e, scene);
      return;
    }

    if (!this.drawing.isDrawing) return;
    this.drawing.isDrawing = false;

    const { startSceneX: sx, startSceneY: sy } = this.drawing;
    const ex = scene.x;
    const ey = scene.y;
    const w = Math.abs(ex - sx);
    const h = Math.abs(ey - sy);
    const x = Math.min(sx, ex);
    const y = Math.min(sy, ey);

    switch (this.activeTool) {
      case 'rectangle':
        if (w > 4 && h > 4) {
          this.callbacks.onNodeAdd({
            type: 'rectangle',
            x, y, width: w, height: h,
            strokeColor: this.currentStyle.strokeColor,
            backgroundColor: this.currentStyle.backgroundColor,
            strokeWidth: this.currentStyle.strokeWidth,
            strokeStyle: this.currentStyle.strokeStyle,
          } as any);
        }
        break;

      case 'ellipse':
        if (w > 4 && h > 4) {
          this.callbacks.onNodeAdd({
            type: 'ellipse',
            x, y, width: w, height: h,
            strokeColor: this.currentStyle.strokeColor,
            backgroundColor: this.currentStyle.backgroundColor,
            strokeWidth: this.currentStyle.strokeWidth,
            strokeStyle: this.currentStyle.strokeStyle,
          } as any);
        }
        break;

      case 'diamond':
        if (w > 4 && h > 4) {
          this.callbacks.onNodeAdd({
            type: 'diamond',
            x, y, width: w, height: h,
            strokeColor: this.currentStyle.strokeColor,
            backgroundColor: this.currentStyle.backgroundColor,
            strokeWidth: this.currentStyle.strokeWidth,
            strokeStyle: this.currentStyle.strokeStyle,
          } as any);
        }
        break;

      case 'line':
        if (w > 4 || h > 4) {
          this.callbacks.onNodeAdd({
            type: 'line',
            x: Math.min(sx, ex), y: Math.min(sy, ey),
            width: w, height: h,
            startX: sx, startY: sy, endX: ex, endY: ey,
            strokeColor: this.currentStyle.strokeColor,
            strokeWidth: this.currentStyle.strokeWidth,
            strokeStyle: this.currentStyle.strokeStyle,
          } as any);
        }
        break;

      case 'arrow':
        if (w > 4 || h > 4) {
          this.callbacks.onNodeAdd({
            type: 'arrow',
            x: Math.min(sx, ex), y: Math.min(sy, ey),
            width: w, height: h,
            startX: sx, startY: sy, endX: ex, endY: ey,
            endArrowhead: true,
            strokeColor: this.currentStyle.strokeColor,
            strokeWidth: this.currentStyle.strokeWidth,
            strokeStyle: this.currentStyle.strokeStyle,
          } as any);
        }
        break;

      case 'text':
        this.callbacks.onNodeAdd({
          type: 'text',
          x: sx, y: sy,
          width: Math.max(w, 120),
          height: Math.max(h, 40),
          text: 'Double-click to edit',
          fontSize: this.currentStyle.fontSize,
          strokeColor: this.currentStyle.strokeColor,
        } as any);
        break;

      case 'sticky':
        this.callbacks.onNodeAdd({
          type: 'sticky',
          x: sx, y: sy,
          width: 176, height: 160,
          content: { text: 'New note' },
          color: 'bg-sticky-yellow',
          intent: 'action',
        } as any);
        break;

      case 'freedraw':
        // Already created incrementally, just finalize
        this.drawing.activeNodeId = null;
        break;
    }

    this.dirty = true;
  }

  // ─── Select Tool Logic ─────────────────────────────────────────────────────

  private handleSelectPointerDown(e: PointerEvent, scene: { x: number; y: number }): void {
    const canvasNodes = this.nodes.filter(n => n.type !== 'sticky');

    // Check resize/rotate handle first
    for (const id of this.selectedIds) {
      const node = this.nodes.find(n => n.id === id);
      if (!node || node.type === 'sticky') continue;
      const handle = hitTestHandle(node, scene.x, scene.y, this.viewport.getZoom());
      if (handle) {
        // TODO: resize/rotate logic (Phase 3 extension)
        return;
      }
    }

    const hit = hitTestNodes(canvasNodes, scene.x, scene.y);

    if (hit) {
      if (e.shiftKey) {
        // Toggle selection
        if (this.selectedIds.has(hit)) this.selectedIds.delete(hit);
        else this.selectedIds.add(hit);
      } else {
        if (!this.selectedIds.has(hit)) {
          this.selectedIds = new Set([hit]);
        }
      }

      // Start drag
      this.isDraggingSelection = true;
      this.dragStartSceneX = scene.x;
      this.dragStartSceneY = scene.y;
      this.dragNodeStartPositions.clear();

      for (const id of this.selectedIds) {
        const node = this.nodes.find(n => n.id === id);
        if (!node) continue;
        if (node.type === 'line' || node.type === 'arrow') {
          const n = node as any;
          this.dragNodeStartPositions.set(id, { x: n.startX, y: n.startY, startX: n.startX, startY: n.startY });
        } else {
          this.dragNodeStartPositions.set(id, { x: node.x, y: node.y });
        }
      }
    } else {
      // Start box selection
      if (!e.shiftKey) {
        this.selectedIds.clear();
      }
      this.isBoxSelecting = true;
      this.boxSelectStart = { x: scene.x, y: scene.y };
      this.boxSelectCurrent = { x: scene.x, y: scene.y };
    }

    this.callbacks.onSelectionChange([...this.selectedIds]);
    this.dirty = true;
  }

  private handleSelectPointerMove(e: PointerEvent, scene: { x: number; y: number }): void {
    if (this.isDraggingSelection) {
      const dx = scene.x - this.dragStartSceneX;
      const dy = scene.y - this.dragStartSceneY;

      for (const [id, startPos] of this.dragNodeStartPositions) {
        const node = this.nodes.find(n => n.id === id);
        if (!node) continue;

        if (node.type === 'line' || node.type === 'arrow') {
          const n = node as any;
          const origDx = n.endX - (startPos.startX ?? n.startX);
          const origDy = n.endY - (startPos.startY ?? n.startY);
          this.callbacks.onNodeUpdate(id, {
            startX: startPos.x + dx,
            startY: startPos.y + dy,
            endX: startPos.x + dx + origDx,
            endY: startPos.y + dy + origDy,
          } as any);
        } else {
          this.callbacks.onNodeUpdate(id, {
            x: startPos.x + dx,
            y: startPos.y + dy,
          });
        }
      }
      this.dirty = true;
      return;
    }

    if (this.isBoxSelecting && this.boxSelectStart) {
      this.boxSelectCurrent = { x: scene.x, y: scene.y };

      // Update selection based on box
      const selW = scene.x - this.boxSelectStart.x;
      const selH = scene.y - this.boxSelectStart.y;

      const newSelected = new Set<string>();
      for (const node of this.nodes) {
        if (node.type === 'sticky') continue;
        if (isNodeInSelectionBox(node, this.boxSelectStart.x, this.boxSelectStart.y, selW, selH)) {
          newSelected.add(node.id);
        }
      }
      this.selectedIds = newSelected;
      this.callbacks.onSelectionChange([...this.selectedIds]);
      this.dirty = true;
      return;
    }

    // Hover
    const canvasNodes = this.nodes.filter(n => n.type !== 'sticky');
    const hit = hitTestNodes(canvasNodes, scene.x, scene.y);
    if (hit !== this.hoveredId) {
      this.hoveredId = hit;
      this.dirty = true;
    }
  }

  private handleSelectPointerUp(e: PointerEvent, scene: { x: number; y: number }): void {
    this.isDraggingSelection = false;
    this.isBoxSelecting = false;
    this.boxSelectStart = null;
    this.boxSelectCurrent = null;
    this.dragNodeStartPositions.clear();
    this.dirty = true;
  }

  // ─── Wheel (zoom) ──────────────────────────────────────────────────────────

  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom or Ctrl+wheel
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.viewport.zoomAt(screenX, screenY, zoomFactor);
      this.callbacks.onViewportChange(this.viewport.getZoom());
    } else {
      // Pan
      this.viewport.pan(-e.deltaX, -e.deltaY);
    }

    this.dirty = true;
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────────

  private onKeyDown(e: KeyboardEvent): void {
    // Don't intercept when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        this.deleteSelected();
        break;
      case 'Escape':
        this.selectedIds.clear();
        this.callbacks.onSelectionChange([]);
        this.dirty = true;
        break;
      case 'a':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.selectedIds = new Set(this.nodes.filter(n => n.type !== 'sticky').map(n => n.id));
          this.callbacks.onSelectionChange([...this.selectedIds]);
          this.dirty = true;
        }
        break;
      case '0':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.resetZoom();
        }
        break;
      case '=':
      case '+':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.zoomIn();
        }
        break;
      case '-':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.zoomOut();
        }
        break;
    }
  }

  // ─── Cursor ────────────────────────────────────────────────────────────────

  private updateCursor(): void {
    const cursors: Record<ToolType, string> = {
      select: 'default',
      hand: 'grab',
      sticky: 'crosshair',
      text: 'text',
      rectangle: 'crosshair',
      ellipse: 'crosshair',
      diamond: 'crosshair',
      arrow: 'crosshair',
      line: 'crosshair',
      freedraw: 'crosshair',
      eraser: 'cell',
    };
    this.canvas.style.cursor = cursors[this.activeTool] || 'default';
  }
}
