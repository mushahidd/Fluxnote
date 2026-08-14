// Yjs Sync Manager
// Manages Y.Doc state and provides typed access to canvas data

import * as Y from 'yjs';
import { YjsProvider } from './yjsProvider';
import type { CanvasNode as ExtendedCanvasNode } from '../../types/canvas';

// Re-export the extended type as CanvasNode for backward compatibility
export type CanvasNode = ExtendedCanvasNode;

export class SyncManager {
  private doc: Y.Doc;
  private provider: YjsProvider | null = null;
  private nodesMap: Y.Map<any>;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.doc = new Y.Doc();
    this.nodesMap = this.doc.getMap('nodes');

    // Listen to changes and notify subscribers
    this.nodesMap.observe((event) => {
      console.log(`[SyncManager] nodesMap changed:`, {
        keysChanged: Array.from(event.keysChanged),
        currentSize: this.nodesMap.size,
        listenerCount: this.listeners.size
      });
      this.notifyListeners();
    });
  }

  /**
   * Connect to backend Yjs server
   */
  public async connect(roomId: string, token: string, callbacks?: {
    onSync?: (synced: boolean) => void;
    onStatus?: (status: 'connecting' | 'connected' | 'disconnected') => void;
    onError?: (error: Error) => void;
  }) {
    console.log(`[SyncManager] Connecting to room: ${roomId}`);
    
    if (this.provider) {
      this.provider.disconnect();
    }

    // Try to load initial canvas state from API with timeout
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/canvas/${roomId}`;
      console.log(`[SyncManager] Fetching initial state from: ${apiUrl}`);
      
      // Add 5 second timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        // Populate Yjs document with persisted nodes
        if (data.nodes && Array.isArray(data.nodes)) {
          console.log(`✅ [SyncManager] Loading ${data.nodes.length} persisted nodes from database`);
          
          // Clear existing nodes first
          this.nodesMap.clear();
          
          // Add each persisted node to Yjs
          for (const node of data.nodes) {
            const { id, ...nodeData } = node;
            this.nodesMap.set(id, nodeData);
          }
          
          console.log(`✅ [SyncManager] Loaded ${this.nodesMap.size} nodes into Yjs document`);
        } else {
          console.log(`[SyncManager] No persisted nodes found (new room)`);
        }
      } else {
        console.warn(`⚠️ [SyncManager] API returned ${response.status}, continuing with WebSocket only`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('⚠️ [SyncManager] API fetch timed out after 5s, continuing with WebSocket only');
      } else {
        console.warn('⚠️ [SyncManager] Could not load initial state, continuing with WebSocket only:', error.message);
      }
      // Continue anyway - WebSocket sync will work even without initial state
    }

    // Now connect WebSocket for real-time sync
    console.log(`[SyncManager] Opening WebSocket connection...`);
    this.provider = new YjsProvider(this.doc, {
      roomId,
      token,
      onSync: (synced) => {
        console.log(`[SyncManager] Sync status: ${synced ? 'synced' : 'syncing'}`);
        callbacks?.onSync?.(synced);
      },
      onStatus: (status) => {
        console.log(`[SyncManager] Connection status: ${status}`);
        callbacks?.onStatus?.(status);
      },
      onError: (error) => {
        console.error(`❌ [SyncManager] Error:`, error);
        callbacks?.onError?.(error);
      },
    });
  }

  /**
   * Disconnect from backend
   */
  public disconnect() {
    if (this.provider) {
      this.provider.disconnect();
      this.provider = null;
    }
  }

  /**
   * Get all canvas nodes
   */
  public getNodes(): CanvasNode[] {
    const nodes: CanvasNode[] = [];
    this.nodesMap.forEach((value, key) => {
      nodes.push({ id: key, ...value });
    });
    return nodes;
  }

  /**
   * Get a specific node by ID
   */
  public getNode(nodeId: string): CanvasNode | null {
    const node = this.nodesMap.get(nodeId);
    return node ? { id: nodeId, ...node } : null;
  }

  /**
   * Add or update a node
   */
  public setNode(nodeId: string, node: Omit<CanvasNode, 'id'>) {
    this.nodesMap.set(nodeId, node);
  }

  /**
   * Delete a node
   */
  public deleteNode(nodeId: string) {
    this.nodesMap.delete(nodeId);
  }

  /**
   * Update node position
   */
  public updateNodePosition(nodeId: string, position: { x: number; y: number }) {
    const node = this.nodesMap.get(nodeId);
    if (node) {
      this.nodesMap.set(nodeId, { ...node, position });
    }
  }

  /**
   * Update node content
   */
  public updateNodeContent(nodeId: string, content: any) {
    const node = this.nodesMap.get(nodeId);
    if (node) {
      this.nodesMap.set(nodeId, { ...node, content });
    }
  }

  /**
   * Update node intent (AI classification)
   */
  public updateNodeIntent(nodeId: string, intent: CanvasNode['intent']) {
    const node = this.nodesMap.get(nodeId);
    if (node) {
      this.nodesMap.set(nodeId, { ...node, intent });
    }
  }

  /**
   * Lock/unlock a node
   */
  public setNodeLocked(nodeId: string, locked: boolean) {
    const node = this.nodesMap.get(nodeId);
    if (node) {
      this.nodesMap.set(nodeId, { ...node, locked });
    }
  }

  /**
   * Update task status
   */
  public updateTaskStatus(nodeId: string, status: CanvasNode['taskStatus']) {
    const node = this.nodesMap.get(nodeId);
    if (node) {
      this.nodesMap.set(nodeId, { ...node, taskStatus: status });
    }
  }

  /**
   * Partial update — merges any fields into existing node
   * Used by canvas engine for position, size, points, etc.
   */
  public updateNode(nodeId: string, updates: Partial<CanvasNode>) {
    const node = this.nodesMap.get(nodeId);
    if (node) {
      this.nodesMap.set(nodeId, { ...node, ...updates });
    }
  }

  /**
   * Update freehand drawing points (called live during drawing)
   */
  public updateFreeDrawPoints(nodeId: string, points: number[][]) {
    const node = this.nodesMap.get(nodeId);
    if (node && node.type === 'freedraw') {
      this.nodesMap.set(nodeId, { ...node, points });
    }
  }

  /**
   * Batch position update for smooth dragging (avoids full object clone overhead)
   */
  public updateNodeXY(nodeId: string, x: number, y: number) {
    const node = this.nodesMap.get(nodeId);
    if (node) {
      this.nodesMap.set(nodeId, { ...node, x, y });
    }
  }

  /**
   * Subscribe to changes
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners() {
    console.log(`[SyncManager] Notifying ${this.listeners.size} listeners of changes`);
    this.listeners.forEach(listener => listener());
  }

  /**
   * Check if synced with server
   */
  public isSynced(): boolean {
    return this.provider?.isSynced() ?? false;
  }

  /**
   * Check if connected to server
   */
  public isConnected(): boolean {
    return this.provider?.isConnected() ?? false;
  }

  /**
   * Get the underlying Y.Doc (for advanced use)
   */
  public getDoc(): Y.Doc {
    return this.doc;
  }

  /**
   * Destroy the sync manager
   */
  public destroy() {
    this.disconnect();
    this.listeners.clear();
    this.doc.destroy();
  }
}
