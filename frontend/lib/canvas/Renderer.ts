/**
 * Renderer - Pure HTML5 Canvas 2D API rendering
 * Zero dependencies. All shapes drawn with ctx primitives.
 */

import type {
  CanvasNode,
  RectangleNode,
  EllipseNode,
  DiamondNode,
  FreeDrawNode,
  LineNode,
  ArrowNode,
  TextNode,
  StickyNoteNode,
} from '../../types/canvas';
import type { Viewport } from './Viewport';
import { getHandlePositions } from './HitTest';

const SELECTION_COLOR = '#4f8ef7';
const HANDLE_SIZE = 8;
const ROTATE_HANDLE_OFFSET = 20;

// ─── Grid ────────────────────────────────────────────────────────────────────

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number
): void {
  const state = viewport.getState();
  const zoom = state.zoom;
  const gridSize = 40;

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 1;

  // Calculate grid offset so lines stay fixed as user pans
  const offsetX = ((state.scrollX * zoom) % (gridSize * zoom) + gridSize * zoom) % (gridSize * zoom);
  const offsetY = ((state.scrollY * zoom) % (gridSize * zoom) + gridSize * zoom) % (gridSize * zoom);

  // Vertical lines
  for (let x = offsetX - gridSize * zoom; x < canvasWidth + gridSize * zoom; x += gridSize * zoom) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = offsetY - gridSize * zoom; y < canvasHeight + gridSize * zoom; y += gridSize * zoom) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

export function renderNode(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  viewport: Viewport,
  isSelected: boolean,
  isHovered: boolean
): void {
  ctx.save();
  ctx.globalAlpha = (node.opacity ?? 100) / 100;

  // Apply viewport transform then element rotation
  viewport.applyTransform(ctx);
  applyRotation(ctx, node);

  switch (node.type) {
    case 'rectangle': renderRectangle(ctx, node as RectangleNode); break;
    case 'ellipse':   renderEllipse(ctx, node as EllipseNode);     break;
    case 'diamond':   renderDiamond(ctx, node as DiamondNode);     break;
    case 'text':      renderText(ctx, node as TextNode);           break;
    case 'freedraw':  renderFreeDraw(ctx, node as FreeDrawNode);   break;
    case 'line':      renderLine(ctx, node as LineNode);           break;
    case 'arrow':     renderArrow(ctx, node as ArrowNode);         break;
    // sticky notes are rendered as DOM elements, not on canvas
  }

  ctx.restore();

  // Draw selection/hover UI on top (in screen space, no rotation)
  if (isSelected) renderSelectionBox(ctx, node, viewport);
  else if (isHovered) renderHoverOutline(ctx, node, viewport);
}

// ─── Shape renderers ─────────────────────────────────────────────────────────

function renderRectangle(ctx: CanvasRenderingContext2D, node: RectangleNode): void {
  const { x, y, width, height, strokeColor, backgroundColor, strokeWidth, strokeStyle, cornerRadius } = node;

  ctx.beginPath();

  if (cornerRadius && cornerRadius > 0) {
    const r = Math.min(cornerRadius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  } else {
    ctx.rect(x, y, width, height);
  }

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fill();
  }

  if (strokeColor) {
    applyStrokeStyle(ctx, strokeStyle, strokeWidth);
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }
}

function renderEllipse(ctx: CanvasRenderingContext2D, node: EllipseNode): void {
  const { x, y, width, height, strokeColor, backgroundColor, strokeWidth, strokeStyle } = node;
  const cx = x + width / 2;
  const cy = y + height / 2;

  ctx.beginPath();
  ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fill();
  }

  if (strokeColor) {
    applyStrokeStyle(ctx, strokeStyle, strokeWidth);
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }
}

function renderDiamond(ctx: CanvasRenderingContext2D, node: DiamondNode): void {
  const { x, y, width, height, strokeColor, backgroundColor, strokeWidth, strokeStyle } = node;
  const cx = x + width / 2;
  const cy = y + height / 2;

  ctx.beginPath();
  ctx.moveTo(cx, y);              // top
  ctx.lineTo(x + width, cy);     // right
  ctx.lineTo(cx, y + height);    // bottom
  ctx.lineTo(x, cy);             // left
  ctx.closePath();

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fill();
  }

  if (strokeColor) {
    applyStrokeStyle(ctx, strokeStyle, strokeWidth);
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }
}

function renderText(ctx: CanvasRenderingContext2D, node: TextNode): void {
  const {
    x, y, width, height,
    text, fontSize = 16, fontFamily = 'Inter, sans-serif',
    strokeColor = '#1a1a1a', backgroundColor,
    textAlign = 'left', verticalAlign = 'top'
  } = node;

  // Safety check for undefined text
  if (!text) {
    return;
  }

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(x, y, width, height);
  }

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = strokeColor;
  ctx.textAlign = textAlign as CanvasTextAlign;
  ctx.textBaseline = 'top';

  const lineHeight = fontSize * 1.4;
  const lines = wrapText(ctx, text, width - 8);

  let startY = y + 4;
  if (verticalAlign === 'middle') {
    startY = y + (height - lines.length * lineHeight) / 2;
  } else if (verticalAlign === 'bottom') {
    startY = y + height - lines.length * lineHeight - 4;
  }

  const startX = textAlign === 'center' ? x + width / 2
               : textAlign === 'right'  ? x + width - 4
               : x + 4;

  for (const line of lines) {
    ctx.fillText(line, startX, startY);
    startY += lineHeight;
  }
}

function renderFreeDraw(ctx: CanvasRenderingContext2D, node: FreeDrawNode): void {
  const { points, strokeColor = '#1a1a1a', strokeWidth = 2 } = node;
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.moveTo(points[0][0], points[0][1]);

  // Smooth curve using midpoints (quadratic bezier between consecutive midpoints)
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i][0] + points[i + 1][0]) / 2;
    const midY = (points[i][1] + points[i + 1][1]) / 2;
    ctx.quadraticCurveTo(points[i][0], points[i][1], midX, midY);
  }

  // Last point
  const last = points[points.length - 1];
  ctx.lineTo(last[0], last[1]);

  ctx.stroke();
}

function renderLine(ctx: CanvasRenderingContext2D, node: LineNode): void {
  const { startX, startY, endX, endY, strokeColor = '#1a1a1a', strokeWidth = 2, strokeStyle } = node;

  ctx.beginPath();
  applyStrokeStyle(ctx, strokeStyle, strokeWidth);
  ctx.strokeStyle = strokeColor;
  ctx.lineCap = 'round';
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
}

function renderArrow(ctx: CanvasRenderingContext2D, node: ArrowNode): void {
  const {
    startX, startY, endX, endY,
    strokeColor = '#1a1a1a', strokeWidth = 2, strokeStyle,
    startArrowhead = false, endArrowhead = true,
    elbowed = false
  } = node;

  ctx.beginPath();
  applyStrokeStyle(ctx, strokeStyle, strokeWidth);
  ctx.strokeStyle = strokeColor;
  ctx.lineCap = 'round';

  if (elbowed) {
    // Right-angle connector: go horizontal then vertical
    const midX = (startX + endX) / 2;
    ctx.moveTo(startX, startY);
    ctx.lineTo(midX, startY);
    ctx.lineTo(midX, endY);
    ctx.lineTo(endX, endY);
  } else {
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
  }

  ctx.stroke();

  // Draw arrowheads
  const angle = Math.atan2(endY - startY, endX - startX);
  const headLen = Math.max(12, strokeWidth * 4);

  if (endArrowhead) {
    drawArrowhead(ctx, endX, endY, angle, headLen, strokeColor, strokeWidth);
  }
  if (startArrowhead) {
    drawArrowhead(ctx, startX, startY, angle + Math.PI, headLen, strokeColor, strokeWidth);
  }
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  headLen: number,
  color: string,
  strokeWidth: number
): void {
  const spread = Math.PI / 6; // 30 degrees

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - headLen * Math.cos(angle - spread),
    y - headLen * Math.sin(angle - spread)
  );
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - headLen * Math.cos(angle + spread),
    y - headLen * Math.sin(angle + spread)
  );

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// ─── Selection UI ─────────────────────────────────────────────────────────────

export function renderSelectionBox(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  viewport: Viewport
): void {
  if (node.type === 'line' || node.type === 'arrow') {
    renderLineSelection(ctx, node as LineNode | ArrowNode, viewport);
    return;
  }
  if (node.type === 'freedraw') {
    renderFreeDrawSelection(ctx, node as FreeDrawNode, viewport);
    return;
  }

  const handles = getHandlePositions(node);
  const zoom = viewport.getZoom();
  const scroll = viewport.getScroll();

  // Convert scene handles to screen positions
  const toScreen = (sx: number, sy: number) => ({
    x: (sx + scroll.x) * zoom,
    y: (sy + scroll.y) * zoom
  });

  // Dashed selection border
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // screen space

  const tl = toScreen(node.x, node.y);
  const w = node.width * zoom;
  const h = node.height * zoom;
  const rot = (node.rotation || 0) * Math.PI / 180;
  const cx = tl.x + w / 2;
  const cy = tl.y + h / 2;

  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.translate(-w / 2, -h / 2);

  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(-1, -1, w + 2, h + 2);
  ctx.setLineDash([]);

  ctx.restore();

  // Draw handles in screen space
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  for (const [handle, pos] of Object.entries(handles)) {
    const sp = toScreen(pos.x, pos.y);

    if (handle === 'rotate') {
      // Circular rotate handle
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, HANDLE_SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Square resize handle
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5;
      ctx.fillRect(sp.x - HANDLE_SIZE / 2, sp.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(sp.x - HANDLE_SIZE / 2, sp.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    }
  }

  ctx.restore();
}

function renderHoverOutline(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  viewport: Viewport
): void {
  if (node.type === 'line' || node.type === 'arrow' || node.type === 'freedraw') return;

  const zoom = viewport.getZoom();
  const scroll = viewport.getScroll();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const sx = (node.x + scroll.x) * zoom;
  const sy = (node.y + scroll.y) * zoom;
  const sw = node.width * zoom;
  const sh = node.height * zoom;
  const rot = (node.rotation || 0) * Math.PI / 180;

  ctx.translate(sx + sw / 2, sy + sh / 2);
  ctx.rotate(rot);

  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(-sw / 2 - 1, -sh / 2 - 1, sw + 2, sh + 2);
  ctx.setLineDash([]);

  ctx.restore();
}

function renderLineSelection(
  ctx: CanvasRenderingContext2D,
  node: LineNode | ArrowNode,
  viewport: Viewport
): void {
  const zoom = viewport.getZoom();
  const scroll = viewport.getScroll();
  const toScreen = (sx: number, sy: number) => ({
    x: (sx + scroll.x) * zoom,
    y: (sy + scroll.y) * zoom
  });

  const start = toScreen(node.startX, node.startY);
  const end = toScreen(node.endX, node.endY);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Endpoint handles
  for (const pt of [start, end]) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, HANDLE_SIZE / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

function renderFreeDrawSelection(
  ctx: CanvasRenderingContext2D,
  node: FreeDrawNode,
  viewport: Viewport
): void {
  if (node.points.length === 0) return;

  const zoom = viewport.getZoom();
  const scroll = viewport.getScroll();

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of node.points) {
    minX = Math.min(minX, px); minY = Math.min(minY, py);
    maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
  }

  const sx = (minX + scroll.x) * zoom;
  const sy = (minY + scroll.y) * zoom;
  const sw = (maxX - minX) * zoom;
  const sh = (maxY - minY) * zoom;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(sx - 4, sy - 4, sw + 8, sh + 8);
  ctx.setLineDash([]);
  ctx.restore();
}

// ─── Selection rectangle (drag to select) ────────────────────────────────────

export function renderSelectionRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  width: number, height: number
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(79, 142, 247, 0.08)';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);
  ctx.restore();
}

// ─── In-progress drawing preview ─────────────────────────────────────────────

export function renderDrawingPreview(
  ctx: CanvasRenderingContext2D,
  type: string,
  startX: number, startY: number,
  endX: number, endY: number,
  viewport: Viewport
): void {
  const zoom = viewport.getZoom();
  const scroll = viewport.getScroll();

  const sx = (startX + scroll.x) * zoom;
  const sy = (startY + scroll.y) * zoom;
  const ex = (endX + scroll.x) * zoom;
  const ey = (endY + scroll.y) * zoom;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);

  ctx.beginPath();

  switch (type) {
    case 'rectangle':
      ctx.strokeRect(sx, sy, ex - sx, ey - sy);
      break;
    case 'ellipse':
      ctx.ellipse(
        (sx + ex) / 2, (sy + ey) / 2,
        Math.abs(ex - sx) / 2, Math.abs(ey - sy) / 2,
        0, 0, Math.PI * 2
      );
      ctx.stroke();
      break;
    case 'diamond': {
      const cx = (sx + ex) / 2;
      const cy = (sy + ey) / 2;
      ctx.moveTo(cx, sy);
      ctx.lineTo(ex, cy);
      ctx.lineTo(cx, ey);
      ctx.lineTo(sx, cy);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'line':
    case 'arrow':
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      break;
  }

  ctx.setLineDash([]);
  ctx.restore();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyRotation(ctx: CanvasRenderingContext2D, node: CanvasNode): void {
  const rotation = node.rotation || 0;
  if (rotation === 0) return;

  if (node.type === 'line' || node.type === 'arrow' || node.type === 'freedraw') return;

  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  ctx.translate(cx, cy);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.translate(-cx, -cy);
}

function applyStrokeStyle(
  ctx: CanvasRenderingContext2D,
  style: string | undefined,
  width: number | undefined
): void {
  const w = width || 2;
  ctx.lineWidth = w;

  switch (style) {
    case 'dashed':
      ctx.setLineDash([w * 4, w * 2]);
      break;
    case 'dotted':
      ctx.setLineDash([w, w * 2]);
      break;
    default:
      ctx.setLineDash([]);
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  // Safety check for undefined or null text
  if (!text) {
    return [];
  }
  
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}
