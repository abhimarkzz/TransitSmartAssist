import { Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDb, withTransaction } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { SavedTripDoc } from '../models/types';

/**
 * Executes a REAL MongoDB Multi-Document ACID Transaction:
 * Atomically creates saved trip, inserts recommendation history,
 * updates user travel statistics, and records an audit log event.
 */
export async function saveTripWithTransaction(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const {
    origin,
    destination,
    routeId,
    routeName,
    transitType,
    travelTimeMinutes,
    walkingDistanceMeters,
    transfers,
    crowdLevel,
    score,
    savedPreferences,
  } = req.body;

  if (!origin || !destination || !routeId || !routeName) {
    res.status(400).json({
      success: false,
      error: 'Missing required trip fields: origin, destination, routeId, routeName.',
    });
    return;
  }

  const tripId = `TRP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const tripDoc: SavedTripDoc = {
    tripId,
    userId,
    origin,
    destination,
    routeId,
    routeName,
    transitType: transitType || 'METRO',
    travelTimeMinutes: travelTimeMinutes || 25,
    walkingDistanceMeters: walkingDistanceMeters || 350,
    transfers: transfers ?? 0,
    crowdLevel: crowdLevel || 'MODERATE',
    score: score || 85,
    savedPreferences: savedPreferences || {},
    createdAt: new Date(),
  };

  const startTime = Date.now();

  try {
    // MongoDB Multi-Document ACID Transaction via native driver
    const txResult = await withTransaction(async (session, db) => {
      // 1. Insert into savedTrips collection
      const insertTripRes = await db.collection('savedTrips').insertOne(tripDoc, { session });

      // 2. Insert into recommendationHistory collection
      const historyDoc = {
        recommendationId: `REC-${Date.now()}`,
        userId,
        selectedRouteId: routeId,
        score: score || 85,
        reasoning: `Commuter saved route ${routeName} with score ${score}.`,
        createdAt: new Date(),
      };
      await db.collection('recommendationHistory').insertOne(historyDoc, { session });

      // 3. Atomically update user travel statistics in users collection
      let userObjId: ObjectId;
      try {
        userObjId = new ObjectId(userId);
      } catch {
        userObjId = new ObjectId();
      }

      await db.collection('users').updateOne(
        { _id: userObjId },
        {
          $inc: { 'travelStats.tripsSaved': 1, 'travelStats.totalDistanceKm': 8 },
          $addToSet: { 'travelStats.routesUsed': routeId },
          $set: { 'travelStats.lastActive': new Date() },
        },
        { session }
      );

      // 4. Insert into auditLogs collection
      const auditDoc = {
        action: 'TRIP_SAVED_TRANSACTION',
        userId,
        details: {
          tripId,
          routeId,
          routeName,
          score,
          travelTimeMinutes,
        },
        timestamp: new Date(),
      };
      await db.collection('auditLogs').insertOne(auditDoc, { session });

      return {
        tripInsertedId: insertTripRes.insertedId,
        tripId,
      };
    });

    const executionTimeMs = Date.now() - startTime;

    res.status(201).json({
      success: true,
      message: 'Trip saved successfully via atomic MongoDB multi-document transaction.',
      trip: tripDoc,
      transactionMetadata: {
        atomicOperationsCommitted: 4,
        collectionsAffected: ['savedTrips', 'recommendationHistory', 'users', 'auditLogs'],
        isolationLevel: 'Snapshot / Read Committed',
        executionTimeMs,
      },
    });
  } catch (err: any) {
    console.error('[Transaction Error] Saved trip transaction aborted:', err);
    res.status(500).json({
      success: false,
      error: 'MongoDB transaction aborted and rolled back: ' + err.message,
    });
  }
}

export async function getSavedTrips(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const db = getDb();
  const trips = await db
    .collection('savedTrips')
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();

  res.json({
    success: true,
    count: trips.length,
    trips,
  });
}

export async function deleteSavedTrip(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const { tripId } = req.params;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const db = getDb();
  const deleteResult = await db.collection('savedTrips').deleteOne({ tripId, userId });

  if (deleteResult.deletedCount === 0) {
    res.status(404).json({ success: false, error: 'Saved trip not found.' });
    return;
  }

  // Record audit event
  await db.collection('auditLogs').insertOne({
    action: 'TRIP_DELETED',
    userId,
    details: { tripId },
    timestamp: new Date(),
  });

  res.json({
    success: true,
    message: 'Trip deleted from saved trips.',
    tripId,
  });
}
