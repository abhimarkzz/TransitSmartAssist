import React from 'react';
import { Database, Sparkles, Train, Github, Layers, Zap } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-800/80 text-slate-400 py-10 mt-16 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <Train className="w-4 h-4" />
              </div>
              <span className="text-base font-bold text-white tracking-tight">TransitSmartAssist</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Hackathon Submission
              </span>
            </div>
            <p className="text-slate-400 max-w-md leading-relaxed">
              An intelligent public transportation assistant powered by advanced MongoDB capabilities (Aggregation Pipelines, 2dsphere Geospatial, Time-Series Collections, Atlas Search, Vector Search, ACID Transactions, and Change Streams) paired with Gemini AI reasoning.
            </p>
            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>80%+ backend intelligence driven directly by MongoDB</span>
            </div>
          </div>

          {/* Advanced MongoDB Features */}
          <div>
            <h4 className="text-slate-200 font-semibold mb-3 flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>MongoDB Concepts</span>
            </h4>
            <ul className="space-y-1.5 text-slate-400">
              <li>Aggregation Pipelines ($facet, $lookup, $merge)</li>
              <li>2dsphere Geospatial ($geoNear)</li>
              <li>Native Time-Series Telemetry</li>
              <li>Atlas Full-Text & Vector Search</li>
              <li>Multi-Document ACID Transactions</li>
              <li>Change Streams & SSE</li>
            </ul>
          </div>

          {/* Architecture */}
          <div>
            <h4 className="text-slate-200 font-semibold mb-3 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Technology Stack</span>
            </h4>
            <ul className="space-y-1.5 text-slate-400">
              <li>Frontend: React 18, Vite, TypeScript</li>
              <li>Styling: Tailwind CSS, Leaflet Maps</li>
              <li>Backend: Node.js, Express, Native Driver</li>
              <li>AI: Gemini 1.5 Flash & text-embedding-004</li>
              <li>Realtime: MongoDB Change Streams</li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500">
          <p>&copy; {new Date().getFullYear()} TransitSmartAssist. Built with advanced MongoDB architecture.</p>
          <div className="flex items-center space-x-4 mt-3 sm:mt-0">
            <span className="text-slate-400">Demo dataset inspired by world-class urban transit systems</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
