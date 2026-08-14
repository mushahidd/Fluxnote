/**
 * Event Type Definitions
 * 
 * This file defines TypeScript types for events emitted by the sync manager
 * and WebSocket message types for communication between client and server.
 * 
 * **Validates: Requirements 8.3**
 */

import { CanvasNode } from './canvas'

/**
 * Base event interface
 * All events extend this base interface
 */
export interface BaseEvent {
  type: string
  nodeId?: string
  timestamp: number
}

/**
 * Node created event
 * Emitted when a new canvas node is added to the Y.Map
 */
export interface NodeCreatedEvent extends BaseEvent {
  type: 'nodeCreated'
  nodeId: string
  node: CanvasNode
}

/**
 * Node updated event
 * Emitted when an existing canvas node is modified
 */
export interface NodeUpdatedEvent extends BaseEvent {
  type: 'nodeUpdated'
  nodeId: string
  node: CanvasNode
  changes: Partial<CanvasNode>
}

/**
 * Node deleted event
 * Emitted when a canvas node is removed from the Y.Map
 */
export interface NodeDeletedEvent extends BaseEvent {
  type: 'nodeDeleted'
  nodeId: string
}

/**
 * Node moved event
 * Emitted when a canvas node's position changes
 */
export interface NodeMovedEvent extends BaseEvent {
  type: 'nodeMoved'
  nodeId: string
  x: number
  y: number
}

/**
 * Union type for all node events
 * Used for type-safe event handling
 */
export type NodeEvent = 
  | NodeCreatedEvent 
  | NodeUpdatedEvent 
  | NodeDeletedEvent 
  | NodeMovedEvent

/**
 * WebSocket message types enumeration
 * Defines all message types used in WebSocket communication
 */
export enum WSMessageType {
  // CRDT sync messages
  CRDT_SYNC = 'CRDT_SYNC',
  CRDT_UPDATE = 'CRDT_UPDATE',
  
  // Presence messages
  CURSOR_MOVE = 'CURSOR_MOVE',
  USER_JOINED = 'USER_JOINED',
  USER_LEFT = 'USER_LEFT',
  
  // System messages
  ERROR = 'ERROR',
  SYNC = 'SYNC',
  RBAC_VIOLATION = 'RBAC_VIOLATION'
}

/**
 * WebSocket message interface
 * Generic message structure for WebSocket communication
 */
export interface WSMessage {
  type: WSMessageType
  payload?: any
  userId?: string
  nodeId?: string
  roomId?: string
  error?: string
}
