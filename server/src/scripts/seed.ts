import bcrypt from 'bcryptjs';
import { connectToDatabase, closeDatabaseConnection } from '../config/db';
import { setupDatabase } from './setupDb';
import {
  StopDoc,
  RouteDoc,
  VehicleDoc,
  TransitTelemetryDoc,
  AlertDoc,
  CrowdLevel,
  RouteType,
  RouteStatus,
  VehicleStatus,
  AlertSeverity,
} from '../models/types';

// Deterministic mock embedding generator (768 dimensions) matching standard Gemini / modern embedding models
// Generates reproducible vector embeddings seeded by string tokens
function generateEmbedding(text: string, dims = 768): number[] {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const vec: number[] = [];
  let norm = 0;
  for (let i = 0; i < dims; i++) {
    const val = Math.sin(hash + i * 0.1) * Math.cos(hash * 0.05 + i * 0.2);
    vec.push(val);
    norm += val * val;
  }
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

// Center reference coordinate: MetroCity Central Hub [-73.9851, 40.7488]
const CENTER_LNG = -73.9851;
const CENTER_LAT = 40.7488;

export async function seedDatabase(): Promise<void> {
  // First ensure schema and indexes are applied
  await setupDatabase();
  const { db } = await connectToDatabase();
  console.log('[Seed] Seeding realistic transit network data into MongoDB...');

  // 1. Clear existing operational collections
  await db.collection('users').deleteMany({});
  await db.collection('stops').deleteMany({});
  await db.collection('routes').deleteMany({});
  await db.collection('vehicles').deleteMany({});
  await db.collection('transitTelemetry').deleteMany({});
  await db.collection('alerts').deleteMany({});
  await db.collection('temporaryAlerts').deleteMany({});
  await db.collection('savedTrips').deleteMany({});
  await db.collection('recommendationHistory').deleteMany({});
  await db.collection('auditLogs').deleteMany({});

  console.log('[Seed] Cleared prior operational data.');

  // 2. Seed Users (Commuter & Admin)
  const passwordHash = await bcrypt.hash('TransitDemo2025!', 10);
  const adminPasswordHash = await bcrypt.hash('AdminDemo2025!', 10);

  const users = [
    {
      name: 'Alex Commuter',
      email: 'commuter@transit.demo',
      password: passwordHash,
      role: 'commuter',
      preferences: {
        avoidCrowds: true,
        lessWalking: true,
        fewerTransfers: false,
        fasterTravel: true,
        preferReliable: true,
        accessibleRoute: false,
        maxWalkDistanceMeters: 600,
      },
      travelStats: {
        tripsSaved: 8,
        routesUsed: ['M1', 'M2', 'X40'],
        totalDistanceKm: 142,
        carbonSavedKg: 28.4,
        lastActive: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Transit Operations Admin',
      email: 'admin@transit.demo',
      password: adminPasswordHash,
      role: 'admin',
      preferences: {
        avoidCrowds: false,
        lessWalking: false,
        fewerTransfers: false,
        fasterTravel: true,
        preferReliable: true,
        accessibleRoute: true,
        maxWalkDistanceMeters: 1000,
      },
      travelStats: {
        tripsSaved: 24,
        routesUsed: ['M1', 'M2', 'M3', 'M4', 'B10', 'X40'],
        totalDistanceKm: 420,
        carbonSavedKg: 84.0,
        lastActive: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Elena Rostova',
      email: 'elena.commuter@example.com',
      password: passwordHash,
      role: 'commuter',
      preferences: {
        avoidCrowds: true,
        lessWalking: false,
        fewerTransfers: true,
        fasterTravel: false,
        preferReliable: true,
        accessibleRoute: true,
        maxWalkDistanceMeters: 400,
      },
      travelStats: {
        tripsSaved: 5,
        routesUsed: ['L1', 'B12'],
        totalDistanceKm: 89,
        carbonSavedKg: 17.8,
        lastActive: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await db.collection('users').insertMany(users);
  console.log(`[Seed] Seeded ${users.length} users with bcrypt password hashing.`);

  // 3. Generate 110 Stops across MetroCity
  // Grouped by zones: Downtown, Midtown, Uptown, Tech District, Riverfront, Harbor, University, Airport, Financial, Arts District
  const zones = [
    { name: 'Downtown', offsetLng: -0.015, offsetLat: -0.02 },
    { name: 'Midtown', offsetLng: 0.0, offsetLat: 0.0 },
    { name: 'Uptown', offsetLng: 0.01, offsetLat: 0.035 },
    { name: 'Tech District', offsetLng: 0.04, offsetLat: -0.01 },
    { name: 'University Hub', offsetLng: -0.035, offsetLat: 0.025 },
    { name: 'Riverfront', offsetLng: -0.045, offsetLat: -0.015 },
    { name: 'Harbor Gateway', offsetLng: -0.02, offsetLat: -0.05 },
    { name: 'Airport East', offsetLng: 0.075, offsetLat: -0.045 },
    { name: 'Financial Center', offsetLng: -0.01, offsetLat: -0.035 },
    { name: 'Arts & Culture', offsetLng: 0.02, offsetLat: 0.015 },
  ];

  const stopNamesByZone: Record<string, string[]> = {
    Downtown: ['Grand Central Terminal', 'Civic Center Plaza', 'City Hall Station', 'Market Square', 'Pioneer Boulevard', 'Union Square Central', 'Metro Tower', 'Liberty Plaza', 'Federal Court North', 'Heritage Park', 'Old Town Walk'],
    Midtown: ['Times Plaza', 'Herald Center', 'Penn Exchange', 'Bryant Terrace', 'Rockefeller Concourse', 'Lexington 53rd', 'Grand Boulevard', 'Park Avenue Central', 'Summit Station', 'Midtown North Hub', 'Diamond District'],
    Uptown: ['Central Park South', 'Lincoln Promenade', 'Columbia Circle', 'Museum Mile West', 'Cathedral Parkway', 'Upper West Boulevard', 'Harlem Gateway', 'Manhattan Valley', 'St. Nicholas Ave', 'Morningside Heights', 'Hudson Heights'],
    'Tech District': ['Silicon Boulevard', 'Innovation Plaza', 'Cybernetics Way', 'Data Center South', 'Robotics Campus', 'Quantum Parkway', 'Venture Way', 'BioTech Terrace', 'Cloud Tower', 'AI Research Lab', 'Founders Circle'],
    'University Hub': ['University Quad', 'Science Hall North', 'Medical Campus Plaza', 'Student Union Central', 'Engineering Way', 'Dormitory Ridge', 'Varsity Stadium', 'Dean Square', 'Graduate Center', 'Polytechnic Station', 'Campus West Gate'],
    Riverfront: ['Marina Bay Walk', 'Pier 17 Promenade', 'Ferry Terminal West', 'Riverside Park North', 'Waterfront Plaza', 'Bayside Boulevard', 'Lighthouse Point', 'Harborview Terrace', 'Navy Yard Gate', 'Riverfront South', 'Anchorage Way'],
    'Harbor Gateway': ['South Ferry Hub', 'Battery Coastline', 'Governors Overlook', 'Harbor Island Pier', 'Ocean Terminal', 'Coast Guard Walk', 'Seaport Central', 'Pelican Bay', 'Shipyard East', 'Maritime Museum', 'Wharf 9'],
    'Airport East': ['Terminal 1 International', 'Terminal 2 Domestic', 'Terminal 3 Express', 'Airport Central Station', 'Air Cargo Complex', 'Runway Boulevard', 'Skyline Skybridge', 'Airport Hotel Shuttle', 'Long Term Parking Hub', 'Car Rental Center', 'Flight Ops Base'],
    'Financial Center': ['Wall Street Metro', 'Stock Exchange Concourse', 'Trinity Place', 'World Trade Memorial', 'Fulton Interchange', 'Broad Street Station', 'Barclays Square', 'Treasury Plaza', 'Commodity Exchange', 'Goldman Way', 'Bankers Row'],
    'Arts & Culture': ['Opera House Plaza', 'Symphony Hall', 'Modern Art Pavilion', 'Theater District 42nd', 'Broadway Lights', 'Jazz Corner North', 'Gallery Row', 'Film Center West', 'Sculpture Garden', 'Design District Station', 'Costume Institute'],
  };

  const allAmenities = ['Wifi', 'Elevator', 'Restroom', 'Ticket Kiosk', 'Shelter', 'Bicycle Rack', 'Real-Time Displays', 'USB Charging', 'Tactile Paving'];
  const crowdLevels: CrowdLevel[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

  const stops: StopDoc[] = [];
  let stopCounter = 1;

  for (const zone of zones) {
    const names = stopNamesByZone[zone.name] || [];
    names.forEach((name, idx) => {
      const stopId = `STP-${String(stopCounter).padStart(3, '0')}`;
      const lng = Number((CENTER_LNG + zone.offsetLng + (idx % 4) * 0.007 - 0.01).toFixed(6));
      const lat = Number((CENTER_LAT + zone.offsetLat + Math.floor(idx / 4) * 0.006 - 0.008).toFixed(6));
      const crowd = crowdLevels[stopCounter % 4];
      const amenities = allAmenities.filter((_, aIdx) => (stopCounter + aIdx) % 3 !== 0);

      stops.push({
        stopId,
        name,
        code: `MC-${stopCounter}`,
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        zone: zone.name,
        amenities,
        accessible: stopCounter % 6 !== 0, // >80% accessible
        connectingRoutes: [], // populated later
        currentCrowdLevel: crowd,
        currentDelaySeconds: (stopCounter % 5) * 60,
        passengerFlowPerHour: 350 + (stopCounter * 45) % 1800,
        updatedAt: new Date(),
      });
      stopCounter++;
    });
  }

  await db.collection('stops').insertMany(stops);
  console.log(`[Seed] Seeded ${stops.length} GeoJSON stops with 2dsphere coordinates.`);

  // 4. Generate 28 Realistic Transit Routes
  // 8 Metro lines, 8 Express bus routes, 6 Light rail routes, 6 City bus routes
  interface RouteTemplate {
    routeId: string;
    name: string;
    shortName: string;
    type: RouteType;
    description: string;
    color: string;
    zoneStops: number[]; // indices in stops array
    baseMinutes: number;
    intervalMinutes: number;
    tags: string[];
    reliability: number;
  }

  const routeTemplates: RouteTemplate[] = [
    // METRO
    {
      routeId: 'M1',
      name: 'Metro Blue Line — Downtown to Uptown Express',
      shortName: 'M1',
      type: 'METRO',
      description: 'High-speed rapid transit connecting Civic Center through Times Plaza and Central Park to Uptown.',
      color: '#2563EB',
      zoneStops: [0, 1, 2, 11, 12, 13, 22, 23, 24, 25],
      baseMinutes: 24,
      intervalMinutes: 5,
      tags: ['rapid', 'high-frequency', 'downtown', 'uptown', 'wheelchair-accessible', 'wifi-onboard'],
      reliability: 94,
    },
    {
      routeId: 'M2',
      name: 'Metro Red Line — Tech District to Harbor Link',
      shortName: 'M2',
      type: 'METRO',
      description: 'Major arterial subway connecting the Tech District through Financial Center to South Ferry.',
      color: '#DC2626',
      zoneStops: [33, 34, 35, 36, 88, 89, 90, 66, 67, 68],
      baseMinutes: 28,
      intervalMinutes: 6,
      tags: ['tech-corridor', 'financial-district', 'ferry-connection', 'crowded-peak', 'direct'],
      reliability: 91,
    },
    {
      routeId: 'M3',
      name: 'Metro Green Line — University to Riverfront Crosslink',
      shortName: 'M3',
      type: 'METRO',
      description: 'Quiet, modern electric subway connecting University Hub with Riverfront Promenade and Downtown.',
      color: '#059669',
      zoneStops: [44, 45, 46, 55, 56, 57, 3, 4, 5],
      baseMinutes: 22,
      intervalMinutes: 7,
      tags: ['quiet', 'student-discount', 'scenic-riverfront', 'low-walking', 'reliable'],
      reliability: 96,
    },
    {
      routeId: 'M4',
      name: 'Metro Silver Line — Airport Intercity Express',
      shortName: 'M4',
      type: 'METRO',
      description: 'Dedicated luggage-friendly express subway from Grand Central Terminal straight to Airport East terminals.',
      color: '#7C3AED',
      zoneStops: [0, 14, 15, 37, 77, 78, 79, 80],
      baseMinutes: 32,
      intervalMinutes: 10,
      tags: ['airport-direct', 'luggage-racks', 'express', 'air-conditioned', 'minimal-stops'],
      reliability: 98,
    },
    {
      routeId: 'M5',
      name: 'Metro Orange Line — Arts Concourse to West River',
      shortName: 'M5',
      type: 'METRO',
      description: 'Vibrant cultural corridor servicing the Broadway Theater district, Symphony Hall, and Marina Bay.',
      color: '#EA580C',
      zoneStops: [99, 100, 101, 102, 16, 17, 58, 59],
      baseMinutes: 20,
      intervalMinutes: 8,
      tags: ['theater-district', 'arts-corridor', 'night-service', 'weekend-frequency'],
      reliability: 89,
    },
    {
      routeId: 'M6',
      name: 'Metro Gold Line — Financial Loop',
      shortName: 'M6',
      type: 'METRO',
      description: 'High-frequency underground loop circling Wall Street, World Trade, and Civic Center.',
      color: '#D97706',
      zoneStops: [88, 89, 91, 92, 93, 2, 7, 8],
      baseMinutes: 16,
      intervalMinutes: 4,
      tags: ['commuter-core', 'frequent', 'short-hops', 'high-capacity'],
      reliability: 92,
    },
    {
      routeId: 'M7',
      name: 'Metro Purple Line — Uptown Heights to Tech Campus',
      shortName: 'M7',
      type: 'METRO',
      description: 'Cross-town underground metro bypassing downtown traffic for direct academic-to-tech commute.',
      color: '#9333EA',
      zoneStops: [26, 27, 28, 47, 48, 38, 39, 40],
      baseMinutes: 26,
      intervalMinutes: 8,
      tags: ['cross-town', 'campus-commute', 'quiet-cars', 'less-walking'],
      reliability: 93,
    },
    {
      routeId: 'M8',
      name: 'Metro Turquoise Line — Harbor to Uptown Coastway',
      shortName: 'M8',
      type: 'METRO',
      description: 'Scenic shoreline deep underground line linking Battery Coastline, Marina Bay, and Lincoln Promenade.',
      color: '#0D9488',
      zoneStops: [69, 70, 71, 60, 61, 18, 19, 29, 30],
      baseMinutes: 30,
      intervalMinutes: 9,
      tags: ['coastal', 'scenic', 'spacious', 'modern-fleet'],
      reliability: 95,
    },

    // RAPID & EXPRESS BUS
    {
      routeId: 'X40',
      name: 'Rapid Express X40 — Airport SuperShuttle',
      shortName: 'X40',
      type: 'EXPRESS',
      description: 'Point-to-point freeway bus connector running in dedicated transit lanes between Midtown and Airport.',
      color: '#0284C7',
      zoneStops: [12, 13, 80, 81, 82],
      baseMinutes: 25,
      intervalMinutes: 12,
      tags: ['express', 'dedicated-busway', 'airport-link', 'fewer-transfers'],
      reliability: 90,
    },
    {
      routeId: 'X41',
      name: 'Rapid Express X41 — Silicon Expressway',
      shortName: 'X41',
      type: 'EXPRESS',
      description: 'Direct commuter express from Grand Central to Tech District Innovation Plaza.',
      color: '#4F46E5',
      zoneStops: [0, 15, 33, 34, 37],
      baseMinutes: 18,
      intervalMinutes: 10,
      tags: ['express-lane', 'tech-commute', 'power-outlets', 'fast-travel'],
      reliability: 92,
    },
    {
      routeId: 'X42',
      name: 'Rapid Express X42 — University Direct',
      shortName: 'X42',
      type: 'EXPRESS',
      description: 'Direct limited-stop express service connecting Midtown North with Student Union Central.',
      color: '#16A34A',
      zoneStops: [17, 18, 44, 46, 49],
      baseMinutes: 19,
      intervalMinutes: 12,
      tags: ['student-express', 'direct', 'fewer-transfers', 'affordable'],
      reliability: 88,
    },
    {
      routeId: 'X43',
      name: 'Rapid Express X43 — Riverfront FastTrack',
      shortName: 'X43',
      type: 'EXPRESS',
      description: 'Bypasses midtown surface streets to move commuters swiftly between South Ferry and Pier 17.',
      color: '#0891B2',
      zoneStops: [66, 67, 55, 57, 59],
      baseMinutes: 15,
      intervalMinutes: 10,
      tags: ['scenic-bypass', 'low-crowds', 'fast', 'waterfront'],
      reliability: 93,
    },
    {
      routeId: 'X44',
      name: 'Rapid Express X44 — Uptown Executive Shuttle',
      shortName: 'X44',
      type: 'EXPRESS',
      description: 'Executive quiet shuttle from Museum Mile to Wall Street Financial District.',
      color: '#475569',
      zoneStops: [25, 26, 88, 90, 94],
      baseMinutes: 27,
      intervalMinutes: 15,
      tags: ['quiet', 'executive', 'guaranteed-seating', 'low-walking', 'reliable'],
      reliability: 97,
    },
    {
      routeId: 'X45',
      name: 'Rapid Express X45 — Harbor to Airport Flyer',
      shortName: 'X45',
      type: 'EXPRESS',
      description: 'Southern beltway express bus bridging Seaport Central with Airport East terminals.',
      color: '#C026D3',
      zoneStops: [72, 73, 79, 81, 83],
      baseMinutes: 34,
      intervalMinutes: 20,
      tags: ['cross-city', 'airport-access', 'freeway-route'],
      reliability: 87,
    },
    {
      routeId: 'X46',
      name: 'Rapid Express X46 — Arts Night Express',
      shortName: 'X46',
      type: 'EXPRESS',
      description: 'Late-night premium rapid connector between Theater District and Upper West residences.',
      color: '#E11D48',
      zoneStops: [100, 102, 22, 24, 27],
      baseMinutes: 17,
      intervalMinutes: 15,
      tags: ['night-owl', 'theater-express', 'safe-transit', 'spacious'],
      reliability: 95,
    },
    {
      routeId: 'X47',
      name: 'Rapid Express X47 — Tech to University Connector',
      shortName: 'X47',
      type: 'EXPRESS',
      description: 'Joint shuttle connecting AI Research Lab, Founders Circle, and Polytechnic Station.',
      color: '#6366F1',
      zoneStops: [41, 42, 43, 52, 53, 54],
      baseMinutes: 16,
      intervalMinutes: 12,
      tags: ['stem-link', 'quiet-study', 'free-wifi', 'low-crowds'],
      reliability: 94,
    },

    // LIGHT RAIL
    {
      routeId: 'L1',
      name: 'Light Rail L1 — Riverfront Pier Promenade',
      shortName: 'L1',
      type: 'LIGHT_RAIL',
      description: 'Zero-emission scenic modern tram traveling along the pedestrian promenade from Marina Bay to Seaport.',
      color: '#14B8A6',
      zoneStops: [55, 56, 58, 60, 66, 68, 70],
      baseMinutes: 22,
      intervalMinutes: 8,
      tags: ['tram', 'scenic', 'wheelchair-accessible', 'low-noise', 'bike-friendly', 'less-walking'],
      reliability: 97,
    },
    {
      routeId: 'L2',
      name: 'Light Rail L2 — Midtown Concourse Tram',
      shortName: 'L2',
      type: 'LIGHT_RAIL',
      description: 'Street-level tram connecting Times Plaza, Herald Center, Bryant Terrace, and Grand Central.',
      color: '#F59E0B',
      zoneStops: [11, 12, 13, 14, 0, 1],
      baseMinutes: 14,
      intervalMinutes: 6,
      tags: ['street-level', 'easy-board', 'shopping-route', 'step-free'],
      reliability: 86,
    },
    {
      routeId: 'L3',
      name: 'Light Rail L3 — University Campus Circulator',
      shortName: 'L3',
      type: 'LIGHT_RAIL',
      description: 'Eco-tram circulating through all university campus quadrangles, dormitories, and library hubs.',
      color: '#10B981',
      zoneStops: [44, 45, 47, 48, 49, 50, 51],
      baseMinutes: 15,
      intervalMinutes: 5,
      tags: ['campus-circulator', 'step-free', 'zero-emission', 'high-frequency'],
      reliability: 98,
    },
    {
      routeId: 'L4',
      name: 'Light Rail L4 — Tech Boulevard Tramway',
      shortName: 'L4',
      type: 'LIGHT_RAIL',
      description: 'Modern glass-roofed tram linking Innovation Plaza, Robotics Campus, and Quantum Parkway.',
      color: '#3B82F6',
      zoneStops: [33, 35, 36, 38, 40, 42],
      baseMinutes: 16,
      intervalMinutes: 7,
      tags: ['tech-tram', 'modern', 'usb-charging', 'accessible'],
      reliability: 93,
    },
    {
      routeId: 'L5',
      name: 'Light Rail L5 — Cultural Arts Loop',
      shortName: 'L5',
      type: 'LIGHT_RAIL',
      description: 'Heritage streetcar running through Opera House, Modern Art Pavilion, and Design District.',
      color: '#EC4899',
      zoneStops: [99, 101, 103, 105, 107, 108],
      baseMinutes: 18,
      intervalMinutes: 10,
      tags: ['arts-tram', 'cultural', 'leisure', 'accessible'],
      reliability: 91,
    },
    {
      routeId: 'L6',
      name: 'Light Rail L6 — Airport Terminals Inter-Rail',
      shortName: 'L6',
      type: 'LIGHT_RAIL',
      description: 'Free automatic people mover connecting terminals, car rentals, and long-term parking.',
      color: '#8B5CF6',
      zoneStops: [77, 78, 79, 82, 84, 85, 86],
      baseMinutes: 12,
      intervalMinutes: 4,
      tags: ['terminal-shuttle', 'free-transfer', 'luggage-friendly', '24-7'],
      reliability: 99,
    },

    // CITY BUS
    {
      routeId: 'B10',
      name: 'City Bus B10 — Broadway Crosstown',
      shortName: 'B10',
      type: 'BUS',
      description: 'Essential local bus connecting Times Plaza to Broadway Lights, Civic Center, and Battery.',
      color: '#84CC16',
      zoneStops: [11, 103, 104, 1, 6, 67],
      baseMinutes: 25,
      intervalMinutes: 10,
      tags: ['local-bus', 'frequent-stops', 'broadway', 'city-pulse'],
      reliability: 82,
    },
    {
      routeId: 'B11',
      name: 'City Bus B11 — Upper West & Museum Link',
      shortName: 'B11',
      type: 'BUS',
      description: 'Neighborhood-friendly accessible bus serving Central Park South, Museum Mile, and Lincoln Square.',
      color: '#10B981',
      zoneStops: [22, 23, 25, 27, 28],
      baseMinutes: 20,
      intervalMinutes: 12,
      tags: ['neighborhood', 'parks', 'quiet', 'accessible', 'low-walking'],
      reliability: 90,
    },
    {
      routeId: 'B12',
      name: 'City Bus B12 — Harbor Shoreline Local',
      shortName: 'B12',
      type: 'BUS',
      description: 'Leisurely coastal bus connecting South Ferry, Battery, Seaport Central, and Shipyard East.',
      color: '#06B6D4',
      zoneStops: [66, 67, 70, 72, 74, 75],
      baseMinutes: 24,
      intervalMinutes: 15,
      tags: ['scenic-coast', 'spacious', 'less-crowds', 'relaxed'],
      reliability: 91,
    },
    {
      routeId: 'B13',
      name: 'City Bus B13 — Financial District Circulator',
      shortName: 'B13',
      type: 'BUS',
      description: 'Micro-transit electric mini-bus navigating narrow streets between Trinity Place, Wall St, and Fulton.',
      color: '#F97316',
      zoneStops: [88, 89, 90, 92, 95, 96],
      baseMinutes: 15,
      intervalMinutes: 8,
      tags: ['electric-minibus', 'dense-urban', 'short-hops'],
      reliability: 85,
    },
    {
      routeId: 'B14',
      name: 'City Bus B14 — East River Connector',
      shortName: 'B14',
      type: 'BUS',
      description: 'Connects Riverfront South through Heritage Park to Market Square and Civic Center.',
      color: '#3B82F6',
      zoneStops: [63, 64, 9, 3, 2, 1],
      baseMinutes: 21,
      intervalMinutes: 12,
      tags: ['residential-connection', 'less-walking', 'wheelchair-accessible'],
      reliability: 88,
    },
    {
      routeId: 'B15',
      name: 'City Bus B15 — Uptown Heights Hill Climber',
      shortName: 'B15',
      type: 'BUS',
      description: 'High-torque hybrid electric bus serving steep residential streets up to Morningside and Hudson Heights.',
      color: '#A855F7',
      zoneStops: [28, 29, 31, 32, 45, 46],
      baseMinutes: 22,
      intervalMinutes: 14,
      tags: ['hill-route', 'residential', 'quiet', 'low-crowds'],
      reliability: 89,
    },
  ];

  const routes: RouteDoc[] = [];

  for (const tpl of routeTemplates) {
    // Collect stops for this route
    const routeStops: any[] = [];
    const coordinates: [number, number][] = [];
    let accumDistance = 0;

    tpl.zoneStops.forEach((stopIndex, seq) => {
      const stop = stops[stopIndex % stops.length];
      coordinates.push(stop.location.coordinates);

      if (seq > 0) {
        const prev = stops[tpl.zoneStops[seq - 1] % stops.length];
        const dist = Math.round(
          Math.sqrt(
            Math.pow(stop.location.coordinates[0] - prev.location.coordinates[0], 2) +
            Math.pow(stop.location.coordinates[1] - prev.location.coordinates[1], 2)
          ) * 111000
        );
        accumDistance += Math.max(dist, 400);
      }

      routeStops.push({
        stopId: stop.stopId,
        sequence: seq + 1,
        stopName: stop.name,
        location: stop.location,
        distanceFromStartMeters: accumDistance,
        typicalTransitTimeMinutes: Math.round((accumDistance / 1000) * 2.5) + 2,
      });

      // Update stop connectingRoutes array
      if (!stop.connectingRoutes.includes(tpl.routeId)) {
        stop.connectingRoutes.push(tpl.routeId);
      }
    });

    const statusOptions: RouteStatus[] = ['ON_TIME', 'ON_TIME', 'ON_TIME', 'DELAYED'];
    const currentStatus = statusOptions[tpl.zoneStops.length % 4];
    const currentDelaySeconds = currentStatus === 'DELAYED' ? 360 : 0;
    const crowdIndex = (tpl.zoneStops.length + tpl.baseMinutes) % 4;

    // Vector embedding text payload: combining name, description, tags, crowd characteristics, and mobility features
    const embeddingText = `${tpl.name}. ${tpl.description}. Modes: ${tpl.type}. Tags: ${tpl.tags.join(', ')}. Reliability: ${tpl.reliability}%. Transit time: ${tpl.baseMinutes} mins.`;
    const embedding = generateEmbedding(embeddingText);

    routes.push({
      routeId: tpl.routeId,
      name: tpl.name,
      shortName: tpl.shortName,
      type: tpl.type,
      description: tpl.description,
      color: tpl.color,
      stops: routeStops,
      geometry: {
        type: 'LineString',
        coordinates,
      },
      totalDistanceMeters: accumDistance,
      baseTravelMinutes: tpl.baseMinutes,
      scheduleIntervalMinutes: tpl.intervalMinutes,
      currentStatus,
      currentDelaySeconds,
      averageCrowdLevel: crowdLevels[crowdIndex],
      reliabilityScore: tpl.reliability,
      accessible: true,
      tags: tpl.tags,
      embedding,
      updatedAt: new Date(),
    });
  }

  await db.collection('routes').insertMany(routes);
  console.log(`[Seed] Seeded ${routes.length} transit routes with GeoJSON LineStrings and 768-dim vector embeddings.`);

  // Update stops with connectingRoutes in DB
  for (const stop of stops) {
    if (stop.connectingRoutes.length > 0) {
      await db.collection('stops').updateOne(
        { stopId: stop.stopId },
        { $set: { connectingRoutes: stop.connectingRoutes } }
      );
    }
  }
  console.log('[Seed] Updated stop connecting route relationships in MongoDB.');

  // 5. Generate 70 Active Transit Vehicles
  const vehicles: VehicleDoc[] = [];
  let vehicleCounter = 1;

  for (const route of routes) {
    const numVehicles = route.type === 'METRO' ? 4 : route.type === 'EXPRESS' ? 3 : 2;
    for (let i = 0; i < numVehicles; i++) {
      const vehicleId = `VEH-${route.shortName}-${String(i + 1).padStart(2, '0')}`;
      const stopIdx = i % route.stops.length;
      const nextIdx = (i + 1) % route.stops.length;
      const currentStop = route.stops[stopIdx];
      const nextStop = route.stops[nextIdx];

      // Interpolate vehicle position between current and next stop
      const frac = 0.2 + (i * 0.3) % 0.6;
      const lng = Number((currentStop.location.coordinates[0] + (nextStop.location.coordinates[0] - currentStop.location.coordinates[0]) * frac).toFixed(6));
      const lat = Number((currentStop.location.coordinates[1] + (nextStop.location.coordinates[1] - currentStop.location.coordinates[1]) * frac).toFixed(6));

      const occupancy = 25 + ((vehicleCounter * 17) % 70);
      const crowdLevel: CrowdLevel = occupancy > 75 ? 'HIGH' : occupancy > 45 ? 'MODERATE' : 'LOW';
      const delaySeconds = (vehicleCounter % 7 === 0) ? 240 : 0;
      const status: VehicleStatus = delaySeconds > 180 ? 'DELAYED' : 'ACTIVE';

      vehicles.push({
        vehicleId,
        routeId: route.routeId,
        currentStopId: currentStop.stopId,
        nextStopId: nextStop.stopId,
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        heading: (i * 90) % 360,
        speedKmH: route.type === 'METRO' ? 55 : route.type === 'EXPRESS' ? 48 : 32,
        occupancy,
        crowdLevel,
        delaySeconds,
        status,
        updatedAt: new Date(),
      });
      vehicleCounter++;
    }
  }

  await db.collection('vehicles').insertMany(vehicles);
  console.log(`[Seed] Seeded ${vehicles.length} active transit vehicles with GeoJSON locations.`);

  // 6. Generate Realistic Time-Series Transit Telemetry (5,000+ data points across past 48 hours)
  console.log('[Seed] Generating 5,000+ Time-Series telemetry documents for transitTelemetry collection...');
  const telemetryDocs: TransitTelemetryDoc[] = [];
  const now = Date.now();
  const timeStepMinutes = 15; // 15-min intervals over past 48 hours
  const totalSteps = (48 * 60) / timeStepMinutes; // 192 intervals

  // Sample across 25 vehicles to generate rich multi-hour time-series trends
  const sampledVehicles = vehicles.slice(0, 26);

  for (let step = 0; step < totalSteps; step++) {
    const timestamp = new Date(now - (totalSteps - step) * timeStepMinutes * 60 * 1000);
    const hourOfDay = timestamp.getHours();
    const isPeakHour = (hourOfDay >= 7 && hourOfDay <= 9) || (hourOfDay >= 16 && hourOfDay <= 19);

    for (const veh of sampledVehicles) {
      // Base occupancy higher in peak hours
      const peakBoost = isPeakHour ? 35 : 5;
      const jitter = Math.sin(step * 0.2 + veh.speedKmH) * 15;
      const occupancy = Math.min(98, Math.max(10, Math.round(30 + peakBoost + jitter)));
      const crowdLevel: CrowdLevel = occupancy > 80 ? 'CRITICAL' : occupancy > 60 ? 'HIGH' : occupancy > 35 ? 'MODERATE' : 'LOW';

      // Delays cluster around peak hours and congested routes
      const delaySeconds = isPeakHour ? Math.max(0, Math.round((occupancy - 40) * 6)) : Math.max(0, Math.round(jitter > 5 ? 60 : 0));
      const speed = Math.max(15, Math.round(veh.speedKmH - (occupancy > 70 ? 12 : 0) + Math.cos(step) * 5));
      const status: VehicleStatus = delaySeconds > 240 ? 'DELAYED' : 'ACTIVE';

      telemetryDocs.push({
        timestamp,
        metadata: {
          vehicleId: veh.vehicleId,
          routeId: veh.routeId,
          stopId: veh.currentStopId,
        },
        delaySeconds,
        occupancy,
        crowdLevel,
        speed,
        status,
        location: veh.location,
      });
    }
  }

  // Insert in batches of 1,000 into Time-Series collection
  const batchSize = 1000;
  for (let i = 0; i < telemetryDocs.length; i += batchSize) {
    const batch = telemetryDocs.slice(i, i + batchSize);
    await db.collection('transitTelemetry').insertMany(batch);
  }
  console.log(`[Seed] Seeded ${telemetryDocs.length} Time-Series telemetry records across 48 hours.`);

  // 7. Seed Active & Historical Alerts
  const alerts: AlertDoc[] = [
    {
      alertId: 'ALT-101',
      title: 'Signaling Maintenance near Times Plaza',
      description: 'Minor speed restrictions in effect between Times Plaza and Herald Center. Expect 3-5 minute delays on M1 and L2.',
      severity: 'WARNING',
      affectedRoutes: ['M1', 'L2'],
      affectedStops: ['STP-012', 'STP-013'],
      active: true,
      createdAt: new Date(now - 3600 * 1000 * 2),
      updatedAt: new Date(),
    },
    {
      alertId: 'ALT-102',
      title: 'High Rider Volume — University Graduation',
      description: 'Expect heavy passenger volume and standing room only on M3 and X42 near Varsity Stadium.',
      severity: 'INFO',
      affectedRoutes: ['M3', 'X42', 'L3'],
      affectedStops: ['STP-044', 'STP-047', 'STP-050'],
      active: true,
      createdAt: new Date(now - 3600 * 1000 * 4),
      updatedAt: new Date(),
    },
    {
      alertId: 'ALT-103',
      title: 'Waterfront Gala Promenade Detour',
      description: 'Riverfront Promenade street closure. L1 operating with modified boarding at Pier 17.',
      severity: 'WARNING',
      affectedRoutes: ['L1'],
      affectedStops: ['STP-056'],
      active: true,
      createdAt: new Date(now - 3600 * 1000 * 6),
      updatedAt: new Date(),
    },
    {
      alertId: 'ALT-104',
      title: 'Resolved: Track Inspection on M4 Silver Line',
      description: 'Routine overnight track inspection completed. Regular 5-minute headways restored to Airport terminals.',
      severity: 'INFO',
      affectedRoutes: ['M4'],
      affectedStops: ['STP-077', 'STP-078'],
      active: false, // Inactive alert (tests partial index filtering!)
      createdAt: new Date(now - 3600 * 1000 * 24),
      updatedAt: new Date(now - 3600 * 1000 * 18),
    },
  ];

  await db.collection('alerts').insertMany(alerts);
  console.log(`[Seed] Seeded ${alerts.length} system alerts (including active and resolved for partial index verification).`);

  // 8. Seed Sample Temporary Alerts (TTL index test)
  const temporaryAlerts = [
    {
      type: 'SURGE',
      message: 'Sudden platform crowd surge detected at Grand Central Terminal. Additional express car dispatched.',
      routeId: 'M1',
      expireAt: new Date(Date.now() + 1800 * 1000), // expires in 30 minutes
      createdAt: new Date(),
    },
    {
      type: 'WEATHER',
      message: 'Light rain reported along Riverfront corridor. Speeds adjusted for safety.',
      routeId: 'L1',
      expireAt: new Date(Date.now() + 3600 * 1000), // expires in 60 minutes
      createdAt: new Date(),
    },
  ];

  await db.collection('temporaryAlerts').insertMany(temporaryAlerts);
  console.log(`[Seed] Seeded ${temporaryAlerts.length} temporary alerts with TTL expiry.`);

  // 9. Seed Materialized Analytics Collection via MongoDB Aggregation ($merge)
  console.log('[Seed] Materializing initial route analytics using MongoDB aggregation $merge pipeline...');
  await db.collection('transitTelemetry').aggregate([
    {
      $group: {
        _id: '$metadata.routeId',
        totalTelemetryPoints: { $count: {} },
        avgDelaySeconds: { $avg: '$delaySeconds' },
        maxDelaySeconds: { $max: '$delaySeconds' },
        avgOccupancy: { $avg: '$occupancy' },
        highCrowdOccurrences: {
          $sum: { $cond: [{ $in: ['$crowdLevel', ['HIGH', 'CRITICAL']] }, 1, 0] },
        },
        lastUpdated: { $max: '$timestamp' },
      },
    },
    {
      $project: {
        _id: 0,
        routeId: '$_id',
        totalTelemetryPoints: 1,
        avgDelaySeconds: { $round: ['$avgDelaySeconds', 1] },
        maxDelaySeconds: 1,
        avgOccupancy: { $round: ['$avgOccupancy', 1] },
        highCrowdOccurrences: 1,
        crowdRatePercent: {
          $round: [{ $multiply: [{ $divide: ['$highCrowdOccurrences', '$totalTelemetryPoints'] }, 100] }, 1],
        },
        lastUpdated: 1,
      },
    },
    {
      $merge: {
        into: 'materializedRouteStats',
        on: 'routeId',
        whenMatched: 'replace',
        whenNotMatched: 'insert',
      },
    },
  ]).toArray();

  const matCount = await db.collection('materializedRouteStats').countDocuments();
  console.log(`[Seed] Materialized ${matCount} route summaries into materializedRouteStats collection.`);

  // 10. Seed Initial Saved Trips for Alex Commuter
  const alexUser = await db.collection('users').findOne({ email: 'commuter@transit.demo' });
  if (alexUser) {
    const savedTrips = [
      {
        tripId: 'TRP-DEMO-001',
        userId: alexUser._id.toString(),
        origin: {
          name: 'Grand Central Terminal',
          location: stops[0].location,
        },
        destination: {
          name: 'Central Park South',
          location: stops[22].location,
        },
        routeId: 'M1',
        routeName: 'Metro Blue Line — Downtown to Uptown Express',
        transitType: 'METRO',
        travelTimeMinutes: 24,
        walkingDistanceMeters: 280,
        transfers: 0,
        crowdLevel: 'LOW',
        score: 95,
        savedPreferences: alexUser.preferences,
        createdAt: new Date(now - 86400 * 1000 * 2),
      },
      {
        tripId: 'TRP-DEMO-002',
        userId: alexUser._id.toString(),
        origin: {
          name: 'Silicon Boulevard',
          location: stops[33].location,
        },
        destination: {
          name: 'Marina Bay Walk',
          location: stops[55].location,
        },
        routeId: 'L1',
        routeName: 'Light Rail L1 — Riverfront Pier Promenade',
        transitType: 'LIGHT_RAIL',
        travelTimeMinutes: 22,
        walkingDistanceMeters: 310,
        transfers: 0,
        crowdLevel: 'LOW',
        score: 92,
        savedPreferences: alexUser.preferences,
        createdAt: new Date(now - 86400 * 1000 * 5),
      },
    ];
    await db.collection('savedTrips').insertMany(savedTrips);
    console.log(`[Seed] Seeded ${savedTrips.length} saved trips for demo commuter.`);
  }

  console.log('[Seed] Database seeding completed successfully!');
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await closeDatabaseConnection();
      console.log('[Seed] All done! You can now run the app or execute tests.');
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed] Fatal seeding error:', err);
      await closeDatabaseConnection();
      process.exit(1);
    });
}
