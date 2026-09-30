import React from 'react';
import { RouteCandidateResult } from '../types';
import {
  Clock,
  Footprints,
  Shuffle,
  Users,
  Sparkles,
  Bookmark,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface RouteCardProps {
  route: RouteCandidateResult;
  isRecommended?: boolean;
  onSaveTrip: (route: RouteCandidateResult) => void;
  onAskAi: (route: RouteCandidateResult) => void;
  onViewOnMap: (route: RouteCandidateResult) => void;
  isSaving?: boolean;
}

export const RouteCard: React.FC<RouteCardProps> = ({
  route,
  isRecommended = false,
  onSaveTrip,
  onAskAi,
  onViewOnMap,
  isSaving = false,
}) => {
  const crowdColor =
    route.crowdLevel === 'LOW'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : route.crowdLevel === 'MODERATE'
      ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
      : route.crowdLevel === 'HIGH'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

  return (
    <div
      className={`relative rounded-2xl p-5 transition-all ${
        isRecommended
          ? 'bg-slate-900 border-2 border-blue-500/50 shadow-xl shadow-blue-500/10 ring-1 ring-blue-500/30'
          : 'bg-slate-900/60 border border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Recommended Pill */}
      {isRecommended && (
        <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-[11px] font-bold text-white shadow-md flex items-center space-x-1">
          <Sparkles className="w-3 h-3" />
          <span>TOP SMART RECOMMENDATION</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mt-1 mb-3">
        <div className="flex items-center space-x-3">
          <div
            className="w-3.5 h-10 rounded-full"
            style={{ backgroundColor: route.color || '#3B82F6' }}
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {route.type}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {route.shortName}
              </span>
              {route.accessible && (
                <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.2 rounded font-medium">
                  Step-free
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">{route.name}</h3>
          </div>
        </div>

        {/* MongoDB Score Ring */}
        <div className="flex flex-col items-end">
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-black text-white">{route.score}</span>
            <span className="text-xs text-slate-400 font-semibold">/100</span>
          </div>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            Match Score
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 border-y border-slate-800/80 my-3 text-xs">
        {/* Travel Time */}
        <div className="flex items-center space-x-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/50">
          <Clock className="w-4 h-4 text-blue-400 shrink-0" />
          <div>
            <div className="font-bold text-white text-sm">{route.travelMinutes} mins</div>
            <div className="text-[10px] text-slate-400">
              {route.delayMinutes > 0 ? (
                <span className="text-amber-400 font-medium">+{route.delayMinutes}m delay</span>
              ) : (
                <span className="text-emerald-400 font-medium">On-Time</span>
              )}
            </div>
          </div>
        </div>

        {/* Walking Distance */}
        <div className="flex items-center space-x-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/50">
          <Footprints className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="font-bold text-white text-sm">{route.walkingDistanceMeters}m</div>
            <div className="text-[10px] text-slate-400">Walking Total</div>
          </div>
        </div>

        {/* Transfers */}
        <div className="flex items-center space-x-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/50">
          <Shuffle className="w-4 h-4 text-purple-400 shrink-0" />
          <div>
            <div className="font-bold text-white text-sm">
              {route.transfers === 0 ? 'Direct' : `${route.transfers} Transfer`}
            </div>
            <div className="text-[10px] text-slate-400">
              {route.transfers === 0 ? 'Zero transfers' : 'Connection needed'}
            </div>
          </div>
        </div>

        {/* Crowd Level */}
        <div className="flex items-center space-x-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/50">
          <Users className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className={`font-bold text-xs uppercase px-1.5 py-0.5 rounded border inline-block ${crowdColor}`}>
              {route.crowdLevel}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Crowd Density</div>
          </div>
        </div>
      </div>

      {/* Boarding and Alighting Stations */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs py-1 text-slate-300">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
          <span className="text-slate-400">Board:</span>
          <span className="font-semibold text-white">{route.boardingStop.name}</span>
          <span className="text-[10px] text-slate-500">({route.boardingStop.walkDistanceMeters}m walk)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-rose-400"></div>
          <span className="text-slate-400">Exit:</span>
          <span className="font-semibold text-white">{route.alightingStop.name}</span>
          <span className="text-[10px] text-slate-500">({route.alightingStop.walkDistanceMeters}m walk)</span>
        </div>
      </div>

      {/* Key Reasons / Active Alerts */}
      {route.reasons && route.reasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {route.reasons.slice(0, 3).map((r, idx) => (
            <span
              key={idx}
              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/50 flex items-center space-x-1"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>{r}</span>
            </span>
          ))}
        </div>
      )}

      {route.activeAlerts && route.activeAlerts.length > 0 && (
        <div className="mt-2 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center space-x-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{route.activeAlerts[0]}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
        <button
          onClick={() => onViewOnMap(route)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors flex items-center space-x-1.5"
        >
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span>Show on Map</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onAskAi(route)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 transition-colors flex items-center space-x-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ask TransitAI</span>
          </button>

          <button
            onClick={() => onSaveTrip(route)}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center space-x-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            <Bookmark className="w-3.5 h-3.5 fill-current" />
            <span>{isSaving ? 'Committing...' : 'Save Trip (ACID)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
