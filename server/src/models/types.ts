import { ObjectId } from 'mongodb';

export type UserRole = 'commuter' | 'admin';
export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type RouteType = 'METRO' | 'BUS' | 'LIGHT_RAIL' | 'EXPRESS';
export type RouteStatus = 'ON_TIME' | 'DELAYED' | 'HEAVY_DELAY' | 'MAINTENANCE';
export type VehicleStatus = 'ACTIVE' | 'DELAYED' | 'HEAVY_TRAFFIC' | 'OUT_OF_SERVICE';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

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
  lastActive: Date;
}

export interface UserDoc {
  _id?: ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  preferences: UserPreferences;
  travelStats: UserTravelStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface StopDoc {
  _id?: ObjectId;
  stopId: string;
  name: string;
  code: string;
  location: GeoPoint;
  zone: string;
  amenities: string[];
  accessible: boolean;
  connectingRoutes: string[];
  currentCrowdLevel: CrowdLevel;
  currentDelaySeconds: number;
  passengerFlowPerHour: number;
  updatedAt?: Date;
}

export interface RouteStop {
  stopId: string;
  sequence: number;
  stopName: string;
  location: GeoPoint;
  distanceFromStartMeters: number;
  typicalTransitTimeMinutes: number;
}

export interface RouteDoc {
  _id?: ObjectId;
  routeId: string;
  name: string;
  shortName: string;
  type: RouteType;
  description: string;
  color: string;
  stops: RouteStop[];
  geometry: GeoLineString;
  totalDistanceMeters: number;
  baseTravelMinutes: number;
  scheduleIntervalMinutes: number;
  currentStatus: RouteStatus;
  currentDelaySeconds: number;
  averageCrowdLevel: CrowdLevel;
  reliabilityScore: number; // 0 - 100
  accessible: boolean;
  tags: string[];
  embedding?: number[]; // Vector search embedding
  updatedAt?: Date;
}

export interface VehicleDoc {
  _id?: ObjectId;
  vehicleId: string;
  routeId: string;
  currentStopId: string;
  nextStopId: string;
  location: GeoPoint;
  heading: number;
  speedKmH: number;
  occupancy: number; // 0 - 100
  crowdLevel: CrowdLevel;
  delaySeconds: number;
  status: VehicleStatus;
  updatedAt: Date;
}

export interface TransitTelemetryDoc {
  _id?: ObjectId;
  timestamp: Date;
  metadata: {
    vehicleId: string;
    routeId: string;
    stopId?: string;
  };
  delaySeconds: number;
  occupancy: number;
  crowdLevel: CrowdLevel;
  speed: number;
  status: VehicleStatus;
  location: GeoPoint;
}

export interface AlertDoc {
  _id?: ObjectId;
  alertId: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  affectedRoutes: string[];
  affectedStops: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemporaryAlertDoc {
  _id?: ObjectId;
  type: string;
  message: string;
  routeId: string;
  expireAt: Date;
  createdAt: Date;
}

export interface SavedTripDoc {
  _id?: ObjectId;
  tripId: string;
  userId: string;
  origin: {
    name: string;
    location: GeoPoint;
  };
  destination: {
    name: string;
    location: GeoPoint;
  };
  routeId: string;
  routeName: string;
  transitType: RouteType;
  travelTimeMinutes: number;
  walkingDistanceMeters: number;
  transfers: number;
  crowdLevel: CrowdLevel;
  score: number;
  savedPreferences: UserPreferences;
  createdAt: Date;
}

export interface RecommendationHistoryDoc {
  _id?: ObjectId;
  recommendationId: string;
  userId: string;
  selectedRouteId: string;
  score: number;
  reasoning: string;
  createdAt: Date;
}

export interface AuditLogDoc {
  _id?: ObjectId;
  action: string;
  userId: string;
  details: Record<string, any>;
  timestamp: Date;
}
