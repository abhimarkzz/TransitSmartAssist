import { Request, Response } from 'express';
import { getDb } from '../config/db';

export async function getAllStops(req: Request, res: Response): Promise<void> {
  const { zone, accessible } = req.query;
  const db = getDb();

  const filter: any = {};
  if (zone) filter.zone = zone;
  if (accessible === 'true') filter.accessible = true;

  const stops = await db
    .collection('stops')
    .find(filter, {
      projection: {
        _id: 1,
        stopId: 1,
        name: 1,
        code: 1,
        location: 1,
        zone: 1,
        amenities: 1,
        accessible: 1,
        connectingRoutes: 1,
        currentCrowdLevel: 1,
        currentDelaySeconds: 1,
        passengerFlowPerHour: 1,
      },
    })
    .sort({ name: 1 })
    .toArray();

  res.json({
    success: true,
    count: stops.length,
    stops,
  });
}

/**
 * MongoDB Geospatial $geoNear query:
 * Finds transit stops nearest to a given latitude and longitude coordinates.
 */
export async function getNearbyStops(req: Request, res: Response): Promise<void> {
  const lng = parseFloat(req.query.lng as string);
  const lat = parseFloat(req.query.lat as string);
  const maxDistance = parseInt((req.query.maxDistance as string) || '1500', 10);
  const limit = parseInt((req.query.limit as string) || '8', 10);

  if (isNaN(lng) || isNaN(lat)) {
    res.status(400).json({
      success: false,
      error: 'Valid numeric "lng" and "lat" query parameters are required.',
    });
    return;
  }

  const startTime = Date.now();
  const db = getDb();

  // Genuine MongoDB $geoNear Aggregation Stage
  const pipeline = [
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        distanceField: 'distanceMeters',
        maxDistance: maxDistance,
        spherical: true,
        key: 'location',
      },
    },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        stopId: 1,
        name: 1,
        code: 1,
        location: 1,
        zone: 1,
        amenities: 1,
        accessible: 1,
        connectingRoutes: 1,
        currentCrowdLevel: 1,
        distanceMeters: { $round: ['$distanceMeters', 1] },
      },
    },
  ];

  const nearbyStops = await db.collection('stops').aggregate(pipeline).toArray();
  const executionTimeMs = Date.now() - startTime;

  res.json({
    success: true,
    queryLocation: { coordinates: [lng, lat], maxDistanceMeters: maxDistance },
    mongoStageUsed: '$geoNear with 2dsphere index',
    executionTimeMs,
    count: nearbyStops.length,
    stops: nearbyStops,
  });
}

export async function getStopById(req: Request, res: Response): Promise<void> {
  const { stopId } = req.params;
  const db = getDb();

  const stop = await db.collection('stops').findOne({ stopId });
  if (!stop) {
    res.status(404).json({ success: false, error: 'Stop not found.' });
    return;
  }

  // Find recent time-series telemetry arrivals for this stop
  const recentTelemetry = await db
    .collection('transitTelemetry')
    .find({ 'metadata.stopId': stopId })
    .sort({ timestamp: -1 })
    .limit(5)
    .toArray();

  res.json({
    success: true,
    stop,
    recentTelemetry,
  });
}
