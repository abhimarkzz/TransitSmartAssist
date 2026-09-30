import React, { useState, useEffect } from 'react';
import {
  Compass,
  ArrowRight,
  Sparkles,
  MapPin,
  Clock,
  Users,
  ShieldCheck,
  AlertTriangle,
  Layers,
  ChevronRight,
  TrendingUp,
  Activity,
  Footprints,
  Shuffle,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import {
  Stop,
  Vehicle,
  UserPreferences,
  RouteCandidateResult,
  RecommendationResponse,
  Alert,
} from '../types';
import { transitApi, recommendationsApi, analyticsApi, liveApi, tripsApi } from '../api/client';
import { RouteCard } from '../components/RouteCard';
import { MapView } from '../components/MapView';
import { AiReasonModal } from '../components/AiReasonModal';
import { TransactionModal } from '../components/TransactionModal';

interface DashboardProps {
  onNavigateTab: (tab: string) => void;
  onSelectRouteForPlan?: (route: RouteCandidateResult) => void;
  stops: Stop[];
  vehicles: Vehicle[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateTab,
  onSelectRouteForPlan,
  stops,
  vehicles,
}) => {
  // Preset transit hubs for quick demo
  const presetHubs = [
    { name: 'Grand Central Terminal', coords: [-73.9851, 40.7488] as [number, number], zone: 'Downtown' },
    { name: 'Central Park South', coords: [-73.9751, 40.7838] as [number, number], zone: 'Uptown' },
    { name: 'Silicon Boulevard', coords: [-73.9451, 40.7388] as [number, number], zone: 'Tech District' },
    { name: 'Marina Bay Walk', coords: [-74.0301, 40.7338] as [number, number], zone: 'Riverfront' },
    { name: 'South Ferry Hub', coords: [-74.0051, 40.6988] as [number, number], zone: 'Harbor Gateway' },
    { name: 'Terminal 1 International', coords: [-73.9101, 40.7038] as [number, number], zone: 'Airport East' },
    { name: 'Wall Street Metro', coords: [-73.9951, 40.7138] as [number, number], zone: 'Financial' },
  ];

  const [originIndex, setOriginIndex] = useState(0);
  const [destIndex, setDestIndex] = useState(1);
  const [preferences, setPreferences] = useState<UserPreferences>({
    avoidCrowds: true,
    lessWalking: true,
    fewerTransfers: false,
    fasterTravel: true,
    preferReliable: true,
    accessibleRoute: false,
  });

  const [isSearching, setIsSearching] = useState(false);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [selectedMapRoute, setSelectedMapRoute] = useState<RouteCandidateResult | null>(null);

  // Modals state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiRoute, setAiRoute] = useState<RouteCandidateResult | null>(null);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiSource, setAiSource] = useState<'GEMINI_FLASH' | 'DETERMINISTIC_REASONING'>('DETERMINISTIC_REASONING');
  const [aiLoading, setAiLoading] = useState(false);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txMetadata, setTxMetadata] = useState<any>(null);
  const [isSavingTrip, setIsSavingTrip] = useState(false);

  // Load KPIs and Active Alerts
  useEffect(() => {
    analyticsApi.getKpis()
      .then((res) => {
        if (res.success) setKpis(res.kpis);
      })
      .catch(() => {});

    liveApi.getActiveAlerts()
      .then((res) => {
        if (res.success) setActiveAlerts(res.alerts);
      })
      .catch(() => {});
  }, []);

  // Handle Find Smart Routes (MongoDB Aggregation Pipeline)
  const handleFindRoutes = async () => {
    setIsSearching(true);
    const origin = presetHubs[originIndex];
    const dest = presetHubs[destIndex];

    try {
      const res = await recommendationsApi.getRecommendations({
        originCoords: origin.coords,
        destCoords: dest.coords,
        originName: origin.name,
        destName: dest.name,
        preferences,
      });

      if (res.success) {
        setRecommendation(res);
        if (res.recommended) {
          setSelectedMapRoute(res.recommended);
        }
      }
    } catch (err: any) {
      console.error('Recommendation search error', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Run initial route search on mount
  useEffect(() => {
    handleFindRoutes();
  }, []);

  const handleAskAi = async (route: RouteCandidateResult) => {
    setAiRoute(route);
    setAiModalOpen(true);
    setAiLoading(true);

    try {
      const res = await recommendationsApi.explainRecommendation({
        recommended: route,
        alternatives: recommendation?.alternatives || [],
        preferences,
        originName: presetHubs[originIndex].name,
        destName: presetHubs[destIndex].name,
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
        origin: {
          name: presetHubs[originIndex].name,
          location: { type: 'Point', coordinates: presetHubs[originIndex].coords },
        },
        destination: {
          name: presetHubs[destIndex].name,
          location: { type: 'Point', coordinates: presetHubs[destIndex].coords },
        },
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
      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-slate-800 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI-Driven Mobility Powered by MongoDB Atlas & Gemini Flash</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Your commute, <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">intelligently optimized.</span>
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Real-time public transit recommendations calculating live delays, crowding levels, walking distance, and transfer penalties through genuine MongoDB aggregation pipelines and 2dsphere geospatial indexing.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('plan')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 flex items-center space-x-2 transition-all hover:scale-[1.02]"
            >
              <span>Explore Full Trip Planner</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigateTab('intelligence')}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 font-semibold text-xs border border-cyan-500/30 flex items-center space-x-2 transition-all"
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>MongoDB Intelligence Center (12 Concepts)</span>
            </button>
          </div>
        </div>

        {/* Live Active Alerts Ticker */}
        {activeAlerts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center space-x-3 text-xs">
            <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>LIVE ALERT</span>
            </span>
            <div className="overflow-hidden text-slate-300 truncate">
              <strong className="text-white">{activeAlerts[0].title}:</strong> {activeAlerts[0].description}
            </div>
          </div>
        )}
      </div>

      {/* System Live KPIs Bar */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Active Routes</span>
              <Compass className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{kpis.totalRoutes}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Metro, Rail, Express & Buses</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Live Vehicles</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{kpis.activeVehicles}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Streaming via Change Stream</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Avg System Delay</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">{kpis.avgDelayMinutes} min</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Across time-series telemetry</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>On-Time Rate</span>
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-cyan-400">{kpis.onTimeRatePercent}%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Within 2 minutes threshold</div>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>System Occupancy</span>
              <Users className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">{kpis.avgOccupancyPercentage}%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Moderate passenger volume</div>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout: Route Planner & Live Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Route Configuration & Recommendations */}
        <div className="lg:col-span-7 space-y-6">
          {/* Smart Route Configuration Card */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>Smart Route Finder</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                MongoDB $geoNear + Aggregation
              </span>
            </div>

            {/* Origin & Destination Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Origin Station</span>
                </label>
                <select
                  value={originIndex}
                  onChange={(e) => setOriginIndex(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {presetHubs.map((hub, idx) => (
                    <option key={idx} value={idx}>
                      {hub.name} ({hub.zone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  <span>Destination Station</span>
                </label>
                <select
                  value={destIndex}
                  onChange={(e) => setDestIndex(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {presetHubs.map((hub, idx) => (
                    <option key={idx} value={idx} disabled={idx === originIndex}>
                      {hub.name} ({hub.zone})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Commuter Preference Controls */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Commuter Route Preferences (MongoDB Scoring Factors)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'avoidCrowds', label: 'Avoid Crowds', icon: Users },
                  { id: 'lessWalking', label: 'Less Walking', icon: Footprints },
                  { id: 'fewerTransfers', label: 'Fewer Transfers', icon: Shuffle },
                  { id: 'fasterTravel', label: 'Faster Travel', icon: Clock },
                  { id: 'preferReliable', label: 'Prefer Reliable', icon: ShieldCheck },
                  { id: 'accessibleRoute', label: 'Accessible (Step-free)', icon: CheckCircle2 },
                ].map((pref) => {
                  const Icon = pref.icon;
                  const active = (preferences as any)[pref.id];
                  return (
                    <button
                      key={pref.id}
                      type="button"
                      onClick={() =>
                        setPreferences({
                          ...preferences,
                          [pref.id]: !active,
                        })
                      }
                      className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                        active
                          ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
                      <span className="truncate">{pref.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleFindRoutes}
              disabled={isSearching}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Computing MongoDB Route Aggregations...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Find Smart Routes with MongoDB</span>
                </>
              )}
            </button>
          </div>

          {/* Recommendations Results Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Recommended Candidates</span>
                {recommendation && (
                  <span className="text-[11px] font-normal text-slate-400">
                    ({recommendation.totalCandidatesEvaluated} candidates evaluated in {recommendation.executionTimeMs}ms)
                  </span>
                )}
              </h3>
              <button
                onClick={() => onNavigateTab('plan')}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center space-x-1"
              >
                <span>Full Planner</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recommendation?.recommended ? (
              <div className="space-y-3">
                {/* Top Recommended Route Card */}
                <RouteCard
                  route={recommendation.recommended}
                  isRecommended={true}
                  onAskAi={handleAskAi}
                  onSaveTrip={handleSaveTrip}
                  onViewOnMap={(r) => setSelectedMapRoute(r)}
                  isSaving={isSavingTrip}
                />

                {/* Top Alternative Route */}
                {recommendation.alternatives.length > 0 && (
                  <RouteCard
                    route={recommendation.alternatives[0]}
                    isRecommended={false}
                    onAskAi={handleAskAi}
                    onSaveTrip={handleSaveTrip}
                    onViewOnMap={(r) => setSelectedMapRoute(r)}
                    isSaving={isSavingTrip}
                  />
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-xs">
                Select an origin and destination to compute smart route recommendations.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Interactive Map */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Live Transit Network Map</span>
            </h2>
            <button
              onClick={() => onNavigateTab('live-map')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
            >
              <span>Full Screen</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <MapView
            stops={stops}
            vehicles={vehicles}
            selectedRoute={selectedMapRoute}
            originCoords={presetHubs[originIndex].coords}
            destCoords={presetHubs[destIndex].coords}
            originName={presetHubs[originIndex].name}
            destName={presetHubs[destIndex].name}
            height="580px"
          />

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow" />
              <span>Real-time GeoJSON vehicle positions updated via Change Stream</span>
            </div>
            <span className="font-mono text-slate-500">{vehicles.length} Active Vehicles</span>
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
