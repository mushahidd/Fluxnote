// Yjs Awareness Protocol
// Tracks user presence and cursor positions (not using y-protocols awareness for custom implementation)

export interface UserCursor {
  userId: string;
  userName: string;
  userColor: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface AwarenessState {
  cursors: Map<string, UserCursor>;
}

export class Awareness {
  private state: AwarenessState = {
    cursors: new Map(),
  };
  private listeners: Set<() => void> = new Set();
  private localUserId: string | null = null;

  constructor() {}

  /**
   * Set local user ID
   */
  public setLocalUser(userId: string) {
    this.localUserId = userId;
  }

  /**
   * Update cursor position for a user
   */
  public updateCursor(userId: string, cursor: Omit<UserCursor, 'userId' | 'timestamp'>) {
    this.state.cursors.set(userId, {
      userId,
      ...cursor,
      timestamp: Date.now(),
    });
    this.notifyListeners();
  }

  /**
   * Remove cursor for a user
   */
  public removeCursor(userId: string) {
    this.state.cursors.delete(userId);
    this.notifyListeners();
  }

  /**
   * Get all cursors except local user
   */
  public getCursors(): UserCursor[] {
    const cursors: UserCursor[] = [];
    this.state.cursors.forEach((cursor, userId) => {
      if (userId !== this.localUserId) {
        cursors.push(cursor);
      }
    });
    return cursors;
  }

  /**
   * Get cursor for specific user
   */
  public getCursor(userId: string): UserCursor | null {
    return this.state.cursors.get(userId) || null;
  }

  /**
   * Clean up stale cursors (older than 30 seconds)
   */
  public cleanupStaleCursors() {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds

    this.state.cursors.forEach((cursor, userId) => {
      if (now - cursor.timestamp > staleThreshold) {
        this.state.cursors.delete(userId);
      }
    });

    this.notifyListeners();
  }

  /**
   * Subscribe to awareness changes
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Clear all awareness state
   */
  public clear() {
    this.state.cursors.clear();
    this.notifyListeners();
  }

  /**
   * Destroy awareness
   */
  public destroy() {
    this.clear();
    this.listeners.clear();
  }
}
