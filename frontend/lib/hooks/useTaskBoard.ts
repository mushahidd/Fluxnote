import { useState, useEffect, useCallback, useRef } from 'react';
import { tasksApi, Task } from '../api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
const WS_PATH = '/ws';
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;

export function useTaskBoard(roomId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  // Fetch initial tasks
  const fetchTasks = useCallback(async () => {
    if (!roomId) return;
    
    try {
      setLoading(true);
      setError(null);
      const fetchedTasks = await tasksApi.getTasks(roomId);
      setTasks(fetchedTasks);
    } catch (err: any) {
      console.error('[useTaskBoard] Failed to fetch tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!roomId || typeof roomId !== 'string') {
      console.warn('[useTaskBoard] Invalid roomId:', roomId);
      return;
    }

    isMounted.current = true;
    reconnectAttempts.current = 0;

    function connect() {
      if (!isMounted.current) return;

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

      // Normalize base URL so it always includes /ws
      const wsBase = WS_URL.endsWith(WS_PATH) ? WS_URL : `${WS_URL}${WS_PATH}`;
      // Backend allows connections without token (guest mode)
      const wsUrl = token
        ? `${wsBase}?roomId=${roomId}&token=${token}`
        : `${wsBase}?roomId=${roomId}`;

      console.log('[useTaskBoard] Connecting to WebSocket with roomId:', roomId);
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('[useTaskBoard] WebSocket connected');
        reconnectAttempts.current = 0;
        if (isMounted.current) setWs(websocket);
      };

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'task:created':
              setTasks((prev) => {
                if (prev.find((t) => t.id === message.task.id)) return prev;
                return [message.task, ...prev];
              });
              break;

            case 'task:updated':
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === message.task.id ? { ...t, ...message.task } : t
                )
              );
              break;

            case 'task:deleted':
              setTasks((prev) => prev.filter((t) => t.id !== message.taskId));
              break;
          }
        } catch (err) {
          console.error('[useTaskBoard] Failed to parse WebSocket message:', err);
        }
      };

      websocket.onerror = () => {
        // Browser WebSocket error events carry no useful detail — log minimally
        console.warn('[useTaskBoard] WebSocket connection failed, will retry if possible');
      };

      websocket.onclose = (event) => {
        console.log('[useTaskBoard] WebSocket disconnected', event.code);
        if (isMounted.current) setWs(null);

        // Reconnect unless closed cleanly (1000) or component unmounted
        if (
          isMounted.current &&
          event.code !== 1000 &&
          reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS
        ) {
          reconnectAttempts.current += 1;
          const delay = RECONNECT_DELAY_MS * reconnectAttempts.current;
          console.log(`[useTaskBoard] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);
          reconnectTimer.current = setTimeout(connect, delay);
        } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          console.warn('[useTaskBoard] Max reconnect attempts reached');
        }
      };
    }

    connect();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      setWs((prev) => {
        prev?.close(1000, 'component unmounted');
        return null;
      });
    };
  }, [roomId]);

  // Update task status
  const updateTaskStatus = useCallback(async (taskId: string, status: Task['status']) => {
    try {
      await tasksApi.updateTaskStatus(taskId, status);
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status } : t))
      );
    } catch (err) {
      console.error('[useTaskBoard] Failed to update task status:', err);
      throw err;
    }
  }, []);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    updateTaskStatus,
    setTasks,
    ws, // Expose WebSocket for role sync
  };
}
