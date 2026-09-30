import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import { RouteCandidateResult } from './recommendationService';
import { UserPreferences } from '../models/types';

let genAI: GoogleGenerativeAI | null = null;
if (config.geminiApiKey) {
  genAI = new GoogleGenerativeAI(config.geminiApiKey);
}

/**
 * Generate natural language reasoning explaining MongoDB route recommendations
 * Uses Gemini Flash (with graceful deterministic fallback if key is missing or offline)
 */
export async function explainRouteRecommendation(
  recommended: RouteCandidateResult | null,
  alternatives: RouteCandidateResult[],
  preferences: UserPreferences,
  originName: string,
  destinationName: string
): Promise<{ explanation: string; aiSource: 'GEMINI_FLASH' | 'DETERMINISTIC_REASONING' }> {
  if (!recommended) {
    return {
      explanation: 'No direct or viable transit candidates found for the chosen coordinates. Consider expanding your maximum walking radius.',
      aiSource: 'DETERMINISTIC_REASONING',
    };
  }

  // If Gemini API is configured, use Gemini Flash
  if (genAI && config.geminiApiKey) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `You are TransitAI, the intelligent reasoning engine for TransitSmartAssist.
Explain the transit recommendation to a commuter traveling from "${originName}" to "${destinationName}".

CRITICAL INSTRUCTIONS:
1. Base your answer strictly on the database query results provided below. DO NOT invent stations, delays, or routes.
2. Clearly explain why the Recommended Route was prioritized based on the commuter's preferences.
3. Compare it with the top alternative route, pointing out concrete trade-offs (e.g., travel time vs. crowding vs. walking distance).
4. Keep the response concise, friendly, and practical (2-3 paragraphs max).

Commuter Preferences:
- Avoid Crowds: ${preferences.avoidCrowds ? 'YES' : 'NO'}
- Less Walking: ${preferences.lessWalking ? 'YES' : 'NO'}
- Fewer Transfers: ${preferences.fewerTransfers ? 'YES' : 'NO'}
- Faster Travel: ${preferences.fasterTravel ? 'YES' : 'NO'}
- Prefer Reliable: ${preferences.preferReliable ? 'YES' : 'NO'}
- Accessible: ${preferences.accessibleRoute ? 'YES' : 'NO'}

Recommended Route from Database:
- Name: ${recommended.name} (${recommended.shortName})
- Type: ${recommended.type}
- Score: ${recommended.score}/100
- Total Travel Time: ${recommended.travelMinutes} mins (Live delay: ${recommended.delayMinutes} mins)
- Walking Distance: ${recommended.walkingDistanceMeters} meters
- Transfers: ${recommended.transfers}
- Crowd Level: ${recommended.crowdLevel}
- Reliability: ${recommended.reliabilityScore}%
- Boarding Stop: ${recommended.boardingStop.name}
- Alighting Stop: ${recommended.alightingStop.name}
- Active Alerts: ${recommended.activeAlerts.join(', ') || 'None'}

Alternative Options:
${alternatives
  .slice(0, 2)
  .map(
    (alt, i) =>
      `Option ${i + 1}: ${alt.name} | Time: ${alt.travelMinutes}m | Walk: ${alt.walkingDistanceMeters}m | Crowd: ${alt.crowdLevel} | Transfers: ${alt.transfers}`
  )
  .join('\n')}
`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return {
        explanation: text,
        aiSource: 'GEMINI_FLASH',
      };
    } catch (error: any) {
      console.warn('[Gemini] Fallback to deterministic reasoning:', error.message);
    }
  }

  // Graceful deterministic reasoning based on MongoDB metrics
  const recTime = recommended.travelMinutes;
  const recWalk = recommended.walkingDistanceMeters;
  const recCrowd = recommended.crowdLevel.toLowerCase();

  let explanation = `Based on real-time transit intelligence in MongoDB, **${recommended.name}** is your optimal commute option from ${originName} to ${destinationName}, earning a recommendation score of **${recommended.score}/100**.\n\n`;

  explanation += `**Why this route wins:**\n`;
  explanation += `• **Travel Time & Delay:** Estimated at ${recTime} minutes with ${recommended.delayMinutes > 0 ? `${recommended.delayMinutes}m live delay` : 'on-time operation'}.\n`;
  explanation += `• **Crowd Density:** Current occupancy is **${recCrowd}**, directly supporting your crowding preference.\n`;
  explanation += `• **Walking & Transfers:** Requires only ${recWalk}m of total walking with ${recommended.transfers === 0 ? 'zero transfers (direct boarding)' : `${recommended.transfers} transfer`} at ${recommended.boardingStop.name}.\n`;

  if (alternatives.length > 0) {
    const alt = alternatives[0];
    explanation += `\n**Alternative Comparison:**\n`;
    explanation += `• **${alt.name}** is available (ETA: ${alt.travelMinutes}m, Walk: ${alt.walkingDistanceMeters}m, Crowding: ${alt.crowdLevel.toLowerCase()}). `;
    if (alt.travelMinutes < recTime) {
      explanation += `While ${alt.shortName} is ${recTime - alt.travelMinutes} minutes faster, it has a higher crowd level (${alt.crowdLevel}) or requires more walking.\n`;
    } else {
      explanation += `However, it takes ${alt.travelMinutes - recTime} minutes longer and involves ${alt.walkingDistanceMeters}m of walking.\n`;
    }
  }

  return {
    explanation,
    aiSource: 'DETERMINISTIC_REASONING',
  };
}

/**
 * Generate 768-dimensional text embedding for MongoDB Vector Search
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  if (genAI && config.geminiApiKey) {
    try {
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await model.embedContent(text);
      if (result.embedding && result.embedding.values) {
        return result.embedding.values;
      }
    } catch (err: any) {
      console.warn('[Gemini Embedding] Falling back to deterministic vector:', err.message);
    }
  }

  // Deterministic normalized embedding matching seed format
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const dims = 768;
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
