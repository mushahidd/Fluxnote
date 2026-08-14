/**
 * HitTest - Pure math collision detection for canvas elements
 * No dependencies, all custom geometry code
 */

import type { CanvasNode, FreeDrawNode, LineNode, ArrowNode } from '../../types/canvas';

export interface HitTestResult {
  nodeId: string;
  handle?: ResizeHandle;
}

export type ResizeHandle =
  | 'nw' | 'n' | 'ne'
  | 'w'  |       'e'
  | 'sw' | 's' | 'se'
  | 'rotate';

const HANDLE_SIZE = 8;
const ROTATE_HANDLE_OFFSET = 20;
const HIT_SLOP = 6; // Extra pixels for easier clicking

/**
 * Test if a point hits any node, returns topmost hit
 */
export function hitTestNodes(
  nodes: CanvasNode[],
  sceneX: number,
  sceneY: number
): string | null {
  // Test in reverse order (topmost rendered last = highest z-index)
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (isPointInNode(nodes[i], sceneX, sceneY)) {
      return nodes[i].id;
    }
  }
  return null;
}

/**
 * Test if a point is inside a specific node
 */
export function isPointInNode(node: CanvasNode, px: number, py: number): boolean {
  if (node.locked) return false;

  // Rotate point into element's local space if rotated
  const { lx, ly } = toLocalSpace(node, px, py);

  switch (node.type) {
    case 'sticky':
    case 'rectangle':
    case 'text':
    case 'image':
      return isPointInRect(lx, ly, 0, 0, node.width, node.height);

    case 'ellipse':
      return isPointInEllipse(lx, ly, node.width / 2, node.height / 2);

    case 'diamond':
      return isPointInDiamond(lx, ly, node.width, node.height);

    case 'freedraw':
      return isPointNearPath((node as FreeDrawNode).points, px, py, HIT_SLOP + (node.strokeWidth || 2));

    case 'line':
    case 'arrow': {
      const n = node as LineNode | ArrowNode;
      return isPointNearSegment(px, py, n.startX, n.startY, n.endX, n.endY, HIT_SLOP + (n.strokeWidth || 2));
    }

    default:
      return false;
  }
}

/**
 * Test if a point hits a resize/rotate handle of a selected node
 */
export function hitTestHandle(
  node: CanvasNode,
  sceneX: number,
  sceneY: number,
  zoom: number
): ResizeHandle | null {
  const handles = getHandlePositions(node);
  const hitRadius = HANDLE_SIZE / zoom + 2;

  for (const [handle, pos] of Object.entries(handles)) {
    if (distance(sceneX, sceneY, pos.x, pos.y) <= hitRadius) {
      return handle as ResizeHandle;
    }
  }
  return null;
}

/**
 * Get all handle positions for a node in scene coordinates
 */
export function getHandlePositions(node: CanvasNode): Record<ResizeHandle, { x: number; y: number }> {
  const { x, y, width, height } = node;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rot = (node.rotation || 0) * Math.PI / 180;

  const rotate = (px: number, py: number) => {
    const dx = px - cx;
    const dy = py - cy;
    return {
      x: cx + dx * Math.cos(rot) - dy * Math.sin(rot),
      y: cy + dx * Math.sin(rot) + dy * Math.cos(rot)
    };
  };

  return {
    nw: rotate(x, y),
    n:  rotate(cx, y),
    ne: rotate(x + width, y),
    w:  rotate(x, cy),
    e:  rotate(x + width, cy),
    sw: rotate(x, y + height),
    s:  rotate(cx, y + height),
    se: rotate(x + width, y + height),
    rotate: rotate(cx, y - ROTATE_HANDLE_OFFSET),
  };
}

/**
 * Test if a rectangle selection box overlaps with a node
 */
export function isNodeInSelectionBox(
  node: CanvasNode,
  selX: number,
  selY: number,
  selW: number,
  selH: number
): boolean {
  const normX = selW < 0 ? selX + selW : selX;
  const normY = selH < 0 ? selY + selH : selY;
  const normW = Math.abs(selW);
  const normH = Math.abs(selH);

  // For lines/arrows use endpoint check
  if (node.type === 'line' || node.type === 'arrow') {
    const n = node as LineNode | ArrowNode;
    return (
      isPointInRect(n.startX, n.startY, normX, normY, normW, normH) ||
      isPointInRect(n.endX, n.endY, normX, normY, normW, normH)
    );
  }

  // AABB overlap check (ignores rotation for simplicity)
  return !(
    node.x + node.width < normX ||
    node.x > normX + normW ||
    node.y + node.height < normY ||
    node.y > normY + normH
  );
}

// ─── Private geometry helpers ────────────────────────────────────────────────

function toLocalSpace(node: CanvasNode, px: number, py: number) {
  const rotation = node.rotation || 0;
  if (rotation === 0) return { lx: px - node.x, ly: py - node.y };

  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const rad = -rotation * Math.PI / 180;
  const dx = px - cx;
  const dy = py - cy;

  return {
    lx: dx * Math.cos(rad) - dy * Math.sin(rad) + node.width / 2,
    ly: dx * Math.sin(rad) + dy * Math.cos(rad) + node.height / 2,
  };
}

function isPointInRect(
  px: number, py: number,
  rx: number, ry: number,
  rw: number, rh: number
): boolean {
  return px >= rx - HIT_SLOP &&
         px <= rx + rw + HIT_SLOP &&
         py >= ry - HIT_SLOP &&
         py <= ry + rh + HIT_SLOP;
}

function isPointInEllipse(
  lx: number, ly: number,
  rx: number, ry: number
): boolean {
  // Ellipse equation: (x/rx)^2 + (y/ry)^2 <= 1
  const nx = (lx - rx) / (rx + HIT_SLOP);
  const ny = (ly - ry) / (ry + HIT_SLOP);
  return nx * nx + ny * ny <= 1;
}

function isPointInDiamond(
  lx: number, ly: number,
  width: number, height: number
): boolean {
  // Diamond: |x/w| + |y/h| <= 0.5 (normalized to center)
  const cx = width / 2;
  const cy = height / 2;
  const nx = Math.abs(lx - cx) / (cx + HIT_SLOP);
  const ny = Math.abs(ly - cy) / (cy + HIT_SLOP);
  return nx + ny <= 1;
}

function isPointNearSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
  threshold: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return distance(px, py, x1, y1) <= threshold;

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return distance(px, py, closestX, closestY) <= threshold;
}

function isPointNearPath(
  points: number[][],
  px: number, py: number,
  threshold: number
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (isPointNearSegment(
      px, py,
      points[i][0], points[i][1],
      points[i + 1][0], points[i + 1][1],
      threshold
    )) return true;
  }
  return false;
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get bounding box of all nodes (for fit-to-screen)
 */
export function getNodesBounds(nodes: CanvasNode[]): {
  x: number; y: number; width: number; height: number;
} | null {
  if (nodes.length === 0) return null;

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const node of nodes) {
    if (node.type === 'line' || node.type === 'arrow') {
      const n = node as LineNode | ArrowNode;
      minX = Math.min(minX, n.startX, n.endX);
      minY = Math.min(minY, n.startY, n.endY);
      maxX = Math.max(maxX, n.startX, n.endX);
      maxY = Math.max(maxY, n.startY, n.endY);
    } else if (node.type === 'freedraw') {
      const n = node as FreeDrawNode;
      for (const [px, py] of n.points) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    } else {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }
  }

  return {
    x: minX, y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Ramer-Douglas-Peucker algorithm to reduce freehand points
 * Keeps visual fidelity while reducing point count for sync performance
 */
export function simplifyPoints(points: number[][], tolerance: number = 2): number[][] {
  if (points.length <= 2) return points;

  const sqTolerance = tolerance * tolerance;

  function getSqDist(p1: number[], p2: number[]): number {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return dx * dx + dy * dy;
  }

  function getSqSegDist(p: number[], p1: number[], p2: number[]): number {
    let x = p1[0], y = p1[1];
    let dx = p2[0] - x, dy = p2[1] - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = p2[0]; y = p2[1]; }
      else if (t > 0) { x += dx * t; y += dy * t; }
    }

    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  }

  function simplifyDPStep(
    pts: number[][],
    first: number,
    last: number,
    sqTol: number,
    simplified: number[][]
  ) {
    let maxSqDist = sqTol;
    let index = -1;

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(pts[i], pts[first], pts[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (index !== -1) {
      if (index - first > 1) simplifyDPStep(pts, first, index, sqTol, simplified);
      simplified.push(pts[index]);
      if (last - index > 1) simplifyDPStep(pts, index, last, sqTol, simplified);
    }
  }

  const last = points.length - 1;
  const simplified = [points[0]];
  simplifyDPStep(points, 0, last, sqTolerance, simplified);
  simplified.push(points[last]);

  return simplified;
}
