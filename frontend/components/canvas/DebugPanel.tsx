"use client";

/**
 * DebugPanel - Shows real-time sync status for troubleshooting
 * Add this to CanvasWrapper to debug drawing sync issues
 */

import { useState, useEffect } from "react";
import { Bug, Wifi, WifiOff, Users, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CanvasNode } from "@/types/canvas";
import type { UserCursor } from "@/lib/yjs/awareness";

interface DebugPanelProps {
  nodes: CanvasNode[];
  cursors: UserCursor[];
  isConnected: boolean;
  isSynced: boolean;
  roomId: string;
}

export function DebugPanel({
  nodes,
  cursors,
  isConnected,
  isSynced,
  roomId,
}: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [nodeHistory, setNodeHistory] = useState<Array<{ time: string; count: number }>>([]);

  // Track node count changes
  useEffect(() => {
    const time = new Date().toLocaleTimeString();
    setNodeHistory((prev) => [...prev.slice(-10), { time, count: nodes.length }]);
  }, [nodes.length]);

  const nodesByType = nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const freedrawNodes = nodes.filter((n) => n.type === "freedraw");
  const lastFreedraw = freedrawNodes[freedrawNodes.length - 1] as any;

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        className="fixed bottom-20 right-4 z-50 bg-card border-2 border-foreground/10 shadow-lg"
        onClick={() => setIsOpen(true)}
        title="Open debug panel"
      >
        <Bug className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-80 bg-card border-2 border-foreground/10 rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-foreground/10">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4" />
          <span className="font-mono text-xs font-bold">DEBUG PANEL</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsOpen(false)}
        >
          ×
        </Button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 max-h-96 overflow-y-auto text-xs">
        {/* Connection Status */}
        <div>
          <div className="font-mono font-bold mb-1 text-muted-foreground">
            CONNECTION
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="h-3 w-3 text-success" />
              ) : (
                <WifiOff className="h-3 w-3 text-destructive" />
              )}
              <span className={isConnected ? "text-success" : "text-destructive"}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isSynced ? "bg-success" : "bg-warning"
                )}
              />
              <span>{isSynced ? "Synced" : "Syncing..."}</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              Room: {roomId}
            </div>
          </div>
        </div>

        {/* Users */}
        <div>
          <div className="font-mono font-bold mb-1 text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            USERS ({cursors.length + 1})
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">You (local)</div>
            {cursors.map((cursor) => (
              <div key={cursor.userId} className="text-[10px]">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: cursor.userColor }}
                />
                {cursor.userName || cursor.userId.slice(0, 8)}
              </div>
            ))}
          </div>
        </div>

        {/* Nodes */}
        <div>
          <div className="font-mono font-bold mb-1 text-muted-foreground flex items-center gap-1">
            <Layers className="h-3 w-3" />
            NODES ({nodes.length})
          </div>
          <div className="space-y-1">
            {Object.entries(nodesByType).map(([type, count]) => (
              <div key={type} className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{type}</span>
                <span className="font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Freedraw Debug */}
        {freedrawNodes.length > 0 && (
          <div>
            <div className="font-mono font-bold mb-1 text-muted-foreground">
              LAST FREEDRAW
            </div>
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono">{lastFreedraw?.id?.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Points</span>
                <span className="font-mono">{lastFreedraw?.points?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Color</span>
                <span
                  className="inline-block w-3 h-3 rounded border border-foreground/20"
                  style={{ backgroundColor: lastFreedraw?.strokeColor }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created by</span>
                <span className="font-mono">{lastFreedraw?.createdBy?.slice(0, 8)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Node History */}
        <div>
          <div className="font-mono font-bold mb-1 text-muted-foreground">
            NODE HISTORY
          </div>
          <div className="space-y-0.5">
            {nodeHistory.slice(-5).map((entry, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="text-muted-foreground font-mono">{entry.time}</span>
                <span className="font-mono">{entry.count} nodes</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-foreground/10 space-y-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              console.log("=== CANVAS DEBUG INFO ===");
              console.log("Nodes:", nodes);
              console.log("Cursors:", cursors);
              console.log("Connected:", isConnected);
              console.log("Synced:", isSynced);
              console.log("Room ID:", roomId);
              console.log("Freedraw nodes:", freedrawNodes);
              console.log("========================");
            }}
          >
            Log to Console
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              const data = {
                timestamp: new Date().toISOString(),
                roomId,
                isConnected,
                isSynced,
                nodeCount: nodes.length,
                nodesByType,
                cursorCount: cursors.length,
                freedrawCount: freedrawNodes.length,
                lastFreedrawPoints: lastFreedraw?.points?.length || 0,
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `canvas-debug-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export Debug Data
          </Button>
        </div>
      </div>
    </div>
  );
}
