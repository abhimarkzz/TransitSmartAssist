import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as authController from '../controllers/authController';
import * as routesController from '../controllers/routesController';
import * as stopsController from '../controllers/stopsController';
import * as recController from '../controllers/recommendationsController';
import * as tripsController from '../controllers/tripsController';
import * as analyticsController from '../controllers/analyticsController';
import * as searchController from '../controllers/searchController';
import * as liveController from '../controllers/liveController';
import * as mongoController from '../controllers/mongodbController';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'TransitSmartAssist API',
    database: 'MongoDB',
    timestamp: new Date().toISOString(),
  });
});

// Authentication
router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);
router.post('/auth/demo', authController.demoLogin);
router.get('/auth/me', authenticate, authController.getProfile);
router.put('/users/preferences', authenticate, authController.updatePreferences);

// Routes
router.get('/routes', routesController.getAllRoutes);
router.get('/routes/:routeId', routesController.getRouteById);
router.get('/routes/:routeId/vehicles', routesController.getRouteVehicles);

// Stops (Geospatial)
router.get('/stops/nearby', stopsController.getNearbyStops);
router.get('/stops', stopsController.getAllStops);
router.get('/stops/:stopId', stopsController.getStopById);

// Smart Recommendations & AI Reasoning
router.post('/recommendations', recController.getRecommendations);
router.post('/recommendations/explain', recController.explainRecommendation);

// Saved Trips (ACID Multi-Document Transactions)
router.post('/trips/save', authenticate, tripsController.saveTripWithTransaction);
router.get('/trips', authenticate, tripsController.getSavedTrips);
router.delete('/trips/:tripId', authenticate, tripsController.deleteSavedTrip);

// Analytics (MongoDB Aggregation Pipelines & Materialized Views)
router.get('/analytics/kpis', analyticsController.getDashboardKpis);
router.get('/analytics/delay-by-route', analyticsController.getDelayByRoute);
router.get('/analytics/peak-hours', analyticsController.getPeakHourTrends);
router.get('/analytics/busiest-stops', analyticsController.getBusiestStops);
router.get('/analytics/preferences', analyticsController.getPreferenceDistribution);
router.get('/analytics/materialized', analyticsController.getMaterializedStats);

// Atlas Search & Vector Search
router.get('/search', searchController.searchRoutesAndStops);
router.post('/vector-search', searchController.semanticVectorSearch);
router.get('/vector-search', searchController.semanticVectorSearch);

// Live Transit, Change Streams & Simulation
router.get('/live/stream', liveController.streamLiveUpdates);
router.post('/live/simulation/toggle', liveController.toggleSimulation);
router.get('/live/simulation/status', liveController.getSimulationStatus);
router.get('/live/alerts', liveController.getActiveAlerts);

// MongoDB Intelligence Center & Query Lab
router.get('/mongodb/intelligence', mongoController.getIntelligenceCards);
router.get('/mongodb/query-lab/:demoId', mongoController.runQueryLabDemo);
router.get('/mongodb/explain', mongoController.getQueryExplainStats);
router.get('/mongodb/indexes', mongoController.getDatabaseIndexes);

export default router;
