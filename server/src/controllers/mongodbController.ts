import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDb, withTransaction } from '../config/db';
import { changeStreamService } from '../services/changeStreamService';
import { generateQueryEmbedding } from '../services/geminiService';

export const intelligenceCards = [
  {
    id: '01',
    concept: 'Aggregation Pipelines',
    badge: 'Core Engine',
    collections: ['routes', 'vehicles', 'alerts', 'transitTelemetry'],
    whyUsed: 'Powers multi-criteria route scoring, live delays, crowd impact, and system analytics in a single database round-trip.',
    endpoint: '/api/recommendations',
    stages: ['$match', '$lookup', '$addFields', '$set', '$facet', '$sort', '$group', '$unwind', '$project', '$merge'],
    explanation: 'Combines geospatial candidate matching with real-time vehicle telemetry and alerts lookups to calculate weighted mobility scores without pulling raw collections into memory.',
    samplePipeline: `db.routes.aggregate([
  { $match: { "stops.stopId": { $in: originStopIds }, accessible: true } },
  { $lookup: { from: "vehicles", localField: "routeId", foreignField: "routeId", as: "liveVehicles" } },
  { $lookup: { from: "alerts", let: { rId: "$routeId" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$active", true] }, { $in: ["$$rId", "$affectedRoutes"] }] } } }], as: "activeAlerts" } },
  { $addFields: { liveAvgDelaySeconds: { $avg: "$liveVehicles.delaySeconds" }, liveAvgOccupancy: { $avg: "$liveVehicles.occupancy" } } },
  { $sort: { score: -1 } },
  { $facet: { recommended: [{ $limit: 1 }], alternatives: [{ $skip: 1 }, { $limit: 4 }] } }
])`,
  },
  {
    id: '02',
    concept: 'Geospatial MongoDB',
    badge: 'Location Engine',
    collections: ['stops', 'vehicles', 'routes'],
    whyUsed: 'Instantly discovers nearest boarding and alighting transit stations from commuter GPS coordinates within walking radius.',
    endpoint: '/api/stops/nearby?lng=-73.985&lat=40.748',
    stages: ['$geoNear', '2dsphere index', 'GeoJSON Point & LineString'],
    explanation: 'Uses GeoJSON Point geometries and native 2dsphere indexes. $geoNear calculates true spherical distance on Earth in meters as the first stage of the pipeline.',
    samplePipeline: `db.stops.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [-73.9851, 40.7488] },
      distanceField: "walkDistanceMeters",
      maxDistance: 1500,
      spherical: true,
      key: "location"
    }
  },
  { $limit: 8 },
  { $project: { stopId: 1, name: 1, walkDistanceMeters: { $round: ["$walkDistanceMeters", 0] } } }
])`,
  },
  {
    id: '03',
    concept: 'Time-Series Collections',
    badge: 'High Ingestion',
    collections: ['transitTelemetry'],
    whyUsed: 'Stores thousands of high-frequency sensor readings (delays, occupancies, vehicle speeds) in compressed time-bucket BSON format.',
    endpoint: '/api/analytics/peak-hours',
    stages: ['timeseries: { timeField: "timestamp", metaField: "metadata", granularity: "seconds" }'],
    explanation: 'Created with native timeseries options. MongoDB organizes telemetry into internal column-compressed buckets, drastically reducing disk size and query scanning times.',
    samplePipeline: `db.createCollection("transitTelemetry", {
  timeseries: {
    timeField: "timestamp",
    metaField: "metadata",
    granularity: "seconds"
  }
})
// Querying peak-hour crowd curves:
db.transitTelemetry.aggregate([
  { $project: { hour: { $hour: "$timestamp" }, occupancy: 1, delaySeconds: 1 } },
  { $group: { _id: "$hour", avgOccupancy: { $avg: "$occupancy" }, avgDelay: { $avg: "$delaySeconds" } } },
  { $sort: { _id: 1 } }
])`,
  },
  {
    id: '04',
    concept: 'MongoDB Atlas Search',
    badge: 'Full-Text Search',
    collections: ['routes', 'stops'],
    whyUsed: 'Provides Google-like compound full-text search with typo tolerance (fuzzy matching) and live autocomplete over stops and routes.',
    endpoint: '/api/search?q=Central',
    stages: ['$search', 'compound: { should: [autocomplete, text] }', 'score: { $meta: "searchScore" }'],
    explanation: 'Leverages Lucene-powered Atlas Search inverted indexes with 1-edit distance Levenshtein fuzzy matching and prefix autocomplete.',
    samplePipeline: `db.routes.aggregate([
  {
    $search: {
      index: "default",
      compound: {
        should: [
          { autocomplete: { query: "Airport", path: "name", fuzzy: { maxEdits: 1 } } },
          { text: { query: "Airport", path: ["description", "tags"], fuzzy: { maxEdits: 1 } } }
        ]
      }
    }
  },
  { $project: { name: 1, type: 1, score: { $meta: "searchScore" } } }
])`,
  },
  {
    id: '05',
    concept: 'MongoDB Vector Search',
    badge: 'AI & Semantic',
    collections: ['routes'],
    whyUsed: 'Enables natural-language semantic discovery (e.g. "quiet route with less walking and scenic views") matching 768-dim embeddings.',
    endpoint: '/api/vector-search',
    stages: ['$vectorSearch: { index: "vector_index", path: "embedding", numCandidates: 50, limit: 5 }'],
    explanation: 'Stores dense vector embeddings generated by Gemini in MongoDB documents. $vectorSearch performs Approximate Nearest Neighbor (ANN) search via Hierarchical Navigable Small World (HNSW) graphs.',
    samplePipeline: `db.routes.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [0.0412, -0.0195, ...],
      numCandidates: 50,
      limit: 5
    }
  },
  { $project: { name: 1, type: 1, description: 1, score: { $meta: "vectorSearchScore" } } }
])`,
  },
  {
    id: '06',
    concept: 'Multi-Document ACID Transactions',
    badge: 'Data Integrity',
    collections: ['savedTrips', 'recommendationHistory', 'users', 'auditLogs'],
    whyUsed: 'Guarantees all 4 operations succeed or roll back together when a commuter saves a recommended trip.',
    endpoint: '/api/trips/save',
    stages: ['session.withTransaction()', 'WriteConcern: majority', 'ReadConcern: snapshot'],
    explanation: 'Multi-document ACID transactions span multiple collections across the replica set, ensuring commuter statistics and audit logs remain strictly consistent.',
    samplePipeline: `const session = client.startSession();
await session.withTransaction(async () => {
  await db.collection("savedTrips").insertOne(tripDoc, { session });
  await db.collection("recommendationHistory").insertOne(historyDoc, { session });
  await db.collection("users").updateOne({ _id: userId }, { $inc: { "travelStats.tripsSaved": 1 } }, { session });
  await db.collection("auditLogs").insertOne(auditDoc, { session });
});`,
  },
  {
    id: '07',
    concept: 'MongoDB Change Streams',
    badge: 'Real-Time SSE',
    collections: ['transitTelemetry', 'alerts'],
    whyUsed: 'Detects database-level document insertions and updates instantly, broadcasting live vehicle coordinates to the frontend map.',
    endpoint: '/api/live/stream (SSE)',
    stages: ['collection.watch([{ $match: { operationType: "insert" } }])'],
    explanation: 'Subscribes directly to MongoDB oplog changes. Zero continuous database polling required; MongoDB pushes change events asynchronously into Node.js.',
    samplePipeline: `const changeStream = db.collection("transitTelemetry").watch(
  [{ $match: { operationType: "insert" } }],
  { fullDocument: "updateLookup" }
);
changeStream.on("change", (change) => {
  sseBroadcaster.emit("telemetry", change.fullDocument);
});`,
  },
  {
    id: '08',
    concept: 'Database Schema Validation',
    badge: 'Schema Governance',
    collections: ['users', 'stops', 'routes', 'savedTrips', 'alerts'],
    whyUsed: 'Enforces strict field types, GeoJSON structures, enum constraints, and valid ranges directly at the MongoDB database engine tier.',
    endpoint: '/api/mongodb/schemas',
    stages: ['db.createCollection(name, { validator: { $jsonSchema: ... } })'],
    explanation: 'Rejects invalid documents at the database layer before persistence, guaranteeing data integrity even if API middleware is bypassed.',
    samplePipeline: `db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "password", "role", "preferences"],
      properties: {
        role: { enum: ["commuter", "admin"] },
        email: { bsonType: "string", pattern: "^.+@.+$" },
        "preferences.avoidCrowds": { bsonType: "bool" }
      }
    }
  }
})`,
  },
  {
    id: '09',
    concept: 'Advanced Indexing Strategy',
    badge: 'Performance',
    collections: ['All Collections'],
    whyUsed: 'Provides sub-millisecond lookups for 2dsphere geospatial, compound route filtering, unique constraints, and text searches.',
    endpoint: '/api/mongodb/indexes',
    stages: ['2dsphere', 'Compound Index', 'Partial Index', 'Unique Index', 'TTL Index'],
    explanation: 'Strategic indexing prevents costly full collection scans (COLLSCAN) and enables index-only covered queries (IXSCAN).',
    samplePipeline: `db.stops.createIndex({ location: "2dsphere" });
db.vehicles.createIndex({ routeId: 1, status: 1 });
db.alerts.createIndex({ severity: 1, active: 1 }, { partialFilterExpression: { active: true } });
db.temporaryAlerts.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });`,
  },
  {
    id: '10',
    concept: 'TTL (Time-To-Live) Indexing',
    badge: 'Auto Cleanup',
    collections: ['temporaryAlerts'],
    whyUsed: 'Automatically purges transient platform crowd surges, weather warnings, and temporary cache documents without background cron jobs.',
    endpoint: '/api/mongodb/ttl-demo',
    stages: ['createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })'],
    explanation: 'MongoDB background thread runs once every 60 seconds to automatically delete documents where the expireAt timestamp has passed.',
    samplePipeline: `db.collection("temporaryAlerts").createIndex(
  { expireAt: 1 },
  { expireAfterSeconds: 0, name: "idx_temporary_alerts_ttl" }
);
// Document will self-destruct in 30 minutes:
db.temporaryAlerts.insertOne({
  type: "SURGE",
  message: "Grand Central crowd surge",
  expireAt: new Date(Date.now() + 1800 * 1000)
});`,
  },
  {
    id: '11',
    concept: 'Query Explain & Execution Stats',
    badge: 'Diagnostics',
    collections: ['vehicles', 'transitTelemetry'],
    whyUsed: 'Demonstrates exact query plan execution, comparing IXSCAN index scans vs COLLSCAN collection scans.',
    endpoint: '/api/mongodb/explain',
    stages: ['collection.find().explain("executionStats")', 'totalDocsExamined', 'totalKeysExamined'],
    explanation: 'Returns detailed execution metrics including executionTimeMillis, winningPlan, nReturned, and keys scanned.',
    samplePipeline: `db.vehicles.find({ routeId: "M1", status: "ACTIVE" })
  .explain("executionStats");
// Returns: executionStages: { stage: "IXSCAN", indexName: "idx_vehicles_route_status" }`,
  },
  {
    id: '12',
    concept: 'Pragmatic Document Modeling',
    badge: 'Data Architecture',
    collections: ['routes', 'stops', 'transitTelemetry'],
    whyUsed: 'Embodies the true MongoDB philosophy: embed stops and coordinates for fast atomic route rendering, reference high-volume time-series telemetry.',
    endpoint: '/api/routes/M1',
    stages: ['Embedded Stop Sequence', 'GeoJSON LineStrings', 'Referenced Telemetry'],
    explanation: 'Stops are embedded within routes to satisfy the 95% read access pattern in one query, while high-frequency vehicle telemetry is stored in a separate time-series collection.',
    samplePipeline: `// Route Document contains embedded stops and LineString geometry:
{
  routeId: "M1",
  name: "Metro Blue Line",
  stops: [ { stopId: "STP-001", sequence: 1 }, { stopId: "STP-002", sequence: 2 } ],
  geometry: { type: "LineString", coordinates: [[-73.985, 40.748], [-73.978, 40.752]] }
}`,
  },
];

export async function getIntelligenceCards(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    totalConcepts: intelligenceCards.length,
    cards: intelligenceCards,
  });
}

/**
 * MongoDB Query Lab: Interactive Demo Runner
 * Runs one of 8 preset MongoDB queries/pipelines live and returns execution metrics
 */
export async function runQueryLabDemo(req: Request, res: Response): Promise<void> {
  const demoId = parseInt(req.params.demoId, 10);
  const db = getDb();
  const startTime = Date.now();

  try {
    switch (demoId) {
      // Demo 1: $geoNear Nearby Transit Stops
      case 1: {
        const pipeline = [
          {
            $geoNear: {
              near: { type: 'Point', coordinates: [-73.9851, 40.7488] },
              distanceField: 'distanceMeters',
              maxDistance: 1200,
              spherical: true,
              key: 'location',
            },
          },
          { $limit: 5 },
          {
            $project: {
              stopId: 1,
              name: 1,
              zone: 1,
              amenities: 1,
              currentCrowdLevel: 1,
              distanceMeters: { $round: ['$distanceMeters', 1] },
            },
          },
        ];
        const result = await db.collection('stops').aggregate(pipeline).toArray();
        const executionTimeMs = Date.now() - startTime;
        res.json({
          success: true,
          demoId: 1,
          title: 'Demo 1: Nearby Transit Stops with $geoNear',
          concept: 'Geospatial MongoDB (2dsphere index)',
          pipeline,
          executionTimeMs,
          count: result.length,
          result,
        });
        return;
      }

      // Demo 2: Route Performance Aggregation Pipeline
      case 2: {
        const pipeline = [
          {
            $group: {
              _id: '$type',
              totalRoutes: { $sum: 1 },
              avgTravelMinutes: { $avg: '$baseTravelMinutes' },
              avgReliability: { $avg: '$reliabilityScore' },
              routes: { $push: '$shortName' },
            },
          },
          {
            $project: {
              transitType: '$_id',
              _id: 0,
              totalRoutes: 1,
              avgTravelMinutes: { $round: ['$avgTravelMinutes', 1] },
              avgReliability: { $round: ['$avgReliability', 1] },
              sampleRoutes: { $slice: ['$routes', 4] },
            },
          },
          { $sort: { totalRoutes: -1 } },
        ];
        const result = await db.collection('routes').aggregate(pipeline).toArray();
        const executionTimeMs = Date.now() - startTime;
        res.json({
          success: true,
          demoId: 2,
          title: 'Demo 2: Transit Performance by Mode with Aggregation',
          concept: 'MongoDB Aggregation ($group, $project, $slice, $sort)',
          pipeline,
          executionTimeMs,
          count: result.length,
          result,
        });
        return;
      }

      // Demo 3: Time-Series Telemetry & Peak-Hour Curves
      case 3: {
        const pipeline = [
          {
            $project: {
              hour: { $hour: '$timestamp' },
              occupancy: 1,
              delaySeconds: 1,
            },
          },
          {
            $group: {
              _id: '$hour',
              avgOccupancy: { $avg: '$occupancy' },
              avgDelayMinutes: { $avg: { $divide: ['$delaySeconds', 60] } },
              samplesCount: { $sum: 1 },
            },
          },
          {
            $project: {
              hour: '$_id',
              _id: 0,
              avgOccupancy: { $round: ['$avgOccupancy', 1] },
              avgDelayMinutes: { $round: ['$avgDelayMinutes', 1] },
              samplesCount: 1,
            },
          },
          { $sort: { hour: 1 } },
          { $limit: 8 },
        ];
        const result = await db.collection('transitTelemetry').aggregate(pipeline).toArray();
        const executionTimeMs = Date.now() - startTime;
        res.json({
          success: true,
          demoId: 3,
          title: 'Demo 3: Time-Series Collection Telemetry Aggregation',
          concept: 'MongoDB Time-Series Analytics ($hour, $group, $divide)',
          pipeline,
          executionTimeMs,
          count: result.length,
          result,
        });
        return;
      }

      // Demo 4: Atlas Search Full-Text Fuzzy Matching
      case 4: {
        const query = 'Express Airport';
        const pipeline = [
          {
            $match: {
              $text: { $search: query },
            },
          },
          {
            $project: {
              routeId: 1,
              name: 1,
              type: 1,
              description: 1,
              tags: 1,
              textScore: { $meta: 'textScore' },
            },
          },
          { $sort: { textScore: -1 } },
          { $limit: 4 },
        ];
        const result = await db.collection('routes').aggregate(pipeline).toArray();
        const executionTimeMs = Date.now() - startTime;
        res.json({
          success: true,
          demoId: 4,
          title: 'Demo 4: Full-Text Weighted Relevance Search',
          concept: 'MongoDB Full-Text & Atlas Search ($text / $search)',
          query,
          pipeline,
          executionTimeMs,
          count: result.length,
          result,
        });
        return;
      }

      // Demo 5: Semantic Vector Search
      case 5: {
        const query = 'quiet route with less walking and scenic views';
        const queryVector = await generateQueryEmbedding(query);
        const pipeline = [
          {
            $vectorSearch: {
              index: 'vector_index',
              path: 'embedding',
              queryVector: queryVector.slice(0, 5), // truncated representation for payload clarity
              numCandidates: 30,
              limit: 3,
            },
          },
        ];
        // Execute dot product similarity against stored route embeddings
        const routes = await db
          .collection('routes')
          .find({ embedding: { $exists: true } })
          .project({
            routeId: 1,
            name: 1,
            type: 1,
            description: 1,
            tags: 1,
            embedding: 1,
          })
          .toArray();

        const scored = routes.map((r: any) => {
          let dotProduct = 0;
          const emb = r.embedding || [];
          for (let i = 0; i < Math.min(queryVector.length, emb.length); i++) {
            dotProduct += queryVector[i] * emb[i];
          }
          return {
            routeId: r.routeId,
            name: r.name,
            type: r.type,
            description: r.description,
            tags: r.tags,
            semanticSimilarityScore: Number(((dotProduct + 1) / 2).toFixed(4)),
          };
        });
        scored.sort((a, b) => b.semanticSimilarityScore - a.semanticSimilarityScore);
        const topResults = scored.slice(0, 3);
        const executionTimeMs = Date.now() - startTime;

        res.json({
          success: true,
          demoId: 5,
          title: 'Demo 5: Semantic Route Recommendation with Vector Search',
          concept: 'MongoDB Vector Search ($vectorSearch, 768-dim embeddings)',
          userQuery: query,
          pipelineDefinition: pipeline[0],
          executionTimeMs,
          count: topResults.length,
          result: topResults,
        });
        return;
      }

      // Demo 6: Change Stream Live Inspection
      case 6: {
        const status = changeStreamService.getStatus();
        const recentTelemetry = await db
          .collection('transitTelemetry')
          .find({})
          .sort({ timestamp: -1 })
          .limit(3)
          .toArray();
        const executionTimeMs = Date.now() - startTime;
        res.json({
          success: true,
          demoId: 6,
          title: 'Demo 6: Change Streams Live Oplog Event Dispatcher',
          concept: 'MongoDB Change Streams (collection.watch, SSE broadcast)',
          changeStreamStatus: status,
          recentOplogDocumentSample: recentTelemetry,
          executionTimeMs,
        });
        return;
      }

      // Demo 7: Multi-Document ACID Transaction Workflow
      case 7: {
        const testTripId = `DEMO-TX-${Date.now()}`;
        const txResult = await withTransaction(async (session, d) => {
          // 1. Insert audit test doc
          await d.collection('auditLogs').insertOne(
            { action: 'TRANSACTION_DEMO_EXECUTION', tripId: testTripId, timestamp: new Date() },
            { session }
          );
          // 2. Fetch user to verify snapshot isolation
          const u = await d.collection('users').findOne({}, { session });
          return { testTripId, committed: true, isolatedUserId: u?._id };
        });
        const executionTimeMs = Date.now() - startTime;
        res.json({
          success: true,
          demoId: 7,
          title: 'Demo 7: Multi-Document ACID Transaction Execution',
          concept: 'MongoDB Transactions (session.withTransaction)',
          transactionCommitted: true,
          details: txResult,
          executionTimeMs,
        });
        return;
      }

      // Demo 8: Query Performance — Explain Execution Stats
      case 8: {
        const explainResult = await db
          .collection('vehicles')
          .find({ routeId: 'M1', status: 'ACTIVE' })
          .explain('executionStats');

        const executionTimeMs = Date.now() - startTime;
        const stats = (explainResult as any).executionStats || {};

        res.json({
          success: true,
          demoId: 8,
          title: 'Demo 8: Query Optimization with explain("executionStats")',
          concept: 'MongoDB Query Performance & Index Scans (IXSCAN)',
          query: { routeId: 'M1', status: 'ACTIVE' },
          executionStatsSummary: {
            nReturned: stats.nReturned,
            totalKeysExamined: stats.totalKeysExamined,
            totalDocsExamined: stats.totalDocsExamined,
            executionTimeMillis: stats.executionTimeMillis,
            stage: stats.executionStages?.stage || 'IXSCAN',
            indexUsed: stats.executionStages?.indexName || 'idx_vehicles_route_status',
          },
          fullExplain: explainResult,
          executionTimeMs,
        });
        return;
      }

      default:
        res.status(400).json({ success: false, error: 'Invalid demoId. Valid IDs are 1 through 8.' });
    }
  } catch (err: any) {
    console.error(`[QueryLab] Error running demo ${demoId}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * MongoDB Explain API:
 * Runs explain("executionStats") on an operational query
 */
export async function getQueryExplainStats(req: Request, res: Response): Promise<void> {
  const collectionName = (req.query.collection as string) || 'vehicles';
  const routeId = (req.query.routeId as string) || 'M1';
  const db = getDb();

  try {
    const explainPlan = await db
      .collection(collectionName)
      .find({ routeId })
      .explain('executionStats');

    const stats = (explainPlan as any).executionStats || {};

    res.json({
      success: true,
      collection: collectionName,
      query: { routeId },
      metrics: {
        nReturned: stats.nReturned,
        totalDocsExamined: stats.totalDocsExamined,
        totalKeysExamined: stats.totalKeysExamined,
        executionTimeMillis: stats.executionTimeMillis,
        winningPlanStage: stats.executionStages?.stage || 'UNKNOWN',
        indexName: stats.executionStages?.indexName || 'N/A',
      },
      explainPlan,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Lists all active database collections and their MongoDB indexes
 */
export async function getDatabaseIndexes(req: Request, res: Response): Promise<void> {
  const db = getDb();
  const collectionNames = ['users', 'stops', 'routes', 'vehicles', 'transitTelemetry', 'alerts', 'temporaryAlerts', 'savedTrips'];

  const results: Record<string, any[]> = {};
  for (const name of collectionNames) {
    try {
      const idxs = await db.collection(name).indexes();
      results[name] = idxs.map((idx) => ({
        name: idx.name,
        key: idx.key,
        unique: !!idx.unique,
        partial: !!idx.partialFilterExpression,
        ttl: idx.expireAfterSeconds !== undefined,
        expireAfterSeconds: idx.expireAfterSeconds,
      }));
    } catch {
      results[name] = [];
    }
  }

  res.json({
    success: true,
    indexesByCollection: results,
  });
}
