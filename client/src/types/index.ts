export type UserRole = 'commuter' | 'admin';
export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type RouteType = 'METRO' | 'BUS' | 'LIGHT_RAIL' | 'EXPRESS';
export type RouteStatus = 'ON_TIME' | 'DELAYED' | 'HEAVY_DELAY' | 'MAINTENANCE';

export interface UserPreferences {
  avoidCrowds: boolean;
  lessWalking: boolean;
  fewerTransfers: boolean;
  fasterTravel: boolean;
  preferReliable: boolean;
  accessibleRoute: boolean;
  maxWalkDistanceMeters?: number;
}

export interface UserTravelStats {
  tripsSaved: number;
  routesUsed: string[];
  totalDistanceKm: number;
  carbonSavedKg: number;
  lastActive: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  preferences: UserPreferences;
  travelStats: UserTravelStats;
}

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface Stop {
  _id: string;
  stopId: string;
  name: string;
  code: string;
  location: GeoPoint;
  zone: string;
  amenities: string[];
  accessible: boolean;
  connectingRoutes: string[];
  currentCrowdLevel: CrowdLevel;
  distanceMeters?: number;
  passengerFlowPerHour?: number;
}

export interface RouteStop {
  stopId: string;
  sequence: number;
  stopName: string;
  location: GeoPoint;
  distanceFromStartMeters: number;
  typicalTransitTimeMinutes: number;
}

export interface Route {
  _id: string;
  routeId: string;
  name: string;
  shortName: string;
  type: RouteType;
  description: string;
  color: string;
  totalDistanceMeters: number;
  baseTravelMinutes: number;
  scheduleIntervalMinutes: number;
  currentStatus: RouteStatus;
  currentDelaySeconds: number;
  averageCrowdLevel: CrowdLevel;
  reliabilityScore: number;
  accessible: boolean;
  tags: string[];
  stopCount: number;
  stops?: RouteStop[];
  geometry?: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

export interface Vehicle {
  _id: string;
  vehicleId: string;
  routeId: string;
  currentStopId: string;
  nextStopId: string;
  location: GeoPoint;
  heading: number;
  speedKmH: number;
  occupancy: number;
  crowdLevel: CrowdLevel;
  delaySeconds: number;
  status: 'ACTIVE' | 'DELAYED' | 'HEAVY_TRAFFIC' | 'OUT_OF_SERVICE';
  updatedAt: string;
}

export interface RouteCandidateResult {
  routeId: string;
  name: string;
  shortName: string;
  type: RouteType;
  color: string;
  score: number;
  travelMinutes: number;
  walkingDistanceMeters: number;
  transfers: number;
  crowdLevel: CrowdLevel;
  delayMinutes: number;
  reliabilityScore: number;
  accessible: boolean;
  boardingStop: {
    stopId: string;
    name: string;
    coordinates: [number, number];
    walkDistanceMeters: number;
  };
  alightingStop: {
    stopId: string;
    name: string;
    coordinates: [number, number];
    walkDistanceMeters: number;
  };
  activeAlerts: string[];
  reasons: string[];
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

export interface RecommendationResponse {
  success: boolean;
  origin: { name: string; coordinates: [number, number] };
  destination: { name: string; coordinates: [number, number] };
  recommended: RouteCandidateResult | null;
  alternatives: RouteCandidateResult[];
  preferencesApplied: UserPreferences;
  totalCandidatesEvaluated: number;
  pipelineStagesUsed: string[];
  executionTimeMs: number;
}

export interface Alert {
  _id: string;
  alertId: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  affectedRoutes: string[];
  affectedStops: string[];
  active: boolean;
  createdAt: string;
}

export interface SavedTrip {
  _id: string;
  tripId: string;
  userId: string;
  origin: { name: string; location: GeoPoint };
  destination: { name: string; location: GeoPoint };
  routeId: string;
  routeName: string;
  transitType: RouteType;
  travelTimeMinutes: number;
  walkingDistanceMeters: number;
  transfers: number;
  crowdLevel: CrowdLevel;
  score: number;
  savedPreferences: UserPreferences;
  createdAt: string;
}

export interface IntelligenceCard {
  id: string;
  concept: string;
  badge: string;
  collections: string[];
  whyUsed: string;
  endpoint: string;
  stages: string[];
  explanation: string;
  samplePipeline: string;
}

export interface QueryLabDemo {
  demoId: number;
  title: string;
  concept: string;
  pipeline: any;
  executionTimeMs: number;
  count?: number;
  result?: any;
  changeStreamStatus?: any;
  transactionCommitted?: boolean;
  details?: any;
  executionStatsSummary?: any;
}
