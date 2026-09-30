import React, { useState } from 'react';
import { Stop, Vehicle, Route } from '../types';
import { MapView } from '../components/MapView';
import {
  Activity,
  Play,
  Pause,
  Zap,
  Users,
  Clock,
  Layers,
  Search,
  Filter,
  Train,
  CheckCircle2,
} from 'lucide-react';
import { liveApi } from '../api/client';

interface LiveMapProps {
  stops: Stop[];
  vehicles: Vehicle[];
  routes: Route[];
}

export const LiveMap: React.FC<LiveMapProps> = ({ stops, vehicles, routes }) => {
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [isSimulating, setIsSimulating] = useState(true);

  const zones = ['ALL', 'Downtown', 'Midtown', 'Uptown', 'Tech District', 'University Hub', 'Riverfront', 'Harbor Gateway', 'Airport East', 'Financial Center', 'Arts & Culture'];

  const filteredStops = stops.filter((s) => {
    const matchesZone = selectedZone === 'ALL' || s.zone === selectedZone;
    const matchesSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesZone && matchesSearch;
  });

  const handleToggleSim = async () => {
    try {
      const res = await liveApi.toggleSimulation();
      if (res.success) {
        setIsSimulating(res.simulationActive);
      }
    } catch (err) {
      console.error('Error toggling simulation', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4" />
            <span>MongoDB Change Stream Live Network Map</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Real-Time Transit Telemetry & Vehicles
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Streaming live GeoJSON vehicle coordinates from MongoDB Change Streams directly into Leaflet.
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleToggleSim}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center space-x-2 transition-all shadow-lg ${
              isSimulating
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-emerald-500/10'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            {isSimulating ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Telemetry Simulation</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Simulation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
        {/* Zone Filters */}
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-1">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
          {zones.map((zone) => (
            <button
              key={zone}
              onClick={() => setSelectedZone(zone)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedZone === zone
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {zone}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search stops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Map Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-9">
          <MapView
            stops={filteredStops}
            vehicles={vehicles}
            onSelectStop={(s) => {
              setSelectedStop(s);
              setSelectedVehicle(null);
            }}
            height="650px"
          />
        </div>

        {/* Sidebar Inspector */}
        <div className="lg:col-span-3 space-y-4">
          {/* Legend */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2 text-xs">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-2">
              Crowd Density Legend
            </h3>
            <div className="flex items-center justify-between text-slate-300">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <span>Low (&lt; 35%)</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Comfortable</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Moderate (35-60%)</span>
              </div>
              <span className="text-[10px] text-blue-400 font-mono">Seats Open</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span>High (60-80%)</span>
              </div>
              <span className="text-[10px] text-amber-400 font-mono">Standing</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span>Critical (&gt; 80%)</span>
              </div>
              <span className="text-[10px] text-rose-400 font-mono">Packed</span>
            </div>
          </div>

          {/* Selected Stop Details */}
          {selectedStop ? (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3 text-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                  Station Inspector
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold text-[10px]">
                  {selectedStop.code}
                </span>
              </div>
              <h4 className="text-base font-bold text-white">{selectedStop.name}</h4>
              <p className="text-slate-400 text-xs">Zone: {selectedStop.zone}</p>

              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Crowd Level:</span>
                  <span className="font-bold text-white">{selectedStop.currentCrowdLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hourly Passenger Flow:</span>
                  <span className="font-bold text-white">{selectedStop.passengerFlowPerHour || 850} / hr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Accessible (Step-free):</span>
                  <span className="font-bold text-emerald-400">
                    {selectedStop.accessible ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Connecting Lines:</span>
                <div className="flex flex-wrap gap-1">
                  {(selectedStop.connectingRoutes || []).map((r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold text-[10px]"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 text-center text-xs text-slate-400">
              Click on any station marker on the map to inspect live passenger metrics, connecting transit lines, and amenities.
            </div>
          )}

          {/* Active Vehicles Roster */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Live Vehicles ({vehicles.length})</span>
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono">Stream Active</span>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {vehicles.slice(0, 10).map((v) => (
                <div
                  key={v.vehicleId}
                  className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white">{v.vehicleId}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-semibold">
                      {v.routeId}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400">{v.speedKmH} km/h</span>
                    <span
                      className={`font-semibold ${
                        v.occupancy > 75 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {v.occupancy}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
