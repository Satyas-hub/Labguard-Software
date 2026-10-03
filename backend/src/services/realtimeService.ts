// ============================================================================
// LABGUARD V2: Real-time WebSocket Gateway & Live Lab Monitoring Service
// Manages WebSocket subscriptions, room scoping, and state broadcasts
// for live workstation fleets across faculty and assistant dashboards.
// ============================================================================

import { WebSocket, WebSocketServer } from 'ws';
import { Computer, Session, HardwareEvent, Issue, MaintenanceRecord } from '../../../shared/types';

interface ClientSubscription {
  ws: WebSocket;
  labCode?: string; // 'ALL' or specific labCode like 'LAB-01'
  userId?: string;
  role?: string;
}

class RealtimeGatewayService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientSubscription> = new Map();

  /**
   * Binds the central WebSocket server instance to the gateway
   */
  public init(wss: WebSocketServer) {
    this.wss = wss;

    wss.on('connection', (ws: WebSocket) => {
      const subscription: ClientSubscription = { ws, labCode: 'ALL' };
      this.clients.set(ws, subscription);

      // Welcome handshake
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'LABGUARD Realtime Gateway Active',
        timestamp: new Date().toISOString()
      }));

      ws.on('message', (raw: string) => {
        try {
          const msg = JSON.parse(raw.toString());
          switch (msg.type) {
            case 'PING':
              ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
              break;

            case 'SUBSCRIBE':
              // Subscribe to specific laboratory or 'ALL'
              if (msg.labCode) {
                subscription.labCode = msg.labCode.toUpperCase();
              }
              if (msg.userId) subscription.userId = msg.userId;
              if (msg.role) subscription.role = msg.role;

              ws.send(JSON.stringify({
                type: 'SUBSCRIPTION_CONFIRMED',
                labCode: subscription.labCode,
                timestamp: new Date().toISOString()
              }));
              break;

            case 'UNSUBSCRIBE':
              subscription.labCode = 'ALL';
              break;

            default:
              break;
          }
        } catch {
          // Ignore invalid frames
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    console.log('[RealtimeGateway] Initialized WebSocket gateway for Live Lab Monitoring.');
  }

  /**
   * Broadcasts a typed real-time payload to relevant subscribers
   */
  public broadcast(eventType: string, payload: any, targetLabCode?: string) {
    const rawMessage = JSON.stringify({
      type: eventType,
      data: payload,
      timestamp: new Date().toISOString()
    });

    const cleanTargetLab = targetLabCode ? targetLabCode.toUpperCase() : undefined;

    this.clients.forEach((sub, clientWs) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        // If message is target-scoped, deliver if subscriber is 'ALL' or matches target lab
        if (!cleanTargetLab || sub.labCode === 'ALL' || sub.labCode === cleanTargetLab) {
          try {
            clientWs.send(rawMessage);
          } catch (err) {
            console.warn('[RealtimeGateway] Failed to transmit frame to client:', err);
          }
        }
      }
    });
  }

  /**
   * Broadcast workstation state change (AVAILABLE, IN_USE, MAINTENANCE, DISABLED, OFFLINE)
   */
  public broadcastWorkstationState(computer: Partial<Computer> & { pcCode: string; labCode?: string }) {
    const labCode = computer.labCode || 'LAB-01';
    this.broadcast('WORKSTATION_STATE_CHANGED', {
      id: computer.id,
      labCode,
      pcCode: computer.pcCode,
      state: computer.state,
      isOnline: computer.isOnline,
      activeStudentName: computer.activeStudentName,
      activeSessionId: computer.activeSessionId,
      peripherals: computer.peripherals,
      timestamp: new Date().toISOString()
    }, labCode);
  }

  /**
   * Broadcast student session start
   */
  public broadcastSessionStart(session: Session) {
    this.broadcast('SESSION_STARTED', session, session.labCode);
    this.broadcastWorkstationState({
      pcCode: session.pcCode,
      labCode: session.labCode,
      state: 'IN_USE',
      activeStudentName: session.studentName,
      activeSessionId: session.id,
      isOnline: true
    });
  }

  /**
   * Broadcast student session end
   */
  public broadcastSessionEnd(session: Session) {
    this.broadcast('SESSION_ENDED', session, session.labCode);
    this.broadcastWorkstationState({
      pcCode: session.pcCode,
      labCode: session.labCode,
      state: 'AVAILABLE',
      activeStudentName: undefined,
      activeSessionId: undefined,
      isOnline: true
    });
  }

  /**
   * Broadcast peripheral hardware event (disconnect, reconnect, mismatch)
   */
  public broadcastHardwareAlert(event: HardwareEvent) {
    this.broadcast('HARDWARE_ALERT', event, event.labCode);
  }

  /**
   * Broadcast issue lifecycle event
   */
  public broadcastIssueUpdate(issue: Issue, action: 'CREATED' | 'UPDATED' = 'CREATED') {
    this.broadcast(action === 'CREATED' ? 'ISSUE_REPORTED' : 'ISSUE_UPDATED', issue, issue.labCode);
  }

  /**
   * Broadcast maintenance work order event
   */
  public broadcastMaintenanceUpdate(record: MaintenanceRecord) {
    this.broadcast('MAINTENANCE_UPDATED', record, record.labCode);
  }

  /**
   * Returns count of currently active WebSocket client connections
   */
  public getConnectedClientsCount(): number {
    let count = 0;
    this.clients.forEach((_, ws) => {
      if (ws.readyState === WebSocket.OPEN) count++;
    });
    return count;
  }
}

export const RealtimeService = new RealtimeGatewayService();
