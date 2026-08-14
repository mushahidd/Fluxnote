// useTasks Hook
// React hook for fetching and managing tasks from the backend API

import { useState, useEffect, useCallback } from 'react';
import { tasksApi, type Task } from '../api';
import { toast } from '@/hooks/use-toast';

export interface UseTasksOptions {
  roomId: string;
  autoFetch?: boolean;
}

export interface UseTasksReturn {
  tasks: Task[];
  isLoading: boolean;
  error: Error | null;
  fetchTasks: () => Promise<void>;
  updateTaskStatus: (taskId: string, status: Task['status']) => Promise<void>;
  getTasksByStatus: (status: Task['status']) => Task[];
  getTaskByNodeId: (nodeId: string) => Task | null;
}

export function useTasks(options: UseTasksOptions): UseTasksReturn {
  const { roomId, autoFetch = true } = options;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await tasksApi.getTasks(roomId);
      setTasks(Array.isArray(fetched) ? fetched : []);
    } catch (err) {
      const e = err as Error;
      setError(e);
      console.error('[useTasks] Failed to fetch tasks:', e);
      // Don't toast on initial load failure — backend may not be running
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  const updateTaskStatus = useCallback(async (taskId: string, status: Task['status']) => {
    try {
      const updated = await tasksApi.updateTaskStatus(taskId, status);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      toast({ title: 'Task updated', description: `Status → ${status}` });
    } catch (err) {
      const e = err as Error;
      console.error('[useTasks] Failed to update task:', e);
      toast({ title: 'Failed to update task', description: e.message, variant: 'destructive' });
      throw e;
    }
  }, []);

  const getTasksByStatus = useCallback((status: Task['status']): Task[] => {
    return tasks.filter(t => t.status === status);
  }, [tasks]);

  const getTaskByNodeId = useCallback((nodeId: string): Task | null => {
    return tasks.find(t => t.nodeId === nodeId) ?? null;
  }, [tasks]);

  useEffect(() => {
    if (autoFetch) fetchTasks();
  }, [autoFetch, fetchTasks]);

  return { tasks, isLoading, error, fetchTasks, updateTaskStatus, getTasksByStatus, getTaskByNodeId };
}
