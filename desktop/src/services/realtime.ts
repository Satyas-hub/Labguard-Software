// ============================================================================
// LABGUARD V2: Desktop Real-time WebSocket Client (Phase 21: Live Monitoring)
// Manages real-time WebSocket connection to central gateway, handles auto-reconnect,
// heartbeat telemetry, laboratory room subscriptions, and typed event dispatching.
// ============================================================================

import { useEffect, useState } from 'react';
import { getServerUrl, ApiClient } from './api';

export type RealtimeEventType =
  | 'CONNECTED'
  | 'PONG'
  | 'SUBSCRIPTION_CONFIRMED'
  | 'WORKSTATION_STATE_CHANGED'
  | 'SESSION_STARTED'
  | 'SESSION_ENDED'
  | 'HARDWARE_ALERT'
  | 'ISSUE_REPORTED'
  | 'ISSUE_UPDATED'
  | 'MAINTENANCE_UPDATED';

export interface RealtimeMessage<T = any> {
  type: RealtimeEventType;
  data?: T;
  labCode?: string;
  timestamp: string;
  message?: string;
}

export type RealtimeEventHandler<T = any> = (payload: T, fullMessage: RealtimeMessage<T>) => void;

class RealtimeClientService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private currentLabCode: string = 'ALL';
  private listeners: Map<string, Set<RealtimeEventHandler>> = new Map();
  private isConnected: boolean = false;
  private connectionStateListeners: Set<(connected: boolean) => void> = new Set();
  private retryCount: number = 0;

  constructor() {
    // Automatically connect on module load if in browser context
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  private getWsUrl(): string {
    if (typeof window !== 'undefined') {
      try {
        const sUrl = getServerUrl();
        const parsed = new URL(sUrl);
        const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${parsed.host}/ws`;
      } catch {}
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    return `${protocol}//${host}:5000/ws`;
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = this.getWsUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.retryCount = 0;
        this.notifyConnectionChange(true);
        this.startHeartbeat();
        this.resubscribe();
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed: RealtimeMessage = JSON.parse(event.data);
          this.handleMessage(parsed);
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.cleanup();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.cleanup();
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private cleanup() {
    this.isConnected = false;
    this.notifyConnectionChange(false);
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.retryCount++;
    const delay = Math.min(1000 * Math.pow(1.5, this.retryCount), 15000);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      }
    }, 20000);
  }

  private resubscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const token = ApiClient.getToken();
    this.ws.send(JSON.stringify({
      type: 'SUBSCRIBE',
      labCode: this.currentLabCode,
      token
    }));
  }

  public subscribeToLab(labCode: string) {
    this.currentLabCode = labCode || 'ALL';
    this.resubscribe();
  }

  public on(eventType: RealtimeEventType | '*', handler: RealtimeEventHandler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
    return () => this.off(eventType, handler);
  }

  public off(eventType: RealtimeEventType | '*', handler: RealtimeEventHandler) {
    const set = this.listeners.get(eventType);
    if (set) {
      set.delete(handler);
    }
  }

  private handleMessage(msg: RealtimeMessage) {
    // Dispatch to specific event listeners
    const specificHandlers = this.listeners.get(msg.type);
    if (specificHandlers) {
      specificHandlers.forEach((h) => {
        try {
          h(msg.data, msg);
        } catch (err) {
          console.warn('[RealtimeClient] Handler error:', err);
        }
      });
    }

    // Dispatch to wildcard listeners
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((h) => {
        try {
          h(msg.data, msg);
        } catch (err) {
          console.warn('[RealtimeClient] Wildcard handler error:', err);
        }
      });
    }
  }

  public onConnectionChange(listener: (connected: boolean) => void) {
    this.connectionStateListeners.add(listener);
    listener(this.isConnected);
    return () => this.connectionStateListeners.delete(listener);
  }

  private notifyConnectionChange(status: boolean) {
    this.connectionStateListeners.forEach((l) => {
      try {
        l(status);
      } catch {}
    });
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const realtimeClient = new RealtimeClientService();

/**
 * React Hook for Live Lab Monitoring in Faculty & Assistant Dashboards
 */
export function useLiveLabMonitoring(labCode: string = 'ALL') {
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(realtimeClient.getIsConnected());
  const [lastEvent, setLastEvent] = useState<RealtimeMessage | null>(null);

  useEffect(() => {
    realtimeClient.subscribeToLab(labCode);
    const unbindConn = realtimeClient.onConnectionChange(setIsLiveConnected);
    const unbindAll = realtimeClient.on('*', (_data, msg) => {
      setLastEvent(msg);
    });

    return () => {
      unbindConn();
      unbindAll();
    };
  }, [labCode]);

  return { isLiveConnected, lastEvent };
}
