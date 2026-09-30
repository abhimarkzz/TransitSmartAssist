import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  ShieldCheck,
  Compass,
  Layers,
  Database,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { analyticsApi } from '../api/client';

export const Analytics: React.FC = () => {
  const [kpis, setKpis] = useState<any>(null);
  const [routeDelays, setRouteDelays] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<any[]>([]);
  const [busiestStops, setBusiestStops] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [materialized, setMaterialized] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const [kpiRes, delayRes, peakRes, stopsRes, prefRes, matRes] = await Promise.all([
        analyticsApi.getKpis(),
        analyticsApi.getDelayByRoute(),
        analyticsApi.getPeakHours(),
        analyticsApi.getBusiestStops(),
        analyticsApi.getPreferences(),
        analyticsApi.getMaterializedStats(),
      ]);

      if (kpiRes.success) setKpis(kpiRes.kpis);
      if (delayRes.success) setRouteDelays(delayRes.routes);
      if (peakRes.success) setPeakHours(peakRes.peakHours);
      if (stopsRes.success) setBusiestStops(stopsRes.stops);
      if (prefRes.success) setPreferences(prefRes.preferences);
      if (matRes.success) setMaterialized(matRes.stats);
    } catch (err) {
      console.error('Analytics load error', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Transit Intelligence & Operational Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            MongoDB Aggregation Analytics Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            All charts and metrics are computed in real-time by genuine MongoDB aggregation pipelines ($group, $hour, $facet, $merge). Zero JavaScript in-memory grouping.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center space-x-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Aggregations</span>
        </button>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">Total Active Routes</span>
            <div className="text-2xl font-bold text-white">{kpis.totalRoutes}</div>
            <span className="text-[10px] text-slate-500 font-mono">db.routes.countDocuments()</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">Telemetry Vehicles</span>
            <div className="text-2xl font-bold text-emerald-400">{kpis.activeVehicles}</div>
            <span className="text-[10px] text-emerald-500/80 font-mono">Real-time active</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">System Average Delay</span>
            <div className="text-2xl font-bold text-amber-400">{kpis.avgDelayMinutes} min</div>
            <span className="text-[10px] text-slate-500 font-mono">Time-Series $avg</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">On-Time Performance</span>
            <div className="text-2xl font-bold text-cyan-400">{kpis.onTimeRatePercent}%</div>
            <span className="text-[10px] text-slate-500 font-mono">&le; 2 min threshold</span>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">Network Occupancy</span>
            <div className="text-2xl font-bold text-purple-400">{kpis.avgOccupancyPercentage}%</div>
            <span className="text-[10px] text-slate-500 font-mono">Fleet-wide average</span>
          </div>
        </div>
      )}

      {/* Row 1: Delay by Route & 24-Hour Peak Hour Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Delay by Route Bar Chart */}
        <div className="lg:col-span-6 rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Average Delay by Route (Minutes)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                MongoDB $group on transitTelemetry.metadata.routeId joined with routes
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              $lookup + $group
            </span>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={routeDelays} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="shortName"
                  stroke="#94A3B8"
                  fontSize={11}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  labelStyle={{ color: '#F8FAFC', fontWeight: 'bold' }}
                />
                <Bar dataKey="avgDelayMinutes" name="Avg Delay (min)" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 24-Hour Peak Hour Area Chart */}
        <div className="lg:col-span-6 rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>24-Hour Peak Hour Occupancy & Crowd Curves</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Computed via Time-Series Collection aggregation with $hour: "$timestamp"
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Time-Series $hour
            </span>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <defs>
                  <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="hourFormatted" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  labelStyle={{ color: '#F8FAFC', fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="avgOccupancy"
                  name="Occupancy %"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#occupancyGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Busiest Stations & Commuter Preference Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Busiest Stations */}
        <div className="lg:col-span-7 rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Busiest Transit Stations by Passenger Flow</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                MongoDB aggregation sorting by passengerFlowPerHour and counting connections
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              $sort + $project
            </span>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={busiestStops} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={10} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                />
                <Bar dataKey="passengerFlowPerHour" name="Passengers / Hour" fill="#10B981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Commuter Preferences */}
        <div className="lg:col-span-5 rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Commuter Preference Breakdown</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                MongoDB aggregation calculating commuter preference distribution
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Users $group
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {preferences.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{item.name}</span>
                  <span className="text-blue-400 font-bold font-mono">{item.percentage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Materialized Route Analytics ($merge Collection) */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Materialized Analytics Collection (via MongoDB $merge)
              </h2>
              <p className="text-xs text-slate-400">
                Shows derived, materialized data populated via background aggregation $merge into "materializedRouteStats"
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
            collection: materializedRouteStats
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Route ID</th>
                <th className="py-2.5 px-3">Telemetry Data Points</th>
                <th className="py-2.5 px-3">Average Delay</th>
                <th className="py-2.5 px-3">Peak Delay</th>
                <th className="py-2.5 px-3">Average Occupancy</th>
                <th className="py-2.5 px-3">Crowd Surge Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {materialized.map((row) => (
                <tr key={row.routeId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2 px-3 font-bold text-white">{row.routeId}</td>
                  <td className="py-2 px-3 text-slate-400">{row.totalTelemetryPoints}</td>
                  <td className="py-2 px-3 text-amber-400">{row.avgDelaySeconds}s</td>
                  <td className="py-2 px-3 text-rose-400">{row.maxDelaySeconds}s</td>
                  <td className="py-2 px-3 text-cyan-400">{row.avgOccupancy}%</td>
                  <td className="py-2 px-3 text-emerald-400">{row.crowdRatePercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
