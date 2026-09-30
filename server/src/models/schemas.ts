/**
 * MongoDB Database-Level JSON Schema Validation Definitions ($jsonSchema)
 * Applied directly to collections via db.createCollection() or collMod.
 * Enforces BSON types, required fields, enums, numeric ranges, and GeoJSON structures at the database tier.
 */

export const userJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'email', 'password', 'role', 'preferences', 'createdAt'],
    properties: {
      name: {
        bsonType: 'string',
        minLength: 2,
        maxLength: 100,
        description: 'User display name is required (string 2-100 chars)',
      },
      email: {
        bsonType: 'string',
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        description: 'Valid email address is required',
      },
      password: {
        bsonType: 'string',
        minLength: 8,
        description: 'Hashed password is required',
      },
      role: {
        enum: ['commuter', 'admin'],
        description: 'User role must be commuter or admin',
      },
      preferences: {
        bsonType: 'object',
        required: ['avoidCrowds', 'lessWalking', 'fewerTransfers', 'fasterTravel'],
        properties: {
          avoidCrowds: { bsonType: 'bool' },
          lessWalking: { bsonType: 'bool' },
          fewerTransfers: { bsonType: 'bool' },
          fasterTravel: { bsonType: 'bool' },
          preferReliable: { bsonType: 'bool' },
          accessibleRoute: { bsonType: 'bool' },
          maxWalkDistanceMeters: { bsonType: ['int', 'double', 'long'] },
        },
      },
      travelStats: {
        bsonType: 'object',
        properties: {
          tripsSaved: { bsonType: ['int', 'long'] },
          routesUsed: { bsonType: 'array', items: { bsonType: 'string' } },
          totalDistanceKm: { bsonType: ['int', 'double', 'long'] },
          carbonSavedKg: { bsonType: ['int', 'double', 'long'] },
          lastActive: { bsonType: 'date' },
        },
      },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

export const stopJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['stopId', 'name', 'code', 'location', 'accessible'],
    properties: {
      stopId: { bsonType: 'string' },
      name: { bsonType: 'string', minLength: 2 },
      code: { bsonType: 'string' },
      location: {
        bsonType: 'object',
        required: ['type', 'coordinates'],
        properties: {
          type: { enum: ['Point'] },
          coordinates: {
            bsonType: 'array',
            minItems: 2,
            maxItems: 2,
            items: { bsonType: ['double', 'int'] },
            description: '[longitude, latitude] coordinates',
          },
        },
      },
      zone: { bsonType: 'string' },
      amenities: {
        bsonType: 'array',
        items: { bsonType: 'string' },
      },
      accessible: { bsonType: 'bool' },
      connectingRoutes: {
        bsonType: 'array',
        items: { bsonType: 'string' },
      },
      currentCrowdLevel: {
        enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
      },
      currentDelaySeconds: { bsonType: ['int', 'double', 'long'] },
      passengerFlowPerHour: { bsonType: ['int', 'long'] },
      updatedAt: { bsonType: 'date' },
    },
  },
};

export const routeJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['routeId', 'name', 'type', 'stops', 'geometry', 'baseTravelMinutes'],
    properties: {
      routeId: { bsonType: 'string' },
      name: { bsonType: 'string' },
      shortName: { bsonType: 'string' },
      type: { enum: ['METRO', 'BUS', 'LIGHT_RAIL', 'EXPRESS'] },
      description: { bsonType: 'string' },
      color: { bsonType: 'string' },
      stops: {
        bsonType: 'array',
        minItems: 2,
        description: 'Route must have at least 2 stops',
      },
      geometry: {
        bsonType: 'object',
        required: ['type', 'coordinates'],
        properties: {
          type: { enum: ['LineString'] },
          coordinates: {
            bsonType: 'array',
            minItems: 2,
          },
        },
      },
      totalDistanceMeters: { bsonType: ['int', 'double', 'long'] },
      baseTravelMinutes: { bsonType: ['int', 'double', 'long'] },
      scheduleIntervalMinutes: { bsonType: ['int', 'long'] },
      currentStatus: { enum: ['ON_TIME', 'DELAYED', 'HEAVY_DELAY', 'MAINTENANCE'] },
      currentDelaySeconds: { bsonType: ['int', 'long'] },
      averageCrowdLevel: { enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] },
      reliabilityScore: { bsonType: ['int', 'double', 'long'], minimum: 0, maximum: 100 },
      accessible: { bsonType: 'bool' },
      tags: { bsonType: 'array', items: { bsonType: 'string' } },
      embedding: {
        bsonType: 'array',
        items: { bsonType: ['double', 'int'] },
      },
      updatedAt: { bsonType: 'date' },
    },
  },
};

export const savedTripJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tripId', 'userId', 'origin', 'destination', 'routeId', 'travelTimeMinutes', 'createdAt'],
    properties: {
      tripId: { bsonType: 'string' },
      userId: { bsonType: 'string' },
      origin: {
        bsonType: 'object',
        required: ['name', 'location'],
      },
      destination: {
        bsonType: 'object',
        required: ['name', 'location'],
      },
      routeId: { bsonType: 'string' },
      routeName: { bsonType: 'string' },
      transitType: { enum: ['METRO', 'BUS', 'LIGHT_RAIL', 'EXPRESS'] },
      travelTimeMinutes: { bsonType: ['int', 'double', 'long'], minimum: 1 },
      walkingDistanceMeters: { bsonType: ['int', 'double', 'long'], minimum: 0 },
      transfers: { bsonType: ['int', 'long'], minimum: 0 },
      crowdLevel: { enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] },
      score: { bsonType: ['int', 'double', 'long'] },
      savedPreferences: { bsonType: 'object' },
      createdAt: { bsonType: 'date' },
    },
  },
};

export const alertJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['alertId', 'title', 'severity', 'active', 'createdAt'],
    properties: {
      alertId: { bsonType: 'string' },
      title: { bsonType: 'string' },
      description: { bsonType: 'string' },
      severity: { enum: ['INFO', 'WARNING', 'CRITICAL'] },
      affectedRoutes: { bsonType: 'array', items: { bsonType: 'string' } },
      affectedStops: { bsonType: 'array', items: { bsonType: 'string' } },
      active: { bsonType: 'bool' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};
