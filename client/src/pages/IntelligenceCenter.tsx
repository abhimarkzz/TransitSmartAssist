import React, { useState, useEffect } from 'react';
import {
  Layers,
  Code2,
  Database,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Terminal,
  Activity,
  Compass,
  Cpu,
  ShieldCheck,
  Zap,
  Clock,
  Search,
  Binary,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { IntelligenceCard } from '../types';
import { mongoApi } from '../api/client';

export const IntelligenceCenter: React.FC = () => {
  const [cards, setCards] = useState<IntelligenceCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<IntelligenceCard | null>(null);
  const [copied, setCopied] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  useEffect(() => {
    mongoApi.getIntelligenceCards()
      .then((res) => {
        if (res.success) setCards(res.cards);
      })
      .catch((err) => console.error('Failed to load intelligence cards', err));
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getConceptIcon = (id: string) => {
    switch (id) {
      case '01': return Cpu;
      case '02': return Compass;
      case '03': return Activity;
      case '04': return Search;
      case '05': return Binary;
      case '06': return ShieldCheck;
      case '07': return Zap;
      case '08': return Database;
      case '09': return Layers;
      case '10': return Clock;
      case '11': return Terminal;
      case '12': return Code2;
      default: return Database;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/40 border border-blue-500/30 p-8 shadow-2xl relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Hackathon Evaluation Showcase (80% Weight)</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            MongoDB Intelligence Center
          </h1>

          <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
            TransitSmartAssist was intentionally engineered around the advanced capabilities of the native official MongoDB Node.js Driver. Review how each of the 12 advanced concepts is deeply embedded in the production transit engine.
          </p>
        </div>
      </div>

      {/* Grid of 12 Advanced Concept Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = getConceptIcon(card.id);
          return (
            <div
              key={card.id}
              className="rounded-2xl p-6 bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition-all flex flex-col justify-between group shadow-lg hover:shadow-blue-500/5"
            >
              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                      #{card.id}
                    </span>
                    <span className="text-[11px] font-semibold text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-full">
                      {card.badge}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-blue-600/20 text-slate-400 group-hover:text-blue-400 flex items-center justify-center transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
                  {card.concept}
                </h3>

                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  {card.whyUsed}
                </p>

                {/* Collections Involved */}
                <div className="mb-4">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Collections Used
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {card.collections.map((col, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[11px] font-mono text-slate-400 truncate max-w-[170px]" title={card.endpoint}>
                  {card.endpoint}
                </span>

                <button
                  onClick={() => setSelectedCard(card)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 flex items-center space-x-1.5 transition-colors shadow-sm"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Inspect Pipeline</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Code & Pipeline Inspector Modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 overflow-hidden">
            {/* Glow accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500" />

            <button
              onClick={() => setSelectedCard(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded">
                CONCEPT #{selectedCard.id}
              </span>
              <h2 className="text-xl font-bold text-white">{selectedCard.concept}</h2>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Why TransitSmartAssist Uses This
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {selectedCard.whyUsed}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Technical Architecture
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedCard.explanation}
                </p>
              </div>

              {/* Code Snippet Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Actual MongoDB Implementation Pipeline
                  </h4>
                  <button
                    onClick={() => handleCopy(selectedCard.samplePipeline)}
                    className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
                <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
                  <pre>{selectedCard.samplePipeline}</pre>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedCard(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
