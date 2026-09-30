import React from 'react';
import { CheckCircle2, X, Database, ShieldCheck, Clock, ArrowRight } from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: {
    tripId: string;
    routeName: string;
    atomicOperationsCommitted: number;
    collectionsAffected: string[];
    isolationLevel: string;
    executionTimeMs: number;
  } | null;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  metadata,
}) => {
  if (!isOpen || !metadata) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success Icon & Title */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white">MongoDB ACID Transaction Committed</h2>
            </div>
            <p className="text-xs text-slate-400">All 4 related operations atomically persisted</p>
          </div>
        </div>

        {/* Trip Info */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 mb-4">
          <div className="text-xs text-slate-400 mb-0.5">Saved Trip</div>
          <div className="text-sm font-bold text-white">{metadata.routeName}</div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">ID: {metadata.tripId}</div>
        </div>

        {/* Transaction Proof Breakdown */}
        <div className="space-y-3 mb-5">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Multi-Document Operations (Atomically Committed)</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
              <span className="text-slate-300">1. Insert Saved Trip Record</span>
              <span className="font-mono text-emerald-400 text-[11px]">db.savedTrips.insertOne()</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
              <span className="text-slate-300">2. Append Recommendation History</span>
              <span className="font-mono text-emerald-400 text-[11px]">db.recommendationHistory.insertOne()</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
              <span className="text-slate-300">3. Update User Travel Statistics</span>
              <span className="font-mono text-emerald-400 text-[11px]">db.users.updateOne($inc)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
              <span className="text-slate-300">4. Write Immutable Audit Trail</span>
              <span className="font-mono text-emerald-400 text-[11px]">db.auditLogs.insertOne()</span>
            </div>
          </div>

          {/* Transaction Metadata Footer */}
          <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block">Isolation Level</span>
              <span className="font-semibold text-slate-200">{metadata.isolationLevel}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block">Execution Latency</span>
              <span className="font-semibold text-emerald-400">{metadata.executionTimeMs} ms</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
