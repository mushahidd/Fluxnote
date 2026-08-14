-- Migration: Add CanvasNode table for persisting canvas state
-- This table stores the current state of all canvas nodes
-- It's updated in real-time as users draw and edit

CREATE TABLE IF NOT EXISTS "CanvasNode" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL DEFAULT '{}',
    "color" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "intent" TEXT,
    "taskStatus" TEXT,
    "assignee" TEXT,
    "points" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasNode_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on id + roomId
CREATE UNIQUE INDEX IF NOT EXISTS "CanvasNode_id_roomId_key" ON "CanvasNode"("id", "roomId");

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "CanvasNode_roomId_idx" ON "CanvasNode"("roomId");
CREATE INDEX IF NOT EXISTS "CanvasNode_createdBy_idx" ON "CanvasNode"("createdBy");

-- Add comment
COMMENT ON TABLE "CanvasNode" IS 'Stores the current state of all canvas nodes for persistence and recovery';
