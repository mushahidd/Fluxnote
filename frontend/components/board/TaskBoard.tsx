"use client";

import { useTaskBoard } from "@/lib/hooks/useTaskBoard";
import { TaskCard } from "./TaskCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/api";

interface TaskBoardProps {
  roomId: string;
  onTaskClick?: (nodeId: string) => void;
  className?: string;
}

export function TaskBoard({ roomId, onTaskClick, className }: TaskBoardProps) {
  const { tasks, loading, error, fetchTasks, updateTaskStatus } = useTaskBoard(roomId);

  // Handle task status change
  const handleStatusChange = async (taskId: string, newStatus: Task["status"]) => {
    try {
      await updateTaskStatus(taskId, newStatus);
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  };

  // Handle task click - scroll to linked node
  const handleTaskClick = (nodeId: string) => {
    // Dispatch custom event to scroll canvas to node
    window.dispatchEvent(
      new CustomEvent("canvas:scrollToNode", {
        detail: { nodeId },
      })
    );
    
    // Also call the optional callback
    if (onTaskClick) {
      onTaskClick(nodeId);
    }
  };

  // Group tasks by status
  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  if (loading) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading tasks...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={fetchTasks}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-6", className)}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Task Board</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI-extracted action items • Live updates
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={fetchTasks}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Task columns */}
        <div className="grid grid-cols-3 gap-4">
          {/* To Do */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">To Do</h3>
              <Badge variant="secondary" className="ml-auto">
                {todoTasks.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {todoTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No tasks yet
                </div>
              ) : (
                todoTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onClick={() => handleTaskClick(task.nodeId)}
                  />
                ))
              )}
            </div>
          </div>

          {/* In Progress */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold">In Progress</h3>
              <Badge variant="secondary" className="ml-auto">
                {inProgressTasks.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {inProgressTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No tasks in progress
                </div>
              ) : (
                inProgressTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onClick={() => handleTaskClick(task.nodeId)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Done */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <h3 className="text-sm font-semibold">Done</h3>
              <Badge variant="secondary" className="ml-auto">
                {doneTasks.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {doneTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No completed tasks
                </div>
              ) : (
                doneTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onClick={() => handleTaskClick(task.nodeId)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No tasks yet</h3>
            <p className="text-sm text-muted-foreground">
              Create a sticky note with an action item and AI will automatically
              extract it as a task within 3 seconds.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
