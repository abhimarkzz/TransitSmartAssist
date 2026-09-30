import React from 'react';
import { Sparkles, X, Brain, CheckCircle2, ShieldCheck } from 'lucide-react';
import { RouteCandidateResult } from '../types';

interface AiReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  route: RouteCandidateResult | null;
  explanation: string;
  aiSource: 'GEMINI_FLASH' | 'DETERMINISTIC_REASONING';
  isLoading: boolean;
}

export const AiReasonModal: React.FC<AiReasonModalProps> = ({
  isOpen,
  onClose,
  route,
  explanation,
  aiSource,
  isLoading,
}) => {
  if (!isOpen || !route) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white">TransitAI Route Reasoning</h2>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  aiSource === 'GEMINI_FLASH'
                    ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                    : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                }`}
              >
                {aiSource === 'GEMINI_FLASH' ? 'Gemini 1.5 Flash' : 'Database Route Heuristics'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Database facts retrieved from MongoDB & explained in natural language
            </p>
          </div>
        </div>

        {/* Route Snapshot Header */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ backgroundColor: route.color }}
            />
            <div>
              <div className="text-sm font-bold text-white">{route.name}</div>
              <div className="text-xs text-slate-400">
                Board at: <span className="text-slate-200">{route.boardingStop.name}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-emerald-400">{route.travelMinutes} mins ETA</div>
            <div className="text-xs text-slate-400">Score: {route.score}/100</div>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-medium">
                Querying MongoDB metrics & formulating AI transit reasoning...
              </p>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm text-slate-300 space-y-3 text-xs leading-relaxed">
              {explanation.split('\n\n').map((paragraph, i) => (
                <p key={i} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {/* Database Source of Truth Guarantee */}
          <div className="rounded-xl p-3 bg-blue-950/20 border border-blue-800/30 text-[11px] text-blue-300 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-blue-200">Anti-Hallucination Guarantee:</strong> Reasoning is synthesized strictly from real MongoDB candidate documents, current vehicle delays, and active crowd sensors.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Close Explanation
          </button>
        </div>
      </div>
    </div>
  );
};
