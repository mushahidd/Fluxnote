/**
 * Extended Canvas Node Types
 * Supports sticky notes, shapes, freehand drawing, text blocks, and arrows
 */

// Base properties shared by all elements
export interface BaseCanvasNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  locked?: boolean;
  createdBy: string;
  createdAt: string;
  
  // Style properties
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  
  // Fluxnote-specific (existing)
  intent?: 'action' | 'decision' | 'question' | 'reference';
  taskStatus?: 'backlog' | 'todo' | 'in_progress' | 'done';
  assignee?: string;
  color?: string; // For sticky notes
}

// Sticky note (existing, DOM-rendered)
export interface StickyNoteNode extends BaseCanvasNode {
  type: 'sticky';
  content: {
    text: string;
  };
}

// Text block (canvas-rendered)
export interface TextNode extends BaseCanvasNode {
  type: 'text';
  text: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

// Rectangle shape
export interface RectangleNode extends BaseCanvasNode {
  type: 'rectangle';
  cornerRadius?: number;
}

// Ellipse/Circle shape
export interface EllipseNode extends BaseCanvasNode {
  type: 'ellipse';
}

// Diamond shape
export interface DiamondNode extends BaseCanvasNode {
  type: 'diamond';
}

// Freehand drawing
export interface FreeDrawNode extends BaseCanvasNode {
  type: 'freedraw';
  points: number[][]; // [[x, y], [x, y], ...]
  pressureEnabled?: boolean;
}

// Line (straight)
export interface LineNode extends BaseCanvasNode {
  type: 'line';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// Arrow (line with arrowhead)
export interface ArrowNode extends BaseCanvasNode {
  type: 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startArrowhead?: boolean;
  endArrowhead?: boolean;
  elbowed?: boolean; // Right-angle connector
}

// Image
export interface ImageNode extends BaseCanvasNode {
  type: 'image';
  imageUrl: string;
  imageData?: string; // Base64 data URL
}

// Union type of all node types
export type CanvasNode =
  | StickyNoteNode
  | TextNode
  | RectangleNode
  | EllipseNode
  | DiamondNode
  | FreeDrawNode
  | LineNode
  | ArrowNode
  | ImageNode;

// Type guards
export function isStickyNote(node: CanvasNode): node is StickyNoteNode {
  return node.type === 'sticky';
}

export function isTextNode(node: CanvasNode): node is TextNode {
  return node.type === 'text';
}

export function isRectangle(node: CanvasNode): node is RectangleNode {
  return node.type === 'rectangle';
}

export function isEllipse(node: CanvasNode): node is EllipseNode {
  return node.type === 'ellipse';
}

export function isDiamond(node: CanvasNode): node is DiamondNode {
  return node.type === 'diamond';
}

export function isFreeDraw(node: CanvasNode): node is FreeDrawNode {
  return node.type === 'freedraw';
}

export function isLine(node: CanvasNode): node is LineNode {
  return node.type === 'line';
}

export function isArrow(node: CanvasNode): node is ArrowNode {
  return node.type === 'arrow';
}

export function isImage(node: CanvasNode): node is ImageNode {
  return node.type === 'image';
}

export function isShape(node: CanvasNode): node is RectangleNode | EllipseNode | DiamondNode {
  return node.type === 'rectangle' || node.type === 'ellipse' || node.type === 'diamond';
}

// Tool types
export type ToolType =
  | 'select'
  | 'hand'
  | 'sticky'
  | 'text'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'eraser';

// Selection state
export interface SelectionState {
  selectedIds: Set<string>;
  hoveredId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  isRotating: boolean;
}

// Interaction state
export interface InteractionState {
  activeTool: ToolType;
  isDrawing: boolean;
  isPanning: boolean;
  startPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number } | null;
}
