/**
 * Viewport - Manages pan/zoom transformations for infinite canvas
 * Pure coordinate transformation math, no dependencies
 */

export interface ViewportState {
  scrollX: number;  // Pan offset X (scene coordinates)
  scrollY: number;  // Pan offset Y (scene coordinates)
  zoom: number;     // Zoom level (1.0 = 100%, 0.5 = 50%, 2.0 = 200%)
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export class Viewport {
  private state: ViewportState;
  private canvasWidth: number;
  private canvasHeight: number;
  
  // Zoom constraints
  private readonly MIN_ZOOM = 0.1;  // 10%
  private readonly MAX_ZOOM = 5.0;  // 500%
  
  constructor(canvasWidth: number, canvasHeight: number) {
    this.state = {
      scrollX: 0,
      scrollY: 0,
      zoom: 1.0
    };
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }
  
  /**
   * Convert screen coordinates (mouse position) to scene coordinates (element position)
   */
  screenToScene(screenX: number, screenY: number): Point {
    return {
      x: screenX / this.state.zoom - this.state.scrollX,
      y: screenY / this.state.zoom - this.state.scrollY
    };
  }
  
  /**
   * Convert scene coordinates (element position) to screen coordinates (canvas pixels)
   */
  sceneToScreen(sceneX: number, sceneY: number): Point {
    return {
      x: (sceneX + this.state.scrollX) * this.state.zoom,
      y: (sceneY + this.state.scrollY) * this.state.zoom
    };
  }
  
  /**
   * Pan the viewport by delta pixels (screen space)
   */
  pan(deltaX: number, deltaY: number): void {
    this.state.scrollX += deltaX / this.state.zoom;
    this.state.scrollY += deltaY / this.state.zoom;
  }

  /**
   * Pan the viewport to an absolute scroll position (scene space)
   */
  panTo(scrollX: number, scrollY: number): void {
    this.state.scrollX = scrollX;
    this.state.scrollY = scrollY;
  }
  
  /**
   * Zoom in/out around a specific point (usually mouse position)
   */
  zoomAt(screenX: number, screenY: number, zoomDelta: number): void {
    const oldZoom = this.state.zoom;
    const newZoom = this.clampZoom(oldZoom * zoomDelta);
    
    if (newZoom === oldZoom) return;
    
    // Calculate scene point under cursor before zoom
    const scenePoint = this.screenToScene(screenX, screenY);
    
    // Apply new zoom
    this.state.zoom = newZoom;
    
    // Adjust scroll to keep scene point under cursor
    const newScreenPoint = this.sceneToScreen(scenePoint.x, scenePoint.y);
    this.state.scrollX += (screenX - newScreenPoint.x) / this.state.zoom;
    this.state.scrollY += (screenY - newScreenPoint.y) / this.state.zoom;
  }
  
  /**
   * Set zoom to specific level (centered on canvas)
   */
  setZoom(zoom: number): void {
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;
    this.zoomAt(centerX, centerY, zoom / this.state.zoom);
  }
  
  /**
   * Reset viewport to default (0, 0, 100%)
   */
  reset(): void {
    this.state.scrollX = 0;
    this.state.scrollY = 0;
    this.state.zoom = 1.0;
  }
  
  /**
   * Get visible bounds in scene coordinates
   * Used for viewport culling (only render visible elements)
   */
  getVisibleBounds(): Bounds {
    const topLeft = this.screenToScene(0, 0);
    const bottomRight = this.screenToScene(this.canvasWidth, this.canvasHeight);
    
    return {
      left: topLeft.x,
      top: topLeft.y,
      right: bottomRight.x,
      bottom: bottomRight.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y
    };
  }
  
  /**
   * Check if a rectangle intersects with visible viewport
   */
  isRectVisible(x: number, y: number, width: number, height: number): boolean {
    const bounds = this.getVisibleBounds();
    
    return !(
      x + width < bounds.left ||
      x > bounds.right ||
      y + height < bounds.top ||
      y > bounds.bottom
    );
  }
  
  /**
   * Apply viewport transform to canvas context
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(
      this.state.zoom,
      0,
      0,
      this.state.zoom,
      this.state.scrollX * this.state.zoom,
      this.state.scrollY * this.state.zoom
    );
  }
  
  /**
   * Reset canvas transform to identity
   */
  resetTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  
  /**
   * Update canvas dimensions (on resize)
   */
  setCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }
  
  /**
   * Get current viewport state (for React state sync)
   */
  getState(): ViewportState {
    return { ...this.state };
  }
  
  /**
   * Set viewport state (from React state)
   */
  setState(state: Partial<ViewportState>): void {
    if (state.scrollX !== undefined) this.state.scrollX = state.scrollX;
    if (state.scrollY !== undefined) this.state.scrollY = state.scrollY;
    if (state.zoom !== undefined) this.state.zoom = this.clampZoom(state.zoom);
  }
  
  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.state.zoom;
  }

  /**
   * Get current canvas width
   */
  getWidth(): number {
    return this.canvasWidth;
  }

  /**
   * Get current canvas height
   */
  getHeight(): number {
    return this.canvasHeight;
  }
  
  /**
   * Get current scroll position
   */
  getScroll(): { x: number; y: number } {
    return {
      x: this.state.scrollX,
      y: this.state.scrollY
    };
  }
  
  /**
   * Clamp zoom to valid range
   */
  private clampZoom(zoom: number): number {
    return Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, zoom));
  }
  
  /**
   * Fit bounds to viewport (zoom to fit all elements)
   */
  fitBounds(bounds: Bounds, padding: number = 50): void {
    const paddedWidth = bounds.width + padding * 2;
    const paddedHeight = bounds.height + padding * 2;
    
    const zoomX = this.canvasWidth / paddedWidth;
    const zoomY = this.canvasHeight / paddedHeight;
    const newZoom = this.clampZoom(Math.min(zoomX, zoomY));
    
    this.state.zoom = newZoom;
    
    // Center the bounds
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    
    this.state.scrollX = this.canvasWidth / (2 * newZoom) - centerX;
    this.state.scrollY = this.canvasHeight / (2 * newZoom) - centerY;
  }
}
