import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { connectToDatabase, closeDatabaseConnection, getDb } from '../src/config/db';

let token: string = '';
let testUserId: string = '';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connectToDatabase();
});

afterAll(async () => {
  await closeDatabaseConnection();
});

describe('TransitSmartAssist Backend & MongoDB Test Suite', () => {
  // 1. Health Check
  it('GET /api/health should return HEALTHY and database info', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('HEALTHY');
    expect(res.body.database).toBe('MongoDB');
  });

  // 2. Authentication & Demo Login
  it('POST /api/auth/demo should log in demo commuter and issue JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/demo')
      .send({ role: 'commuter' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('commuter');

    token = res.body.token;
    testUserId = res.body.user.id;
  });

  // 3. Geospatial $geoNear Search
  it('GET /api/stops/nearby should execute MongoDB $geoNear on 2dsphere index', async () => {
    const res = await request(app)
      .get('/api/stops/nearby?lng=-73.9851&lat=40.7488&maxDistance=2500');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mongoStageUsed).toContain('$geoNear');
    expect(res.body.stops).toBeInstanceOf(Array);
    expect(res.body.stops.length).toBeGreaterThan(0);
    expect(res.body.stops[0].distanceMeters).toBeDefined();
  });

  // 4. Routes Lookup with Aggregation $lookup
  it('GET /api/routes should return transit routes with stop counts', async () => {
    const res = await request(app).get('/api/routes');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.routes.length).toBeGreaterThanOrEqual(20);
    expect(res.body.routes[0].routeId).toBeDefined();
  });

  it('GET /api/routes/M1 should join live vehicles and alerts via $lookup', async () => {
    const res = await request(app).get('/api/routes/M1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.route.routeId).toBe('M1');
    expect(res.body.route.liveVehicles).toBeInstanceOf(Array);
    expect(res.body.route.activeAlerts).toBeInstanceOf(Array);
  });

  // 5. Smart Route Recommendations (MongoDB Aggregation Pipeline)
  it('POST /api/recommendations should run multi-criteria weighted scoring pipeline', async () => {
    const res = await request(app)
      .post('/api/recommendations')
      .send({
        originCoords: [-73.9851, 40.7488], // Grand Central area
        destCoords: [-73.9751, 40.7838],  // Central Park Uptown area
        originName: 'Grand Central',
        destName: 'Central Park South',
        preferences: {
          avoidCrowds: true,
          lessWalking: true,
          fasterTravel: true,
          preferReliable: true,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.recommended).toBeDefined();
    expect(res.body.recommended.score).toBeGreaterThan(0);
    expect(res.body.pipelineStagesUsed).toBeInstanceOf(Array);
    expect(res.body.pipelineStagesUsed.length).toBeGreaterThanOrEqual(5);
  });

  // 6. Analytics Aggregation Pipelines
  it('GET /api/analytics/kpis should compute KPIs via MongoDB aggregation', async () => {
    const res = await request(app).get('/api/analytics/kpis');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.kpis.totalRoutes).toBeGreaterThan(0);
    expect(res.body.kpis.activeVehicles).toBeGreaterThan(0);
  });

  it('GET /api/analytics/delay-by-route should group time-series telemetry', async () => {
    const res = await request(app).get('/api/analytics/delay-by-route');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.routes).toBeInstanceOf(Array);
  });

  it('GET /api/analytics/peak-hours should aggregate time-series by $hour', async () => {
    const res = await request(app).get('/api/analytics/peak-hours');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.peakHours).toBeInstanceOf(Array);
  });

  // 7. Multi-Document ACID Transaction Workflow
  it('POST /api/trips/save should atomically commit across 4 collections', async () => {
    const res = await request(app)
      .post('/api/trips/save')
      .set('Authorization', `Bearer ${token}`)
      .send({
        origin: { name: 'Test Origin', location: { type: 'Point', coordinates: [-73.98, 40.74] } },
        destination: { name: 'Test Dest', location: { type: 'Point', coordinates: [-73.97, 40.78] } },
        routeId: 'M1',
        routeName: 'Metro Blue Line',
        transitType: 'METRO',
        travelTimeMinutes: 20,
        walkingDistanceMeters: 300,
        transfers: 0,
        crowdLevel: 'LOW',
        score: 94,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.transactionMetadata.atomicOperationsCommitted).toBe(4);
    expect(res.body.transactionMetadata.collectionsAffected).toContain('savedTrips');
    expect(res.body.transactionMetadata.collectionsAffected).toContain('users');
    expect(res.body.transactionMetadata.collectionsAffected).toContain('auditLogs');
  });

  // 8. Search & Vector Search
  it('GET /api/search should query routes and stops', async () => {
    const res = await request(app).get('/api/search?q=Metro');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.routes).toBeInstanceOf(Array);
  });

  it('POST /api/vector-search should execute semantic embedding matching', async () => {
    const res = await request(app)
      .post('/api/vector-search')
      .send({ query: 'quiet route with less walking' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.vectorDimensions).toBe(768);
    expect(res.body.routes.length).toBeGreaterThan(0);
  });

  // 9. Query Lab Demos
  it('GET /api/mongodb/query-lab/1 should execute Demo 1 ($geoNear)', async () => {
    const res = await request(app).get('/api/mongodb/query-lab/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.demoId).toBe(1);
    expect(res.body.result).toBeInstanceOf(Array);
  });

  it('GET /api/mongodb/explain should return executionStats and index usage', async () => {
    const res = await request(app).get('/api/mongodb/explain?collection=vehicles&routeId=M1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.metrics.executionTimeMillis).toBeDefined();
  });
});
