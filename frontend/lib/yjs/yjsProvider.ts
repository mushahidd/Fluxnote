// Yjs WebSocket Provider
// Connects to backend /yjs endpoint for real-time CRDT synchronization

import * as Y from 'yjs';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

export interface YjsProviderOptions {
  roomId: string;
  token: string;
  onSync?: (synced: boolean) => void;
  onStatus?: (status: 'connecting' | 'connected' | 'disconnected') => void;
  onError?: (error: Error) => void;
}

export class YjsProvider {
  private ws: WebSocket | null = null;
  private doc: Y.Doc;
  private roomId: string;
  private token: string;
  private synced: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private onSync?: (synced: boolean) => void;
  private onStatus?: (status: 'connecting' | 'connected' | 'disconnected') => void;
  private onError?: (error: Error) => void;
  /** Set to true when disconnect() is called intentionally — suppresses reconnect and error logs */
  private destroyed: boolean = false;
  /** Track whether the update listener is currently registered */
  private updateListenerAttached: boolean = false;

  constructor(doc: Y.Doc, options: YjsProviderOptions) {
    this.doc = doc;
    this.roomId = options.roomId;
    this.token = options.token;
    this.onSync = options.onSync;
    this.onStatus = options.onStatus;
    this.onError = options.onError;

    this.connect();
  }

  private connect() {
    if (this.destroyed) return;
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.onStatus?.('connecting');
    console.log(`[YjsProvider] Connecting to room ${this.roomId}...`);

    try {
      const url = `${WS_URL}/yjs?token=${encodeURIComponent(this.token)}&roomId=${encodeURIComponent(this.roomId)}`;
      console.log(`[YjsProvider] WebSocket URL: ${url.replace(this.token, 'TOKEN_HIDDEN')}`);
      
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        if (this.destroyed) { this.ws?.close(1000, 'destroyed'); return; }
        console.log(`✅ [YjsProvider] Connected to room ${this.roomId}`);
        this.reconnectAttempts = 0;
        this.onStatus?.('connected');
        
        // Send initial sync request
        this.sendSyncStep1();
      };

      this.ws.onmessage = (event) => {
        if (!this.destroyed) this.handleMessage(new Uint8Array(event.data));
      };

      this.ws.onclose = (event) => {
        // Intentional disconnect or browser navigation away — log quietly and stop
        if (this.destroyed || event.code === 1000 || event.code === 1001) {
          console.log(`[YjsProvider] Disconnected from room ${this.roomId} (code ${event.code}, clean)`);
          this.onStatus?.('disconnected');
          this.synced = false;
          return;
        }

        // Unexpected disconnect
        console.warn(`⚠️ [YjsProvider] Disconnected from room ${this.roomId}`, {
          code: event.code,
          reason: event.reason || 'No reason provided',
          wasClean: event.wasClean,
        });

        if (event.code === 1008) {
          console.error('[YjsProvider] Authentication failed — invalid or expired token');
        } else if (event.code === 1006) {
          console.warn('[YjsProvider] Connection closed abnormally — check backend is running');
        }
        
        this.onStatus?.('disconnected');
        this.synced = false;
        this.onSync?.(false);

        // Attempt reconnection with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
          console.log(`[YjsProvider] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          this.reconnectTimeout = setTimeout(() => this.connect(), delay);
        } else {
          console.error('[YjsProvider] Max reconnection attempts reached');
          this.onError?.(new Error('Max reconnection attempts reached'));
        }
      };

      this.ws.onerror = () => {
        // Browser WebSocket error events carry no useful detail — only log if unexpected
        if (!this.destroyed) {
          console.warn('[YjsProvider] WebSocket connection error (will retry on close)');
        }
      };

      // Register update listener only once
      if (!this.updateListenerAttached) {
        this.doc.on('update', this.handleLocalUpdate);
        this.updateListenerAttached = true;
      }

    } catch (error) {
      console.error('❌ [YjsProvider] Connection error:', error);
      this.onError?.(error as Error);
    }
  }

  private handleMessage = (message: Uint8Array) => {
    if (message.length < 2) return;

    const messageType = message[0];

    // messageType 0 = sync protocol
    if (messageType === 0) {
      const syncMessageType = message[1];
      const payload = message.subarray(2);

      if (syncMessageType === 0) {
        // SyncStep1: Server sends state vector, we respond with our state
        console.log(`[YjsProvider] Received SyncStep1, payload size: ${payload.length} bytes`);
        const stateVector = payload;
        const update = Y.encodeStateAsUpdate(this.doc, stateVector);
        console.log(`[YjsProvider] Sending SyncStep2 response, update size: ${update.length} bytes, doc has ${this.doc.getMap('nodes').size} nodes`);
        this.sendSyncStep2(update);

      } else if (syncMessageType === 1) {
        // SyncStep2: Server sends missing updates
        console.log(`[YjsProvider] Received SyncStep2, payload size: ${payload.length} bytes`);
        Y.applyUpdate(this.doc, payload, this);
        
        if (!this.synced) {
          this.synced = true;
          this.onSync?.(true);
          console.log(`[YjsProvider] Initial sync complete for room ${this.roomId}`);
        }

      } else if (syncMessageType === 2) {
        // Update: Server sends incremental update
        console.log(`[YjsProvider] Received incremental update, payload size: ${payload.length} bytes`);
        Y.applyUpdate(this.doc, payload, this);
        console.log(`[YjsProvider] Applied incremental update to local document`);
      }
    }
  };

  private handleLocalUpdate = (update: Uint8Array, origin: any) => {
    // Don't send updates that came from the server
    if (origin === this) {
      console.log(`[YjsProvider] Skipping local update (came from server)`);
      return;
    }

    console.log(`[YjsProvider] Sending local update to server, size: ${update.length} bytes`);
    // Send update to server
    this.sendUpdate(update);
  };

  private sendSyncStep1() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const stateVector = Y.encodeStateVector(this.doc);
    const message = new Uint8Array(2 + stateVector.length);
    message[0] = 0; // messageType: sync
    message[1] = 0; // syncMessageType: SyncStep1
    message.set(stateVector, 2);
    this.ws.send(message);
  }

  private sendSyncStep2(update: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = new Uint8Array(2 + update.length);
    message[0] = 0; // messageType: sync
    message[1] = 1; // syncMessageType: SyncStep2
    message.set(update, 2);
    this.ws.send(message);
  }

  private sendUpdate(update: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error(`[YjsProvider] Cannot send update - WebSocket not open, state: ${this.ws?.readyState}`);
      return;
    }

    try {
      const message = new Uint8Array(2 + update.length);
      message[0] = 0; // messageType: sync
      message[1] = 2; // syncMessageType: Update
      message.set(update, 2);
      this.ws.send(message);
      console.log(`[YjsProvider] Successfully sent update message, total size: ${message.length} bytes`);
    } catch (error) {
      console.error(`[YjsProvider] Error sending update:`, error);
    }
  }

  public disconnect() {
    this.destroyed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.updateListenerAttached) {
      this.doc.off('update', this.handleLocalUpdate);
      this.updateListenerAttached = false;
    }

    if (this.ws) {
      this.ws.close(1000, 'disconnect');
      this.ws = null;
    }

    this.synced = false;
    this.onSync?.(false);
  }

  public isSynced(): boolean {
    return this.synced;
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
