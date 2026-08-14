"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/api";

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: Task["status"]) => void;
  onClick?: () => void;
  className?: string;
}

const STATUS_LABELS = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const STATUS_COLORS = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-warning/10 text-warning",
  done: "bg-success/10 text-success",
};

export function TaskCard({ task, onStatusChange, onClick, className }: TaskCardProps) {
  const handleStatusChange = (newStatus: string) => {
    onStatusChange(task.id, newStatus as Task["status"]);
  };

  const timeAgo = getTimeAgo(new Date(task.createdAt));
  const authorName = task.author?.name || "Unknown";

  return (
    <Card
      className={cn(
        "p-3 cursor-pointer hover:shadow-md transition-all group",
        className
      )}
      onClick={onClick}
    >
      <div className="space-y-2">
        {/* Task text */}
        <p className="text-sm font-medium leading-snug line-clamp-3">
          {task.text}
        </p>

        {/* Metadata */}
        <div className="flex items-center justify-between gap-2 text-xs">
          {/* Author */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[100px]">
              {authorName}
            </span>
          </div>

          {/* Time */}
          <span className="text-muted-foreground">{timeAgo}</span>
        </div>

        {/* Status selector */}
        <div className="flex items-center gap-2">
          <Select
            value={task.status}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger
              className={cn(
                "h-7 text-xs font-medium border-0 focus:ring-0",
                STATUS_COLORS[task.status]
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  To Do
                </span>
              </SelectItem>
              <SelectItem value="in_progress">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-warning" />
                  In Progress
                </span>
              </SelectItem>
              <SelectItem value="done">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  Done
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Link to node indicator */}
          <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
}
