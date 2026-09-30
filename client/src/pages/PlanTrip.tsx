import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Sparkles,
  Users,
  Footprints,
  Shuffle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Sliders,
  Compass,
} from 'lucide-react';
import { Stop, Vehicle, UserPreferences, RouteCandidateResult, RecommendationResponse } from '../types';
import { recommendationsApi, tripsApi } from '../api/client';
import { RouteCard } from '../components/RouteCard';
import { MapView } from '../components/MapView';
import { AiReasonModal } from '../components/AiReasonModal';
import { TransactionModal } from '../components/TransactionModal';

interface PlanTripProps {
  stops: Stop[];
  vehicles: Vehicle[];
}

export const PlanTrip: React.FC<PlanTripProps> = ({ stops, vehicles }) => {
  const [selectedOriginId, setSelectedOriginId] = useState<string>('STP-001');
  const [selectedDestId, setSelectedDestId] = useState<string>('STP-023');

  const [preferences, setPreferences] = useState<UserPreferences>({
    avoidCrowds: true,
    lessWalking: true,
    fewerTransfers: false,
    fasterTravel: true,
    preferReliable: true,
    accessibleRoute: false,
    maxWalkDistanceMeters: 1000,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteCandidateResult | null>(null);

  // Modals state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiRoute, setAiRoute] = useState<RouteCandidateResult | null>(null);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiSource, setAiSource] = useState<'GEMINI_FLASH' | 'DETERMINISTIC_REASONING'>('DETERMINISTIC_REASONING');
  const [aiLoading, setAiLoading] = useState(false);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txMetadata, setTxMetadata] = useState<any>(null);
  const [isSavingTrip, setIsSavingTrip] = useState(false);

  const originStop = stops.find((s) => s.stopId === selectedOriginId) || stops[0];
  const destStop = stops.find((s) => s.stopId === selectedDestId) || stops[1];

  const handleComputeRoutes = async () => {
    if (!originStop || !destStop) return;
    setIsLoading(true);

    try {
      const res = await recommendationsApi.getRecommendations({
        originCoords: originStop.location.coordinates,
        destCoords: destStop.location.coordinates,
        originName: originStop.name,
        destName: destStop.name,
        preferences,
      });

      if (res.success) {
        setRecommendation(res);
        if (res.recommended) {
          setSelectedRoute(res.recommended);
        }
      }
    } catch (err: any) {
      console.error('Plan trip error', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (stops.length > 0) {
      handleComputeRoutes();
    }
  }, [selectedOriginId, selectedDestId]);

  const handleAskAi = async (route: RouteCandidateResult) => {
    setAiRoute(route);
    setAiModalOpen(true);
    setAiLoading(true);

    try {
      const res = await recommendationsApi.explainRecommendation({
        recommended: route,
        alternatives: recommendation?.alternatives || [],
        preferences,
        originName: originStop.name,
        destName: destStop.name,
      });

      if (res.success) {
        setAiExplanation(res.explanation);
        setAiSource(res.aiSource);
      }
    } catch (err: any) {
      setAiExplanation('Error retrieving AI explanation: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveTrip = async (route: RouteCandidateResult) => {
    setIsSavingTrip(true);
    try {
      const res = await tripsApi.saveTrip({
        origin: { name: originStop.name, location: originStop.location },
        destination: { name: destStop.name, location: destStop.location },
        routeId: route.routeId,
        routeName: route.name,
        transitType: route.type,
        travelTimeMinutes: route.travelMinutes,
        walkingDistanceMeters: route.walkingDistanceMeters,
        transfers: route.transfers,
        crowdLevel: route.crowdLevel,
        score: route.score,
        savedPreferences: preferences,
      });

      if (res.success) {
        setTxMetadata({
          tripId: res.trip.tripId,
          routeName: route.name,
          ...res.transactionMetadata,
        });
        setTxModalOpen(true);
      }
    } catch (err: any) {
      alert('Failed to save trip: ' + err.message);
    } finally {
      setIsSavingTrip(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Compass className="w-4 h-4" />
          <span>Smart Route Recommendation Engine</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Plan Your Commute with Real-Time Intelligence
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          MongoDB aggregation pipelines evaluate live vehicle delays, crowded platform sensors, and walking radii to score and rank candidate routes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls & Preferences */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Route Parameters</span>
            </h2>

            {/* Origin Stop */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Departure Station (Origin)
              </label>
              <select
                value={selectedOriginId}
                onChange={(e) => setSelectedOriginId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {stops.map((stop) => (
                  <option key={stop.stopId} value={stop.stopId}>
                    {stop.name} ({stop.zone})
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Stop */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Arrival Station (Destination)
              </label>
              <select
                value={selectedDestId}
                onChange={(e) => setSelectedDestId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {stops.map((stop) => (
                  <option key={stop.stopId} value={stop.stopId} disabled={stop.stopId === selectedOriginId}>
                    {stop.name} ({stop.zone})
                  </option>
                ))}
              </select>
            </div>

            {/* Max Walking Distance */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Max Walking Radius:</span>
                <span className="font-semibold text-white">{preferences.maxWalkDistanceMeters}m</span>
              </div>
              <input
                type="range"
                min="400"
                max="2500"
                step="100"
                value={preferences.maxWalkDistanceMeters || 1000}
                onChange={(e) =>
                  setPreferences({ ...preferences, maxWalkDistanceMeters: parseInt(e.target.value) })
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Commuter Preferences */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Commuter Scoring Weights</label>
              <div className="space-y-1.5">
                {[
                  { id: 'avoidCrowds', label: 'Avoid Crowds & High Density', icon: Users },
                  { id: 'lessWalking', label: 'Minimize Walking Distance', icon: Footprints },
                  { id: 'fewerTransfers', label: 'Prioritize Direct / Fewer Transfers', icon: Shuffle },
                  { id: 'fasterTravel', label: 'Fastest Travel Time', icon: Clock },
                  { id: 'preferReliable', label: 'Prefer High Historical Reliability', icon: ShieldCheck },
                  { id: 'accessibleRoute', label: 'Require Step-Free Accessibility', icon: CheckCircle2 },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = (preferences as any)[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setPreferences({
                          ...preferences,
                          [item.id]: !active,
                        })
                      }
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Icon className={`w-3.5 h-3.5 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </div>
                      <span className={`w-2 h-2 rounded-full ${active ? 'bg-blue-400' : 'bg-slate-700'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleComputeRoutes}
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Calculating MongoDB Pipelines...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Update Smart Recommendations</span>
                </>
              )}
            </button>
          </div>

          {/* Pipeline Proof Snippet */}
          {recommendation && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-xs font-mono text-slate-400 space-y-2">
              <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                Active MongoDB Pipeline Stages
              </div>
              <ul className="space-y-1 text-[11px]">
                {recommendation.pipelineStagesUsed.map((stage, idx) => (
                  <li key={idx} className="flex items-center space-x-1.5 text-slate-400">
                    <span className="text-cyan-400">✓</span>
                    <span>{stage}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-slate-800 text-emerald-400 font-bold text-[11px]">
                Executed in {recommendation.executionTimeMs} ms
              </div>
            </div>
          )}
        </div>

        {/* Results & Map */}
        <div className="lg:col-span-8 space-y-6">
          {/* Map Preview */}
          <MapView
            stops={stops}
            vehicles={vehicles}
            selectedRoute={selectedRoute}
            originCoords={originStop?.location?.coordinates}
            destCoords={destStop?.location?.coordinates}
            originName={originStop?.name}
            destName={destStop?.name}
            height="340px"
          />

          {/* Candidate Results */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center justify-between">
              <span>Candidate Route Rankings</span>
              {recommendation && (
                <span className="text-xs font-normal text-slate-400">
                  {recommendation.totalCandidatesEvaluated} Candidates Ranked by Weighted Fitness
                </span>
              )}
            </h2>

            {recommendation?.recommended ? (
              <div className="space-y-4">
                <RouteCard
                  route={recommendation.recommended}
                  isRecommended={true}
                  onAskAi={handleAskAi}
                  onSaveTrip={handleSaveTrip}
                  onViewOnMap={(r) => setSelectedRoute(r)}
                  isSaving={isSavingTrip}
                />

                {recommendation.alternatives.map((alt) => (
                  <RouteCard
                    key={alt.routeId}
                    route={alt}
                    isRecommended={false}
                    onAskAi={handleAskAi}
                    onSaveTrip={handleSaveTrip}
                    onViewOnMap={(r) => setSelectedRoute(r)}
                    isSaving={isSavingTrip}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400 text-xs">
                No route candidates found for the specified stops. Try adjusting your walking radius.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AiReasonModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        route={aiRoute}
        explanation={aiExplanation}
        aiSource={aiSource}
        isLoading={aiLoading}
      />

      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        metadata={txMetadata}
      />
    </div>
  );
};
