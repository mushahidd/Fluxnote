// usePresence Hook
// React hook for tracking user presence and cursor positions via WebSocket

import { useState, useEffect, useCallback, useRef } from 'react';
import { Awareness, type UserCursor } from '../yjs/awareness';
import { useAuth } from '../auth-context';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

// Per-room singletons — survive React StrictMode double-mount
const roomAwarenessMap = new Map<string, Awareness>();
const roomWsMap = new Map<string, WebSocket>();
const roomReconnectCountMap = new Map<string, number>();
// Reference count per room so we only close when truly no consumers remain
const roomRefCountMap = new Map<string, number>();

export interface UsePresenceOptions {
  roomId: string;
  autoConnect?: boolean;
}

export interface UsePresenceReturn {
  cursors: UserCursor[];
  isConnected: boolean;
  updateCursor: (x: number, y: number) => void;
  connect: () => void;
  disconnect: () => void;
}

export function usePresence(options: UsePresenceOptions): UsePresenceReturn {
  const { roomId, autoConnect = true } = options;
  const { user } = useAuth();
  const [cursors, setCursors] = useState<UserCursor[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;

  // Increment ref count and set up awareness on mount; decrement on unmount
  useEffect(() => {
    // Ensure awareness exists for this room
    if (!roomAwarenessMap.has(roomId)) {
      roomAwarenessMap.set(roomId, new Awareness());
    }
    const awareness = roomAwarenessMap.get(roomId)!;

    if (user) {
      awareness.setLocalUser(user.id);
    }

    // Increment ref count
    roomRefCountMap.set(roomId, (roomRefCountMap.get(roomId) ?? 0) + 1);

    // Sync current connection state
    const existingWs = roomWsMap.get(roomId);
    if (existingWs?.readyState === WebSocket.OPEN) {
      setIsConnected(true);
    }

    // Subscribe to cursor changes
    const unsubscribe = awareness.subscribe(() => {
      setCursors(awareness.getCursors());
    });

    // Cleanup stale cursors every 10 seconds
    const cleanupInterval = setInterval(() => {
      awareness.cleanupStaleCursors();
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(cleanupInterval);

      // Decrement ref count; only close WS when no consumers remain
      const count = (roomRefCountMap.get(roomId) ?? 1) - 1;
      roomRefCountMap.set(roomId, count);

      if (count <= 0) {
        roomRefCountMap.delete(roomId);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        const ws = roomWsMap.get(roomId);
        if (ws) {
          ws.close();
          roomWsMap.delete(roomId);
        }
        roomReconnectCountMap.delete(roomId);
      }
    };
  }, [roomId, user]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Reuse existing open connection for this room
    const existingWs = roomWsMap.get(roomId);
    if (existingWs?.readyState === WebSocket.OPEN) {
      setIsConnected(true);
      return;
    }
    // Don't open a second connection if one is already connecting
    if (existingWs?.readyState === WebSocket.CONNECTING) {
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
        // fall through
      }
      return localStorage.getItem('auth_token') ?? '';
    };

    getToken().then((token) => {
      // Guard: if a connection was opened while we were awaiting the token, bail
      const raceWs = roomWsMap.get(roomId);
      if (raceWs?.readyState === WebSocket.OPEN || raceWs?.readyState === WebSocket.CONNECTING) {
        return;
      }

      try {
        const url = `${WS_URL}/ws?token=${encodeURIComponent(token)}&roomId=${encodeURIComponent(roomId)}`;
        const ws = new WebSocket(url);
        roomWsMap.set(roomId, ws);

        ws.onopen = () => {
          setIsConnected(true);
          roomReconnectCountMap.set(roomId, 0);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            const awareness = roomAwarenessMap.get(roomId);
            if (!awareness) return;

            if (message.type === 'CURSOR_MOVE') {
              // Backend sends: { type, userId, userName, color, payload: {x, y}, timestamp }
              const { userId, userName, color, payload } = message;
              console.log('[usePresence] CURSOR_MOVE received:', { userId, userName, color, payload });
              if (userId && payload) {
                awareness.updateCursor(userId, {
                  userName: userName || 'Unknown',
                  userColor: color || '#999',
                  x: payload.x,
                  y: payload.y,
                });
              }
            } else if (message.type === 'CURSOR_SNAPSHOT') {
              // Backend sends: { type: 'CURSOR_SNAPSHOT', cursors: [{userId, name, color, x, y, lastUpdate}] }
              console.log('[usePresence] CURSOR_SNAPSHOT received:', message.cursors);
              message.cursors?.forEach((cursor: any) => {
                awareness.updateCursor(cursor.userId, {
                  userName: cursor.name || cursor.userName || 'Unknown',
                  userColor: cursor.color || cursor.userColor || '#999',
                  x: cursor.x,
                  y: cursor.y,
                });
              });
            } else if (message.type === 'USER_LEFT') {
              awareness.removeCursor(message.userId);
            }
          } catch (error) {
            console.error('[usePresence] Message parse error:', error);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          roomAwarenessMap.get(roomId)?.clear();
          // Only remove from map if this is still the current ws for the room
          if (roomWsMap.get(roomId) === ws) {
            roomWsMap.delete(roomId);
          }

          // Only reconnect if there are still consumers for this room
          const refCount = roomRefCountMap.get(roomId) ?? 0;
          if (refCount <= 0) return;

          const attempts = roomReconnectCountMap.get(roomId) ?? 0;
          if (attempts < maxReconnectAttempts) {
            roomReconnectCountMap.set(roomId, attempts + 1);
            const delay = Math.min(1000 * Math.pow(2, attempts + 1), 10000);
            reconnectTimeoutRef.current = setTimeout(() => connect(), delay);
          } else {
            console.warn(`[usePresence] Max reconnect attempts reached for room ${roomId}`);
          }
        };

        ws.onerror = () => {
          // Silently handle — onclose fires next
        };
      } catch (error) {
        console.warn('[usePresence] Connection error:', error);
      }
    });
  }, [roomId]);

  // Disconnect from WebSocket (explicit user action)
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    const ws = roomWsMap.get(roomId);
    if (ws) {
      ws.close();
      roomWsMap.delete(roomId);
    }
    roomReconnectCountMap.delete(roomId);
    setIsConnected(false);
    roomAwarenessMap.get(roomId)?.clear();
  }, [roomId]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
  }, [autoConnect, connect]);

  // Update cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    const ws = roomWsMap.get(roomId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'CURSOR_MOVE',
      payload: { x, y },
    }));
  }, [roomId]);

  return {
    cursors,
    isConnected,
    updateCursor,
    connect,
    disconnect,
  };
}
