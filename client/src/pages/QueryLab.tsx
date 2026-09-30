import React, { useState } from 'react';
import {
  Terminal,
  Play,
  Clock,
  CheckCircle2,
  Database,
  Layers,
  Sparkles,
  Compass,
  Activity,
  Search,
  Binary,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { mongoApi } from '../api/client';

export const QueryLab: React.FC = () => {
  const [activeDemoId, setActiveDemoId] = useState<number>(1);
  const [isRunning, setIsRunning] = useState(false);
  const [demoOutput, setDemoOutput] = useState<any>(null);

  const presets = [
    {
      id: 1,
      name: 'Geospatial $geoNear Search',
      concept: '2dsphere Indexing & Spherical Distance',
      desc: 'Discovers transit stations nearest to Grand Central Terminal within 1200 meters using spherical trigonometry.',
      icon: Compass,
      tag: '$geoNear',
    },
    {
      id: 2,
      name: 'Route Performance Aggregation',
      concept: 'Multi-Stage Analytics Pipeline',
      desc: 'Groups routes by transit mode, computes average travel times, reliability scores, and sample lines via $slice.',
      icon: Layers,
      tag: '$group + $slice',
    },
    {
      id: 3,
      name: 'Time-Series Telemetry Analysis',
      concept: 'Compressed Time-Series Aggregation',
      desc: 'Extracts hourly passenger occupancy and delay curves across thousands of vehicle sensor readings using $hour.',
      icon: Activity,
      tag: 'Time-Series $hour',
    },
    {
      id: 4,
      name: 'Atlas Search Full-Text Discovery',
      concept: 'Compound Text Relevance & Fuzzy Matching',
      desc: 'Runs full-text relevance search for "Express Airport" with textScore metadata sorting.',
      icon: Search,
      tag: '$search / $text',
    },
    {
      id: 5,
      name: 'Semantic Vector Search',
      concept: 'Approximate Nearest Neighbor (768-dim)',
      desc: 'Translates "quiet route with less walking and scenic views" into embeddings and scores semantic vector proximity.',
      icon: Binary,
      tag: '$vectorSearch',
    },
    {
      id: 6,
      name: 'Change Streams Live Oplog',
      concept: 'Real-Time Database Event Push',
      desc: 'Inspects active change stream connection status and retrieves the most recent oplog-dispatched telemetry event.',
      icon: Zap,
      tag: 'collection.watch()',
    },
    {
      id: 7,
      name: 'Multi-Document ACID Transaction',
      concept: 'Atomic Multi-Collection Commit',
      desc: 'Executes an atomic transaction spanning savedTrips, recommendationHistory, users, and auditLogs collections.',
      icon: ShieldCheck,
      tag: 'session.withTransaction',
    },
    {
      id: 8,
      name: 'Query Explain & Index Scans',
      concept: 'Execution Plan Performance Profiling',
      desc: 'Profiles query execution using explain("executionStats"), proving an index scan (IXSCAN) with 0 unindexed docs scanned.',
      icon: Terminal,
      tag: 'explain("executionStats")',
    },
  ];

  const handleRunDemo = async (id: number) => {
    setActiveDemoId(id);
    setIsRunning(true);
    try {
      const res = await mongoApi.runQueryLabDemo(id);
      setDemoOutput(res);
    } catch (err: any) {
      setDemoOutput({ success: false, error: err.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Terminal className="w-4 h-4" />
          <span>Interactive Query Execution Lab</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          MongoDB Query & Pipeline Lab
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
          Execute real MongoDB queries and aggregation pipelines directly against the live database. Inspect the pipeline structure, verify execution timings, and examine the raw JSON documents returned.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Preset Selector Sidebar */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Preset Interactive Demos
          </span>
          <div className="space-y-2">
            {presets.map((preset) => {
              const Icon = preset.icon;
              const isSelected = activeDemoId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleRunDemo(preset.id)}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/50 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        Demo {preset.id}: {preset.name}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">{preset.desc}</p>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-cyan-400 font-semibold">{preset.tag}</span>
                    <span className="text-slate-500">{preset.concept}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Output & Inspector Panel */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider">
                  Live Database Execution
                </span>
                <h2 className="text-lg font-bold text-white">
                  {presets[activeDemoId - 1]?.name}
                </h2>
              </div>

              <button
                onClick={() => handleRunDemo(activeDemoId)}
                disabled={isRunning}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 flex items-center space-x-2 transition-all disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Demo Live</span>
                  </>
                )}
              </button>
            </div>

            {/* Execution Metrics Bar */}
            {demoOutput && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Execution Latency</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    {demoOutput.executionTimeMs !== undefined ? `${demoOutput.executionTimeMs} ms` : 'Completed'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Records Returned</span>
                  <span className="font-bold text-white font-mono text-sm">
                    {demoOutput.count ?? (demoOutput.result?.length || 1)}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block text-[10px]">Database Tier</span>
                  <span className="font-bold text-cyan-400 font-mono text-xs">Native Driver Engine</span>
                </div>
              </div>
            )}

            {/* Pipeline Stage Inspector */}
            {demoOutput?.pipeline && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  MongoDB Pipeline Definition Executed
                </span>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto max-h-48">
                  <pre>{JSON.stringify(demoOutput.pipeline, null, 2)}</pre>
                </div>
              </div>
            )}

            {/* Raw JSON Results Viewer */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Live Query Result Output (JSON)
              </span>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-96">
                {isRunning ? (
                  <div className="py-12 text-center text-slate-500">
                    Executing query pipeline in MongoDB...
                  </div>
                ) : demoOutput ? (
                  <pre>{JSON.stringify(demoOutput.result || demoOutput.details || demoOutput.executionStatsSummary || demoOutput, null, 2)}</pre>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    Click "Run Demo Live" to execute this MongoDB operation.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
