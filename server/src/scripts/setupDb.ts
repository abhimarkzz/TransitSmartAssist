import { connectToDatabase, closeDatabaseConnection } from '../config/db';
import {
  userJsonSchema,
  stopJsonSchema,
  routeJsonSchema,
  savedTripJsonSchema,
  alertJsonSchema,
} from '../models/schemas';

export async function setupDatabase(): Promise<void> {
  const { db } = await connectToDatabase();
  console.log('[SetupDB] Initializing MongoDB database collections, schema validators, and advanced indexes...');

  const existingCollections = (await db.listCollections().toArray()).map((c) => c.name);

  // 1. Time-Series Collection: transitTelemetry
  if (!existingCollections.includes('transitTelemetry')) {
    console.log('[SetupDB] Creating Time-Series collection: transitTelemetry (granularity: seconds, metaField: metadata)');
    await db.createCollection('transitTelemetry', {
      timeseries: {
        timeField: 'timestamp',
        metaField: 'metadata',
        granularity: 'seconds',
      },
    });
  } else {
    console.log('[SetupDB] Time-Series collection transitTelemetry already exists.');
  }

  // 2. Collections with Database-Level JSON Schema Validation ($jsonSchema)
  const schemaCollections = [
    { name: 'users', validator: userJsonSchema },
    { name: 'stops', validator: stopJsonSchema },
    { name: 'routes', validator: routeJsonSchema },
    { name: 'savedTrips', validator: savedTripJsonSchema },
    { name: 'alerts', validator: alertJsonSchema },
  ];

  for (const { name, validator } of schemaCollections) {
    if (!existingCollections.includes(name)) {
      console.log(`[SetupDB] Creating collection with $jsonSchema validation: ${name}`);
      await db.createCollection(name, {
        validator,
        validationLevel: 'moderate', // 'moderate' allows backward compatibility while strictly validating new/updated docs
        validationAction: 'error',
      });
    } else {
      console.log(`[SetupDB] Updating schema validator on collection: ${name}`);
      try {
        await db.command({
          collMod: name,
          validator: (validator as any).validator || validator,
          validationLevel: 'moderate',
          validationAction: 'error',
        });
      } catch (err: any) {
        console.warn(`[SetupDB] Warning updating validator on ${name}:`, err.message);
      }
    }
  }

  // 3. Operational & Audit Collections
  const standardCollections = ['vehicles', 'recommendationHistory', 'auditLogs', 'temporaryAlerts', 'materializedRouteStats'];
  for (const name of standardCollections) {
    if (!existingCollections.includes(name)) {
      console.log(`[SetupDB] Creating standard collection: ${name}`);
      await db.createCollection(name);
    }
  }

  // 4. Create Advanced Indexes
  console.log('[SetupDB] Creating advanced MongoDB indexes (2dsphere, Compound, Partial, TTL, Unique, Text)...');

  // A. Geospatial 2dsphere Indexes
  await db.collection('stops').createIndex({ location: '2dsphere' }, { name: 'idx_stops_2dsphere' });
  await db.collection('vehicles').createIndex({ location: '2dsphere' }, { name: 'idx_vehicles_2dsphere' });
  console.log('[SetupDB] Created 2dsphere geospatial indexes on stops & vehicles.');

  // B. Unique Indexes
  await db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'idx_users_email_unique' });
  await db.collection('stops').createIndex({ stopId: 1 }, { unique: true, name: 'idx_stops_stopId_unique' });
  await db.collection('routes').createIndex({ routeId: 1 }, { unique: true, name: 'idx_routes_routeId_unique' });
  await db.collection('vehicles').createIndex({ vehicleId: 1 }, { unique: true, name: 'idx_vehicles_vehicleId_unique' });
  await db.collection('alerts').createIndex({ alertId: 1 }, { unique: true, name: 'idx_alerts_alertId_unique' });

  // C. Compound Indexes for High-Frequency Operational Queries
  await db.collection('vehicles').createIndex({ routeId: 1, status: 1 }, { name: 'idx_vehicles_route_status' });
  await db.collection('routes').createIndex({ type: 1, currentStatus: 1 }, { name: 'idx_routes_type_status' });
  await db.collection('savedTrips').createIndex({ userId: 1, createdAt: -1 }, { name: 'idx_savedtrips_user_date' });
  await db.collection('transitTelemetry').createIndex({ 'metadata.routeId': 1, timestamp: -1 }, { name: 'idx_telemetry_route_time' });

  // D. Partial Index: Fast filtering for ACTIVE alerts only (ignoring resolved alerts)
  await db.collection('alerts').createIndex(
    { severity: 1, active: 1 },
    {
      partialFilterExpression: { active: true },
      name: 'idx_alerts_active_partial',
    }
  );
  console.log('[SetupDB] Created Partial Index on active alerts.');

  // E. TTL Index (Time-To-Live): Automatically expires ephemeral temporary alerts & transient cache
  await db.collection('temporaryAlerts').createIndex(
    { expireAt: 1 },
    { expireAfterSeconds: 0, name: 'idx_temporary_alerts_ttl' }
  );
  console.log('[SetupDB] Created TTL Index on temporaryAlerts (expireAfterSeconds: 0).');

  // F. Text Indexes (for local fallback and full-text search)
  await db.collection('stops').createIndex(
    { name: 'text', amenities: 'text', zone: 'text' },
    { name: 'idx_stops_text_search', weights: { name: 10, amenities: 3, zone: 2 } }
  );
  await db.collection('routes').createIndex(
    { name: 'text', description: 'text', tags: 'text' },
    { name: 'idx_routes_text_search', weights: { name: 10, tags: 5, description: 2 } }
  );
  console.log('[SetupDB] Created weighted full-text indexes for search fallback.');

  // G. Materialized Route Stats Unique Index (required by MongoDB $merge with on: 'routeId')
  await db.collection('materializedRouteStats').createIndex({ routeId: 1 }, { unique: true, name: 'idx_mat_routeId_unique' });

  // H. Audit Log Index
  await db.collection('auditLogs').createIndex({ timestamp: -1 }, { name: 'idx_audit_timestamp' });

  // 5. Create or Refresh MongoDB View / Materialized Collection
  // Create view v_route_summary if supported
  try {
    const views = (await db.listCollections({ type: 'view' }).toArray()).map((v) => v.name);
    if (!views.includes('v_route_summary')) {
      console.log('[SetupDB] Creating MongoDB analytical view: v_route_summary');
      await db.createCollection('v_route_summary', {
        viewOn: 'routes',
        pipeline: [
          {
            $project: {
              routeId: 1,
              name: 1,
              type: 1,
              color: 1,
              baseTravelMinutes: 1,
              currentDelaySeconds: 1,
              averageCrowdLevel: 1,
              reliabilityScore: 1,
              stopCount: { $size: '$stops' },
              totalDistanceMeters: 1,
            },
          },
        ],
      });
    }
  } catch (viewErr: any) {
    console.warn('[SetupDB] Note on MongoDB view creation:', viewErr.message);
  }

  console.log('[SetupDB] Database setup completed successfully!');
}

if (require.main === module) {
  setupDatabase()
    .then(async () => {
      await closeDatabaseConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[SetupDB] Fatal setup error:', err);
      await closeDatabaseConnection();
      process.exit(1);
    });
}
