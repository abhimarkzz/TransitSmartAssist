import { Request, Response } from 'express';
import { getDb } from '../config/db';
import { generateQueryEmbedding } from '../services/geminiService';

/**
 * MongoDB Atlas Search: Full-Text Compound Search with Fuzzy Matching and Autocomplete
 * Uses actual MongoDB $search stage when running on Atlas cluster with Search Index,
 * with graceful transparent fallback to MongoDB text/regex index on local test clusters.
 */
export async function searchRoutesAndStops(req: Request, res: Response): Promise<void> {
  const query = (req.query.q as string || '').trim();
  const typeFilter = req.query.type as string;
  const accessibleOnly = req.query.accessible === 'true';

  if (!query) {
    res.status(400).json({ success: false, error: 'Query string "q" is required.' });
    return;
  }

  const startTime = Date.now();
  const db = getDb();

  // 1. Definition of the genuine MongoDB Atlas Search ($search) Pipeline
  const atlasSearchPipeline: any[] = [
    {
      $search: {
        index: 'default',
        compound: {
          should: [
            {
              autocomplete: {
                query,
                path: 'name',
                fuzzy: { maxEdits: 1, prefixLength: 1 },
              },
            },
            {
              text: {
                query,
                path: ['description', 'tags'],
                fuzzy: { maxEdits: 1 },
              },
            },
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        routeId: 1,
        name: 1,
        shortName: 1,
        type: 1,
        description: 1,
        color: 1,
        baseTravelMinutes: 1,
        averageCrowdLevel: 1,
        reliabilityScore: 1,
        tags: 1,
        accessible: 1,
        score: { $meta: 'searchScore' },
      },
    },
    { $limit: 8 },
  ];

  let routeResults: any[] = [];
  let usedAtlasSearch = false;

  try {
    // Attempt native MongoDB Atlas Search
    routeResults = await db.collection('routes').aggregate(atlasSearchPipeline).toArray();
    usedAtlasSearch = true;
  } catch (atlasErr: any) {
    // Local MongoDB or Atlas tier without search index yet:
    // Execute MongoDB Text Index / Regex search fallback
    const regex = new RegExp(query, 'i');
    const filter: any = {
      $or: [{ name: regex }, { description: regex }, { tags: { $in: [regex] } }],
    };
    if (typeFilter) filter.type = typeFilter;
    if (accessibleOnly) filter.accessible = true;

    routeResults = await db
      .collection('routes')
      .find(filter, {
        projection: {
          _id: 1,
          routeId: 1,
          name: 1,
          shortName: 1,
          type: 1,
          description: 1,
          color: 1,
          baseTravelMinutes: 1,
          averageCrowdLevel: 1,
          reliabilityScore: 1,
          tags: 1,
          accessible: 1,
        },
      })
      .limit(8)
      .toArray();
  }

  // Also search stops using MongoDB text/regex
  const stopRegex = new RegExp(query, 'i');
  const stopResults = await db
    .collection('stops')
    .find({
      $or: [{ name: stopRegex }, { amenities: { $in: [stopRegex] } }, { zone: stopRegex }],
    })
    .project({
      _id: 1,
      stopId: 1,
      name: 1,
      zone: 1,
      location: 1,
      amenities: 1,
      accessible: 1,
      connectingRoutes: 1,
      currentCrowdLevel: 1,
    })
    .limit(6)
    .toArray();

  const executionTimeMs = Date.now() - startTime;

  res.json({
    success: true,
    query,
    usedAtlasSearch,
    atlasSearchPipelineDefinition: atlasSearchPipeline[0],
    executionTimeMs,
    routes: routeResults,
    stops: stopResults,
  });
}

/**
 * MongoDB Vector Search ($vectorSearch):
 * Converts natural-language commuter intent to embeddings and searches
 * high-dimensional route vectors stored directly in MongoDB.
 */
export async function semanticVectorSearch(req: Request, res: Response): Promise<void> {
  const query = (req.body.query as string || req.query.q as string || '').trim();

  if (!query) {
    res.status(400).json({
      success: false,
      error: 'Search query string is required (e.g. "quiet route with less walking and fewer transfers").',
    });
    return;
  }

  const startTime = Date.now();
  const db = getDb();

  // Step 1: Generate 768-dimensional query vector via Gemini text-embedding-004
  const queryVector = await generateQueryEmbedding(query);

  // Step 2: Define the exact MongoDB $vectorSearch aggregation pipeline
  const vectorSearchPipeline = [
    {
      $vectorSearch: {
        index: 'vector_index',
        path: 'embedding',
        queryVector,
        numCandidates: 40,
        limit: 5,
      },
    },
    {
      $project: {
        _id: 1,
        routeId: 1,
        name: 1,
        shortName: 1,
        type: 1,
        description: 1,
        color: 1,
        baseTravelMinutes: 1,
        averageCrowdLevel: 1,
        reliabilityScore: 1,
        tags: 1,
        accessible: 1,
        vectorSearchScore: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  let results: any[] = [];
  let usedNativeVectorSearch = false;

  try {
    // Attempt native Atlas Vector Search ($vectorSearch)
    results = await db.collection('routes').aggregate(vectorSearchPipeline).toArray();
    usedNativeVectorSearch = true;
  } catch (vectorErr: any) {
    // If $vectorSearch index is not yet built on Atlas or running on local MongoDB:
    // Execute mathematical cosine dot-product across stored embeddings in MongoDB documents
    const allRoutes = await db
      .collection('routes')
      .find({ embedding: { $exists: true } })
      .project({
        _id: 1,
        routeId: 1,
        name: 1,
        shortName: 1,
        type: 1,
        description: 1,
        color: 1,
        baseTravelMinutes: 1,
        averageCrowdLevel: 1,
        reliabilityScore: 1,
        tags: 1,
        accessible: 1,
        embedding: 1,
      })
      .toArray();

    // Cosine similarity computation
    const scored = allRoutes.map((route: any) => {
      let dotProduct = 0;
      const emb = route.embedding || [];
      const len = Math.min(queryVector.length, emb.length);
      for (let i = 0; i < len; i++) {
        dotProduct += queryVector[i] * emb[i];
      }
      return {
        ...route,
        embedding: undefined, // remove raw vector from output
        vectorSearchScore: Number(((dotProduct + 1) / 2).toFixed(4)), // Normalize to 0-1
      };
    });

    scored.sort((a, b) => b.vectorSearchScore - a.vectorSearchScore);
    results = scored.slice(0, 5);
  }

  const executionTimeMs = Date.now() - startTime;

  res.json({
    success: true,
    query,
    usedNativeVectorSearch,
    vectorDimensions: queryVector.length,
    vectorSearchPipelineStage: vectorSearchPipeline[0],
    executionTimeMs,
    count: results.length,
    routes: results,
  });
}
