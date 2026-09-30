import { Request, Response } from 'express';
import { findSmartRouteRecommendations } from '../services/recommendationService';
import { explainRouteRecommendation } from '../services/geminiService';
import { UserPreferences } from '../models/types';

export async function getRecommendations(req: Request, res: Response): Promise<void> {
  const { originCoords, destCoords, originName, destName, preferences } = req.body;

  if (!originCoords || !Array.isArray(originCoords) || originCoords.length !== 2 ||
      !destCoords || !Array.isArray(destCoords) || destCoords.length !== 2) {
    res.status(400).json({
      success: false,
      error: 'originCoords and destCoords must each be valid [lng, lat] numerical coordinate arrays.',
    });
    return;
  }

  const defaultPreferences: UserPreferences = {
    avoidCrowds: false,
    lessWalking: false,
    fewerTransfers: false,
    fasterTravel: true,
    preferReliable: true,
    accessibleRoute: false,
    maxWalkDistanceMeters: 1200,
    ...preferences,
  };

  try {
    const recommendation = await findSmartRouteRecommendations(
      originCoords as [number, number],
      destCoords as [number, number],
      defaultPreferences,
      originName || 'Origin Point',
      destName || 'Destination Point'
    );

    res.json({
      success: true,
      ...recommendation,
    });
  } catch (err: any) {
    console.error('[Recommendation] Pipeline error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to compute route recommendations: ' + err.message,
    });
  }
}

export async function explainRecommendation(req: Request, res: Response): Promise<void> {
  const { recommended, alternatives, preferences, originName, destName } = req.body;

  try {
    const aiResult = await explainRouteRecommendation(
      recommended,
      alternatives || [],
      preferences || {},
      originName || 'Departure Stop',
      destName || 'Arrival Stop'
    );

    res.json({
      success: true,
      ...aiResult,
    });
  } catch (err: any) {
    console.error('[Recommendation] AI explanation error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI route explanation: ' + err.message,
    });
  }
}
