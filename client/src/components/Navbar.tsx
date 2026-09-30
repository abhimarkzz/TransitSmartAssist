import React, { useState, useEffect } from 'react';
import {
  Train,
  Activity,
  Play,
  Pause,
  User as UserIcon,
  Shield,
  Layers,
  Sparkles,
  Terminal,
  BarChart3,
  Bookmark,
  MapPin,
  Compass,
} from 'lucide-react';
import { User } from '../types';
import { liveApi, authApi } from '../api/client';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  setCurrentUser,
  onOpenAuthModal,
}) => {
  const [simulationActive, setSimulationActive] = useState(true);
  const [streamActive, setStreamActive] = useState(true);
  const [isTogglingSim, setIsTogglingSim] = useState(false);

  useEffect(() => {
    // Check initial simulation & stream status
    liveApi.getSimulationStatus()
      .then((res) => {
        if (res.success) {
          setSimulationActive(res.simulationActive);
          setStreamActive(res.streamActive);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleSimulation = async () => {
    setIsTogglingSim(true);
    try {
      const res = await liveApi.toggleSimulation();
      if (res.success) {
        setSimulationActive(res.simulationActive);
      }
    } catch (err) {
      console.error('Failed to toggle simulation', err);
    } finally {
      setIsTogglingSim(false);
    }
  };

  const handleQuickDemoSwitch = async (role: 'commuter' | 'admin') => {
    try {
      const res = await authApi.demoLogin(role);
      if (res.success) {
        localStorage.setItem('transit_auth_token', res.token);
        setCurrentUser(res.user);
      }
    } catch (err) {
      console.error('Demo login error', err);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Compass },
    { id: 'plan', label: 'Plan Trip', icon: MapPin },
    { id: 'live-map', label: 'Live Map', icon: Activity },
    { id: 'trips', label: 'My Trips', icon: Bookmark },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'intelligence', label: 'MongoDB Intelligence', icon: Layers, highlight: true },
    { id: 'query-lab', label: 'Query Lab', icon: Terminal },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0B0F19]/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setCurrentTab('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Train className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-white">TransitSmartAssist</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  MongoDB 80%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Smart Transit Intelligence & AI</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="hidden xl:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : item.highlight
                      ? 'text-cyan-300 hover:bg-slate-800/60 border border-cyan-500/20 bg-cyan-950/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : item.highlight ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.highlight && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-3">
            {/* Live Change Stream Beacon */}
            <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${streamActive ? 'bg-emerald-400 animate-pulse-glow' : 'bg-amber-400'}`}></span>
              <span className="font-mono text-slate-300">
                {streamActive ? 'LIVE CHANGE STREAM' : 'POLLING'}
              </span>
            </div>

            {/* Simulation Play / Pause Toggle */}
            <button
              onClick={handleToggleSimulation}
              disabled={isTogglingSim}
              title={simulationActive ? 'Pause background transit simulator' : 'Resume background transit simulator'}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                simulationActive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              {simulationActive ? (
                <>
                  <Pause className="w-3 h-3 fill-current" />
                  <span className="hidden md:inline">Sim Live</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span className="hidden md:inline">Resume</span>
                </>
              )}
            </button>

            {/* User Profile / Quick Demo Switcher */}
            {currentUser ? (
              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg p-1">
                <div className="flex items-center space-x-1.5 px-2 py-0.5">
                  {currentUser.role === 'admin' ? (
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span className="text-xs font-medium text-slate-200">{currentUser.name.split(' ')[0]}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 px-1 rounded bg-slate-800">
                    {currentUser.role}
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleQuickDemoSwitch(currentUser.role === 'admin' ? 'commuter' : 'admin');
                  }}
                  title="Switch Demo Role"
                  className="text-[10px] text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20"
                >
                  Switch
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => handleQuickDemoSwitch('commuter')}
                  className="px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  Demo Commuter
                </button>
                <button
                  onClick={onOpenAuthModal}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <div className="flex xl:hidden overflow-x-auto py-2 space-x-1 scrollbar-none border-t border-slate-800/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
