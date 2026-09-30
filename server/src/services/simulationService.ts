import { getDb } from '../config/db';
import { VehicleDoc, RouteDoc, CrowdLevel, VehicleStatus } from '../models/types';

class SimulationService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private updateIntervalMs = 3500;
  private stepCount = 0;

  public isRunning(): boolean {
    return this.running;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[Simulation] Real-time Transit Simulation started (interval: 3.5s)...');
    this.timer = setInterval(() => this.tick(), this.updateIntervalMs);
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[Simulation] Real-time Transit Simulation paused.');
  }

  public toggle(): boolean {
    if (this.running) {
      this.stop();
    } else {
      this.start();
    }
    return this.running;
  }

  private async tick(): Promise<void> {
    try {
      const db = getDb();
      this.stepCount++;

      // Pick a rotating subset of vehicles to update each tick (realistic continuous transit flow)
      const vehicles = (await db.collection<VehicleDoc>('vehicles').find({}).limit(20).toArray());
      const routes = (await db.collection<RouteDoc>('routes').find({}).toArray());
      const routeMap = new Map(routes.map((r) => [r.routeId, r]));

      for (const veh of vehicles) {
        const route = routeMap.get(veh.routeId);
        if (!route || !route.stops || route.stops.length < 2) continue;

        // Current stop sequence
        const currentStopIdx = route.stops.findIndex((s) => s.stopId === veh.currentStopId);
        const nextStopIdx = (currentStopIdx + 1) % route.stops.length;
        const currentStop = route.stops[currentStopIdx >= 0 ? currentStopIdx : 0];
        const nextStop = route.stops[nextStopIdx];

        // Advance progress fraction along current route segment
        const segmentProgress = ((this.stepCount * 0.15 + (parseInt(veh.vehicleId.slice(-2)) || 1) * 0.2) % 1);

        const newLng = Number(
          (currentStop.location.coordinates[0] + (nextStop.location.coordinates[0] - currentStop.location.coordinates[0]) * segmentProgress).toFixed(6)
        );
        const newLat = Number(
          (currentStop.location.coordinates[1] + (nextStop.location.coordinates[1] - currentStop.location.coordinates[1]) * segmentProgress).toFixed(6)
        );

        // Advance stop if past 90%
        const updatedStopId = segmentProgress > 0.85 ? nextStop.stopId : currentStop.stopId;
        const updatedNextStopId = segmentProgress > 0.85 ? route.stops[(nextStopIdx + 1) % route.stops.length].stopId : nextStop.stopId;

        // Realistic occupancy and delay fluctuation
        const jitter = Math.sin(this.stepCount * 0.3 + veh.speedKmH) * 8;
        const newOccupancy = Math.max(10, Math.min(98, Math.round(veh.occupancy + jitter * 0.5)));
        const newCrowdLevel: CrowdLevel = newOccupancy > 80 ? 'CRITICAL' : newOccupancy > 60 ? 'HIGH' : newOccupancy > 35 ? 'MODERATE' : 'LOW';
        const delayDrift = (this.stepCount % 5 === 0) ? (Math.random() > 0.6 ? 60 : -60) : 0;
        const newDelaySeconds = Math.max(0, Math.min(600, veh.delaySeconds + delayDrift));
        const newStatus: VehicleStatus = newDelaySeconds > 180 ? 'DELAYED' : 'ACTIVE';

        // 1. Update vehicle document in MongoDB
        await db.collection('vehicles').updateOne(
          { vehicleId: veh.vehicleId },
          {
            $set: {
              location: {
                type: 'Point',
                coordinates: [newLng, newLat],
              },
              currentStopId: updatedStopId,
              nextStopId: updatedNextStopId,
              occupancy: newOccupancy,
              crowdLevel: newCrowdLevel,
              delaySeconds: newDelaySeconds,
              status: newStatus,
              updatedAt: new Date(),
            },
          }
        );

        // 2. Insert Time-Series measurement into transitTelemetry collection
        await db.collection('transitTelemetry').insertOne({
          timestamp: new Date(),
          metadata: {
            vehicleId: veh.vehicleId,
            routeId: veh.routeId,
            stopId: updatedStopId,
          },
          delaySeconds: newDelaySeconds,
          occupancy: newOccupancy,
          crowdLevel: newCrowdLevel,
          speed: veh.speedKmH,
          status: newStatus,
          location: {
            type: 'Point',
            coordinates: [newLng, newLat],
          },
        });
      }
    } catch (err: any) {
      console.warn('[Simulation] Error in simulation tick:', err.message);
    }
  }
}

export const simulationService = new SimulationService();
