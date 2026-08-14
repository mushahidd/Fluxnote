"use client";

/**
 * CursorLayer - DOM overlay for remote user cursors
 * Positioned absolutely over the canvas, pointer-events: none
 */

import { useEffect, useRef } from "react";
import type { UserCursor } from "@/lib/yjs/awareness";
import type { Viewport } from "@/lib/canvas/Viewport";

interface CursorLayerProps {
  cursors: UserCursor[];
  viewport: Viewport | null;
  viewportTick?: number;
}

export function CursorLayer({ cursors, viewport, viewportTick: _tick }: CursorLayerProps) {
  if (!viewport) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10 }}>
      {cursors.map((cursor) => {
        // Convert scene coordinates to screen coordinates
        const screen = viewport.sceneToScreen(cursor.x, cursor.y);

        return (
          <div
            key={cursor.userId}
            className="absolute transition-transform duration-75"
            style={{
              left: screen.x,
              top: screen.y,
              transform: "translate(0, 0)",
              willChange: "transform",
            }}
          >
            {/* Cursor SVG */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={cursor.userColor}
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
            >
              <path d="M3 2 L3 22 L9 16 L13 22 L16 19 L12 14 L20 13 Z" />
            </svg>

            {/* Name label */}
            <span
              className="absolute left-4 top-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: cursor.userColor }}
            >
              {cursor.userName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
