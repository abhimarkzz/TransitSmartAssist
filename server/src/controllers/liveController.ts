import { Request, Response } from 'express';
import { changeStreamService } from '../services/changeStreamService';
import { simulationService } from '../services/simulationService';
import { getDb } from '../config/db';

/**
 * Server-Sent Events (SSE) Endpoint:
 * Streams MongoDB Change Stream events directly to the frontend
 */
export function streamLiveUpdates(req: Request, res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const clientId = `client-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  changeStreamService.registerClient(clientId, res);
}

/**
 * Toggle background transit simulation
 */
export function toggleSimulation(req: Request, res: Response): void {
  const isRunning = simulationService.toggle();
  res.json({
    success: true,
    simulationActive: isRunning,
    message: isRunning
      ? 'Transit telemetry simulation started. Updates are now streaming to MongoDB and SSE clients.'
      : 'Transit simulation paused.',
  });
}

/**
 * Get current simulation and change stream status
 */
export function getSimulationStatus(req: Request, res: Response): void {
  const isRunning = simulationService.isRunning();
  const streamStatus = changeStreamService.getStatus();

  res.json({
    success: true,
    simulationActive: isRunning,
    streamActive: streamStatus.active,
    streamMode: streamStatus.streamMode,
    connectedClients: streamStatus.clientsConnected,
  });
}

/**
 * Get active transit alerts (uses MongoDB partial index: { severity: 1, active: 1 } where active: true)
 */
export async function getActiveAlerts(req: Request, res: Response): Promise<void> {
  const db = getDb();
  const alerts = await db
    .collection('alerts')
    .find({ active: true })
    .sort({ severity: 1, createdAt: -1 })
    .toArray();

  res.json({
    success: true,
    count: alerts.length,
    alerts,
  });
}
