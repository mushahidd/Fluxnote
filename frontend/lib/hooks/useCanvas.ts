// useCanvas Hook
// React hook for accessing and manipulating canvas data via Yjs

import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncManager } from '../yjs/syncManager';
import type { CanvasNode } from '../../types/canvas';
import { useAuth } from '../auth-context';

// Per-room singletons — survive React StrictMode double-mount
const roomSyncManagers = new Map<string, SyncManager>();
// Reference count per room so we only destroy when truly no consumers remain
const roomRefCountMap = new Map<string, number>();

export interface UseCanvasOptions {
  roomId: string;
  autoConnect?: boolean;
}

export interface UseCanvasReturn {
  nodes: CanvasNode[];
  isConnected: boolean;
  isSynced: boolean;
  status: 'connecting' | 'connected' | 'disconnected';
  addNode: (node: Omit<CanvasNode, 'id' | 'createdBy' | 'createdAt'>) => string;
  updateNode: (nodeId: string, updates: Partial<Omit<CanvasNode, 'id'>>) => void;
  deleteNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  updateNodeContent: (nodeId: string, content: any) => void;
  updateNodeIntent: (nodeId: string, intent: CanvasNode['intent']) => void;
  setNodeLocked: (nodeId: string, locked: boolean) => void;
  updateTaskStatus: (nodeId: string, status: CanvasNode['taskStatus']) => void;
  getNode: (nodeId: string) => CanvasNode | null;
  connect: () => void;
  disconnect: () => void;
}

export function useCanvas(options: UseCanvasOptions): UseCanvasReturn {
  const { roomId, autoConnect = true } = options;
  const { user } = useAuth();
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const syncManagerRef = useRef<SyncManager | null>(null);

  // Initialize sync manager (per-room singleton) with ref counting
  useEffect(() => {
    if (!roomSyncManagers.has(roomId)) {
      roomSyncManagers.set(roomId, new SyncManager());
    }
    const manager = roomSyncManagers.get(roomId)!;
    syncManagerRef.current = manager;

    // Increment ref count
    roomRefCountMap.set(roomId, (roomRefCountMap.get(roomId) ?? 0) + 1);

    // Subscribe to changes
    const unsubscribe = manager.subscribe(() => {
      const newNodes = manager.getNodes();
      setNodes(newNodes);
      setIsConnected(manager.isConnected());
      setIsSynced(manager.isSynced());
    });

    // Sync current state immediately
    setNodes(manager.getNodes());
    setIsConnected(manager.isConnected());
    setIsSynced(manager.isSynced());
    if (manager.isConnected()) setStatus('connected');

    return () => {
      unsubscribe();

      // Decrement ref count; only disconnect when no consumers remain
      const count = (roomRefCountMap.get(roomId) ?? 1) - 1;
      roomRefCountMap.set(roomId, count);

      if (count <= 0) {
        roomRefCountMap.delete(roomId);
        // Don't destroy the SyncManager — keep Y.Doc state alive for fast re-entry
        // Just disconnect the WebSocket
        manager.disconnect();
        roomSyncManagers.delete(roomId);
      }
    };
  }, [roomId]);

  // Connect to backend
  const connect = useCallback(() => {
    const manager = syncManagerRef.current;
    if (!manager) {
      console.warn('[useCanvas] Cannot connect - missing syncManager');
      return;
    }

    // Already connected or connecting — don't open a second connection
    if (manager.isConnected()) {
      setIsConnected(true);
      setStatus('connected');
      return;
    }

    const getToken = async (): Promise<string> => {
      try {
        const { supabase } = await import('../supabase');
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          localStorage.setItem('auth_token', data.session.access_token);
          return data.session.access_token;
        }
      } catch {
        // supabase not available
      }
      const token = localStorage.getItem('auth_token');
      if (token) return token;
      // No token — connect as guest (backend allows this)
      console.warn('[useCanvas] No auth token — connecting as guest');
      return '';
    };

    getToken().then(async (token) => {
      // Guard: check again after async token fetch
      if (manager.isConnected()) return;

      await manager.connect(roomId, token, {
        onSync: (synced) => {
          setIsSynced(synced);
        },
        onStatus: (newStatus) => {
          setStatus(newStatus);
          setIsConnected(newStatus === 'connected');
          if (newStatus === 'connected') {
            setNodes(manager.getNodes());
          }
        },
        onError: (error) => {
          console.error('❌ [useCanvas] Connection error:', error.message);
        },
      });
    });
  }, [roomId]);

  // Disconnect from backend (explicit user action)
  const disconnect = useCallback(() => {
    syncManagerRef.current?.disconnect();
    setIsConnected(false);
    setIsSynced(false);
    setStatus('disconnected');
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
  }, [autoConnect, connect]);

  // Add a new node
  const addNode = useCallback((node: Omit<CanvasNode, 'id' | 'createdBy' | 'createdAt'>): string => {
    if (!syncManagerRef.current) {
      console.error('[useCanvas] Cannot add node - syncManager not initialized');
      return '';
    }
    
    // Block if user is a viewer
    if (user?.role === 'viewer' || user?.role === 'Viewer') {
      console.warn('[useCanvas] Viewers cannot add nodes');
      return '';
    }
    
    const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullNode: Omit<CanvasNode, 'id'> = {
      ...node,
      createdBy: user?.id || 'local',
      createdAt: new Date().toISOString(),
    };
    syncManagerRef.current.setNode(nodeId, fullNode);
    return nodeId;
  }, [user]);

  const updateNode = useCallback((nodeId: string, updates: Partial<Omit<CanvasNode, 'id'>>) => {
    // Block if user is a viewer
    if (user?.role === 'viewer' || user?.role === 'Viewer') {
      console.warn('[useCanvas] Viewers cannot update nodes');
      return;
    }
    syncManagerRef.current?.updateNode(nodeId, updates as Partial<CanvasNode>);
  }, [user]);

  const deleteNode = useCallback((nodeId: string) => {
    // Block if user is a viewer
    if (user?.role === 'viewer' || user?.role === 'Viewer') {
      console.warn('[useCanvas] Viewers cannot delete nodes');
      return;
    }
    syncManagerRef.current?.deleteNode(nodeId);
  }, [user]);

  const updateNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    // Block if user is a viewer
    if (user?.role === 'viewer' || user?.role === 'Viewer') {
      console.warn('[useCanvas] Viewers cannot move nodes');
      return;
    }
    syncManagerRef.current?.updateNodePosition(nodeId, position);
  }, [user]);

  const updateNodeContent = useCallback((nodeId: string, content: any) => {
    // Block if user is a viewer
    if (user?.role === 'viewer' || user?.role === 'Viewer') {
      console.warn('[useCanvas] Viewers cannot edit node content');
      return;
    }
    syncManagerRef.current?.updateNodeContent(nodeId, content);
  }, [user]);

  const updateNodeIntent = useCallback((nodeId: string, intent: CanvasNode['intent']) => {
    // Block if user is a viewer
    if (user?.role === 'viewer' || user?.role === 'Viewer') {
      console.warn('[useCanvas] Viewers cannot change node intent');
      return;
    }
    syncManagerRef.current?.updateNodeIntent(nodeId, intent);
  }, [user]);

  const setNodeLocked = useCallback((nodeId: string, locked: boolean) => {
    // Block if user is a viewer
    if (user?.role === 'viewer' || user?.role === 'Viewer') {
      console.warn('[useCanvas] Viewers cannot lock/unlock nodes');
      return;
    }
    syncManagerRef.current?.setNodeLocked(nodeId, locked);
  }, [user]);

  const updateTaskStatus = useCallback((nodeId: string, status: CanvasNode['taskStatus']) => {
    // Block if user is a viewer
    if (user?.role === 'viewer' || user?.role === 'Viewer') {
      console.warn('[useCanvas] Viewers cannot update task status');
      return;
    }
    syncManagerRef.current?.updateTaskStatus(nodeId, status);
  }, [user]);

  const getNode = useCallback((nodeId: string): CanvasNode | null => {
    return syncManagerRef.current?.getNode(nodeId) ?? null;
  }, []);

  return {
    nodes,
    isConnected,
    isSynced,
    status,
    addNode,
    updateNode,
    deleteNode,
    updateNodePosition,
    updateNodeContent,
    updateNodeIntent,
    setNodeLocked,
    updateTaskStatus,
    getNode,
    connect,
    disconnect,
  };
}
