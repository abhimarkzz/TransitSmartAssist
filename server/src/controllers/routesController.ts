import { Request, Response } from 'express';
import { getDb } from '../config/db';

export async function getAllRoutes(req: Request, res: Response): Promise<void> {
  const { type, status } = req.query;
  const db = getDb();

  const filter: any = {};
  if (type) filter.type = type;
  if (status) filter.currentStatus = status;

  // Use MongoDB projection to return route details without bulky embeddings for fast network payload
  const routes = await db
    .collection('routes')
    .find(filter, {
      projection: {
        _id: 1,
        routeId: 1,
        name: 1,
        shortName: 1,
        type: 1,
        description: 1,
        color: 1,
        totalDistanceMeters: 1,
        baseTravelMinutes: 1,
        scheduleIntervalMinutes: 1,
        currentStatus: 1,
        currentDelaySeconds: 1,
        averageCrowdLevel: 1,
        reliabilityScore: 1,
        accessible: 1,
        tags: 1,
        stopCount: { $size: '$stops' },
        geometry: 1,
      },
    })
    .sort({ type: 1, routeId: 1 })
    .toArray();

  res.json({
    success: true,
    count: routes.length,
    routes,
  });
}

export async function getRouteById(req: Request, res: Response): Promise<void> {
  const { routeId } = req.params;
  const db = getDb();

  // MongoDB Aggregation Pipeline joining active vehicles and active alerts via $lookup
  const pipeline = [
    { $match: { routeId } },
    {
      $lookup: {
        from: 'vehicles',
        localField: 'routeId',
        foreignField: 'routeId',
        as: 'liveVehicles',
      },
    },
    {
      $lookup: {
        from: 'alerts',
        let: { rId: '$routeId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$active', true] },
                  { $in: ['$$rId', '$affectedRoutes'] },
                ],
              },
            },
          },
        ],
        as: 'activeAlerts',
      },
    },
    {
      $project: {
        embedding: 0, // Exclude heavy vector embedding from standard route view
      },
    },
  ];

  const results = await db.collection('routes').aggregate(pipeline).toArray();
  if (results.length === 0) {
    res.status(404).json({ success: false, error: 'Route not found.' });
    return;
  }

  res.json({
    success: true,
    route: results[0],
  });
}

export async function getRouteVehicles(req: Request, res: Response): Promise<void> {
  const { routeId } = req.params;
  const db = getDb();

  const vehicles = await db
    .collection('vehicles')
    .find({ routeId })
    .sort({ vehicleId: 1 })
    .toArray();

  res.json({
    success: true,
    routeId,
    count: vehicles.length,
    vehicles,
  });
}
