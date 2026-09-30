import { Response } from 'express';
import { ChangeStream } from 'mongodb';
import { getDb } from '../config/db';

export interface SSEClient {
  id: string;
  res: Response;
  connectedAt: Date;
}

class ChangeStreamService {
  private clients: Map<string, SSEClient> = new Map();
  private telemetryStream: ChangeStream | null = null;
  private alertsStream: ChangeStream | null = null;
  private streamActive = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  public getStatus(): { active: boolean; clientsConnected: number; streamMode: string } {
    return {
      active: this.streamActive,
      clientsConnected: this.clients.size,
      streamMode: this.streamActive ? 'MONGODB_CHANGE_STREAM' : 'POLLING_HEARTBEAT',
    };
  }

  public registerClient(id: string, res: Response): void {
    this.clients.set(id, { id, res, connectedAt: new Date() });
    console.log(`[ChangeStream] SSE client connected: ${id} (total: ${this.clients.size})`);

    // Send initial handshake
    this.sendToClient(res, 'handshake', {
      status: 'CONNECTED',
      streamActive: this.streamActive,
      timestamp: new Date(),
      message: 'Connected to MongoDB Live Transit Stream',
    });

    res.on('close', () => {
      this.clients.delete(id);
      console.log(`[ChangeStream] SSE client disconnected: ${id} (remaining: ${this.clients.size})`);
    });
  }

  public async start(): Promise<void> {
    const db = getDb();

    // Start periodic SSE heartbeat every 15 seconds to prevent browser timeouts
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        this.broadcast('heartbeat', {
          timestamp: new Date(),
          activeClients: this.clients.size,
          streamStatus: this.streamActive ? 'LIVE' : 'STANDBY',
        });
      }, 15000);
    }

    try {
      console.log('[ChangeStream] Initializing MongoDB Change Stream on transitTelemetry collection...');
      const telemetryCollection = db.collection('transitTelemetry');

      // Native MongoDB collection.watch()
      this.telemetryStream = telemetryCollection.watch(
        [{ $match: { operationType: 'insert' } }],
        { fullDocument: 'updateLookup' }
      );

      this.telemetryStream.on('change', (change) => {
        if (change.operationType === 'insert' && change.fullDocument) {
          this.broadcast('telemetry', {
            type: 'TELEMETRY_UPDATE',
            data: change.fullDocument,
            source: 'MONGODB_CHANGE_STREAM',
          });
        }
      });

      this.telemetryStream.on('error', (err) => {
        console.warn('[ChangeStream] Telemetry Change Stream error:', err.message);
        this.streamActive = false;
      });

      // Watch alerts collection for live disruption announcements
      const alertsCollection = db.collection('alerts');
      this.alertsStream = alertsCollection.watch();
      this.alertsStream.on('change', (change) => {
        this.broadcast('alert', {
          type: 'ALERT_CHANGE',
          data: change,
          source: 'MONGODB_CHANGE_STREAM',
        });
      });

      this.streamActive = true;
      console.log('[ChangeStream] MongoDB Change Stream successfully listening for live database events!');
    } catch (err: any) {
      console.warn('[ChangeStream] Could not open Change Stream (replica set may need configuration):', err.message);
      this.streamActive = false;
    }
  }

  public async stop(): Promise<void> {
    if (this.telemetryStream) {
      await this.telemetryStream.close();
      this.telemetryStream = null;
    }
    if (this.alertsStream) {
      await this.alertsStream.close();
      this.alertsStream = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.streamActive = false;
    console.log('[ChangeStream] MongoDB Change Streams closed.');
  }

  public broadcast(event: string, data: any): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(payload);
      } catch (err) {
        console.warn(`[ChangeStream] Error sending SSE to ${id}:`, err);
        this.clients.delete(id);
      }
    }
  }

  private sendToClient(res: Response, event: string, data: any): void {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      // client may already have closed
    }
  }
}

export const changeStreamService = new ChangeStreamService();
