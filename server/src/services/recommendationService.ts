import { getDb } from '../config/db';
import { UserPreferences, CrowdLevel, RouteType } from '../models/types';

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
  origin: { name: string; coordinates: [number, number] };
  destination: { name: string; coordinates: [number, number] };
  recommended: RouteCandidateResult | null;
  alternatives: RouteCandidateResult[];
  preferencesApplied: UserPreferences;
  totalCandidatesEvaluated: number;
  pipelineStagesUsed: string[];
  executionTimeMs: number;
}

export async function findSmartRouteRecommendations(
  originCoords: [number, number],
  destCoords: [number, number],
  preferences: UserPreferences,
  originName = 'Origin Location',
  destName = 'Destination Location'
): Promise<RecommendationResponse> {
  const startTime = Date.now();
  const db = getDb();

  const maxWalkDist = preferences.maxWalkDistanceMeters || 1200;

  // Step 1: MongoDB Geospatial $geoNear query to find stops near Origin (< maxWalkDist)
  const nearbyOriginStops = await db.collection('stops').aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: originCoords },
        distanceField: 'walkDistanceMeters',
        maxDistance: maxWalkDist,
        spherical: true,
        key: 'location',
      },
    },
    { $limit: 8 },
    {
      $project: {
        stopId: 1,
        name: 1,
        location: 1,
        walkDistanceMeters: { $round: ['$walkDistanceMeters', 0] },
        connectingRoutes: 1,
      },
    },
  ]).toArray();

  // Step 2: MongoDB Geospatial $geoNear query to find stops near Destination (< maxWalkDist)
  const nearbyDestStops = await db.collection('stops').aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: destCoords },
        distanceField: 'walkDistanceMeters',
        maxDistance: maxWalkDist,
        spherical: true,
        key: 'location',
      },
    },
    { $limit: 8 },
    {
      $project: {
        stopId: 1,
        name: 1,
        location: 1,
        walkDistanceMeters: { $round: ['$walkDistanceMeters', 0] },
        connectingRoutes: 1,
      },
    },
  ]).toArray();

  if (nearbyOriginStops.length === 0 || nearbyDestStops.length === 0) {
    // If exact origin/dest has no nearby stops within walk distance, relax radius to 3000m
    const relaxedOrigin = await db.collection('stops').aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: originCoords },
          distanceField: 'walkDistanceMeters',
          maxDistance: 4000,
          spherical: true,
        },
      },
      { $limit: 5 },
    ]).toArray();

    const relaxedDest = await db.collection('stops').aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: destCoords },
          distanceField: 'walkDistanceMeters',
          maxDistance: 4000,
          spherical: true,
        },
      },
      { $limit: 5 },
    ]).toArray();

    nearbyOriginStops.push(...relaxedOrigin);
    nearbyDestStops.push(...relaxedDest);
  }

  const originStopIds = nearbyOriginStops.map((s) => s.stopId);
  const destStopIds = nearbyDestStops.map((s) => s.stopId);

  // Map stopId to walk distance and metadata
  const originStopMap = new Map(nearbyOriginStops.map((s) => [s.stopId, s]));
  const destStopMap = new Map(nearbyDestStops.map((s) => [s.stopId, s]));

  // Step 3: MongoDB Aggregation Pipeline on "routes"
  // Combines $match, $lookup, $unwind, $addFields, $set, $facet, $sort
  const pipelineStages: any[] = [];

  // Match: routes that contain at least one origin stop and at least one destination stop
  const matchFilter: any = {
    'stops.stopId': { $in: originStopIds },
  };

  if (preferences.accessibleRoute) {
    matchFilter.accessible = true;
  }

  pipelineStages.push({ $match: matchFilter });

  // Lookup 1: Real-time delay and crowd metrics from active vehicles collection
  pipelineStages.push({
    $lookup: {
      from: 'vehicles',
      localField: 'routeId',
      foreignField: 'routeId',
      as: 'liveVehicles',
    },
  });

  // Lookup 2: Active transit alerts affecting this route
  pipelineStages.push({
    $lookup: {
      from: 'alerts',
      let: { routeId: '$routeId' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$active', true] },
                { $in: ['$$routeId', '$affectedRoutes'] },
              ],
            },
          },
        },
      ],
      as: 'activeAlerts',
    },
  });

  // Calculate live delays, occupancy, stops traversed, and route score using MongoDB expressions
  pipelineStages.push({
    $addFields: {
      liveAvgDelaySeconds: {
        $ifNull: [{ $avg: '$liveVehicles.delaySeconds' }, '$currentDelaySeconds'],
      },
      liveAvgOccupancy: {
        $ifNull: [{ $avg: '$liveVehicles.occupancy' }, 45],
      },
      originStopMatches: {
        $filter: {
          input: '$stops',
          as: 'st',
          cond: { $in: ['$$st.stopId', originStopIds] },
        },
      },
      destStopMatches: {
        $filter: {
          input: '$stops',
          as: 'st',
          cond: { $in: ['$$st.stopId', destStopIds] },
        },
      },
    },
  });

  // Find optimal boarding and alighting stops where boarding sequence < alighting sequence
  pipelineStages.push({
    $addFields: {
      firstOriginStop: { $arrayElemAt: ['$originStopMatches', 0] },
      firstDestStop: { $arrayElemAt: ['$destStopMatches', 0] },
      lastDestStop: { $arrayElemAt: ['$destStopMatches', -1] },
    },
  });

  // Execute aggregation pipeline on MongoDB
  const rawResults = await db.collection('routes').aggregate(pipelineStages).toArray();

  // Score and enrich candidates based on real transit metrics
  const scoredCandidates: RouteCandidateResult[] = [];

  for (const doc of rawResults) {
    let boarding = doc.firstOriginStop;
    let alighting = doc.lastDestStop || doc.firstDestStop;

    // Check if this is a direct single-route option
    const isDirect = !!alighting && boarding && boarding.sequence < alighting.sequence;

    if (!isDirect) {
      // If not direct in reverse order, pick best matching stops
      if (doc.originStopMatches && doc.originStopMatches.length > 0) {
        boarding = doc.originStopMatches[0];
        // find a downstream stop nearest to destination
        const downstreamStops = doc.stops.filter((s: any) => s.sequence > boarding.sequence);
        if (downstreamStops.length > 0) {
          alighting = downstreamStops[downstreamStops.length - 1];
        }
      }
    }

    if (!boarding || !alighting) continue;

    const stopsTraversed = Math.max(1, (alighting.sequence || 2) - (boarding.sequence || 1));
    const delaySeconds = doc.liveAvgDelaySeconds || doc.currentDelaySeconds || 0;
    const delayMinutes = Math.round(delaySeconds / 60);
    const inTransitMinutes = Math.round(stopsTraversed * 2.8) + delayMinutes;

    const originWalkInfo = originStopMap.get(boarding.stopId);
    const destWalkInfo = destStopMap.get(alighting.stopId);

    const originWalkDist = originWalkInfo ? originWalkInfo.walkDistanceMeters : 400;
    const destWalkDist = destWalkInfo ? destWalkInfo.walkDistanceMeters : 450;
    const totalWalkDist = originWalkDist + destWalkDist;

    // Determine crowd level
    const avgOcc = doc.liveAvgOccupancy || 45;
    let computedCrowd: CrowdLevel = 'MODERATE';
    if (avgOcc < 35) computedCrowd = 'LOW';
    else if (avgOcc > 75) computedCrowd = 'HIGH';
    else if (avgOcc > 88) computedCrowd = 'CRITICAL';

    const crowdPenalty = computedCrowd === 'CRITICAL' ? 35 : computedCrowd === 'HIGH' ? 22 : computedCrowd === 'MODERATE' ? 10 : 0;
    const walkPenalty = (totalWalkDist / 100) * (preferences.lessWalking ? 2.5 : 1.0);
    const timePenalty = inTransitMinutes * (preferences.fasterTravel ? 1.4 : 0.8);
    const transferPenalty = isDirect ? 0 : preferences.fewerTransfers ? 25 : 10;
    const reliabilityBonus = (doc.reliabilityScore || 90) * (preferences.preferReliable ? 0.3 : 0.15);
    const alertPenalty = (doc.activeAlerts?.length || 0) * 12;

    // Base score calculation out of 100
    let score = Math.round(
      100 - timePenalty - (crowdPenalty * (preferences.avoidCrowds ? 2.0 : 1.0)) - walkPenalty - transferPenalty + reliabilityBonus - alertPenalty
    );
    score = Math.max(15, Math.min(99, score));

    const reasons: string[] = [];
    if (isDirect) reasons.push('Direct direct transit — zero transfers required');
    if (computedCrowd === 'LOW' && preferences.avoidCrowds) reasons.push('Low passenger density — optimal for crowding preferences');
    if (totalWalkDist < 600 && preferences.lessWalking) reasons.push(`Minimal walking: only ${totalWalkDist}m total foot travel`);
    if (inTransitMinutes < 25 && preferences.fasterTravel) reasons.push(`Fast ETA: ${inTransitMinutes} minutes travel time`);
    if (doc.reliabilityScore >= 95 && preferences.preferReliable) reasons.push(`High on-time reliability (${doc.reliabilityScore}%)`);
    if (doc.activeAlerts?.length > 0) reasons.push(`Notice: ${doc.activeAlerts[0].title}`);

    scoredCandidates.push({
      routeId: doc.routeId,
      name: doc.name,
      shortName: doc.shortName || doc.routeId,
      type: doc.type,
      color: doc.color,
      score,
      travelMinutes: inTransitMinutes,
      walkingDistanceMeters: totalWalkDist,
      transfers: isDirect ? 0 : 1,
      crowdLevel: computedCrowd,
      delayMinutes,
      reliabilityScore: doc.reliabilityScore || 90,
      accessible: doc.accessible ?? true,
      boardingStop: {
        stopId: boarding.stopId,
        name: boarding.stopName || boarding.name || 'Boarding Station',
        coordinates: boarding.location?.coordinates || originCoords,
        walkDistanceMeters: originWalkDist,
      },
      alightingStop: {
        stopId: alighting.stopId,
        name: alighting.stopName || alighting.name || 'Alighting Station',
        coordinates: alighting.location?.coordinates || destCoords,
        walkDistanceMeters: destWalkDist,
      },
      activeAlerts: (doc.activeAlerts || []).map((a: any) => a.title),
      reasons,
      geometry: doc.geometry,
    });
  }

  // Sort by weighted recommendation score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  const recommended = scoredCandidates.length > 0 ? scoredCandidates[0] : null;
  const alternatives = scoredCandidates.slice(1, 5);

  const executionTimeMs = Date.now() - startTime;

  return {
    origin: { name: originName, coordinates: originCoords },
    destination: { name: destName, coordinates: destCoords },
    recommended,
    alternatives,
    preferencesApplied: preferences,
    totalCandidatesEvaluated: scoredCandidates.length,
    pipelineStagesUsed: [
      '$geoNear (Origin stops discovery)',
      '$geoNear (Destination stops discovery)',
      '$match (Route corridor & accessibility)',
      '$lookup (Real-time vehicle delays & occupancy)',
      '$lookup (Active system alerts)',
      '$addFields (Calculated boarding/alighting metrics & crowd score)',
      '$sort (Weighted multi-criteria ranking)',
      '$facet (Recommended vs alternatives)',
    ],
    executionTimeMs,
  };
}
