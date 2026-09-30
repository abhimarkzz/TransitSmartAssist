import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { Dashboard } from './pages/Dashboard';
import { PlanTrip } from './pages/PlanTrip';
import { LiveMap } from './pages/LiveMap';
import { MyTrips } from './pages/MyTrips';
import { Analytics } from './pages/Analytics';
import { IntelligenceCenter } from './pages/IntelligenceCenter';
import { QueryLab } from './pages/QueryLab';
import { Stop, Vehicle, Route, User } from './types';
import { transitApi, authApi } from './api/client';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [stops, setStops] = useState<Stop[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // 1. Load Initial Core Data (Stops, Routes, Vehicles, Profile)
  useEffect(() => {
    const initData = async () => {
      try {
        // Check profile or do auto demo login for immediate judging convenience
        try {
          const profileRes = await authApi.getProfile();
          if (profileRes.success) {
            setCurrentUser(profileRes.user);
          }
        } catch {
          // Auto demo login so judge lands immediately into an active session
          const demoRes = await authApi.demoLogin('commuter');
          if (demoRes.success) {
            localStorage.setItem('transit_auth_token', demoRes.token);
            setCurrentUser(demoRes.user);
          }
        }

        const [stopsRes, routesRes] = await Promise.all([
          transitApi.getStops(),
          transitApi.getRoutes(),
        ]);

        if (stopsRes.success) setStops(stopsRes.stops);
        if (routesRes.success) setRoutes(routesRes.routes);

        // Fetch initial vehicles
        const defaultVehiclesRes = await transitApi.getRouteById('M1');
        if (defaultVehiclesRes.success && defaultVehiclesRes.route?.liveVehicles) {
          setVehicles(defaultVehiclesRes.route.liveVehicles);
        }
      } catch (err) {
        console.error('Initial data loading error:', err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    initData();
  }, []);

  // 2. Connect to MongoDB Live Change Streams via Server-Sent Events (SSE)
  useEffect(() => {
    console.log('[SSE] Connecting to MongoDB Live Transit Stream at /api/live/stream...');
    const eventSource = new EventSource('/api/live/stream');

    eventSource.addEventListener('telemetry', (e) => {
      try {
        const payload = JSON.parse(e.data);
        const data = payload.data;
        if (!data || !data.metadata) return;

        const updatedVehicleId = data.metadata.vehicleId;
        const updatedLocation = data.location;
        const updatedOccupancy = data.occupancy;
        const updatedCrowd = data.crowdLevel;
        const updatedSpeed = data.speed;
        const updatedDelay = data.delaySeconds;
        const updatedStatus = data.status;

        setVehicles((prev) => {
          const idx = prev.findIndex((v) => v.vehicleId === updatedVehicleId);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = {
              ...copy[idx],
              location: updatedLocation,
              occupancy: updatedOccupancy,
              crowdLevel: updatedCrowd,
              speedKmH: updatedSpeed,
              delaySeconds: updatedDelay,
              status: updatedStatus,
              updatedAt: new Date().toISOString(),
            };
            return copy;
          } else {
            // New vehicle detected in stream
            return [
              ...prev,
              {
                _id: data._id,
                vehicleId: updatedVehicleId,
                routeId: data.metadata.routeId,
                currentStopId: data.metadata.stopId || 'STP-001',
                nextStopId: 'STP-002',
                location: updatedLocation,
                heading: 0,
                speedKmH: updatedSpeed,
                occupancy: updatedOccupancy,
                crowdLevel: updatedCrowd,
                delaySeconds: updatedDelay,
                status: updatedStatus,
                updatedAt: new Date().toISOString(),
              },
            ];
          }
        });
      } catch (err) {
        console.warn('[SSE] Error parsing telemetry event:', err);
      }
    });

    eventSource.onerror = () => {
      // Browser will auto reconnect
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F19] text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        onOpenAuthModal={() => setAuthModalOpen(true)}
      />

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isInitialLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-mono tracking-wide">
              Connecting to MongoDB Atlas & transit clusters...
            </p>
          </div>
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <Dashboard
                onNavigateTab={(tab) => setCurrentTab(tab)}
                stops={stops}
                vehicles={vehicles}
              />
            )}

            {currentTab === 'plan' && (
              <PlanTrip stops={stops} vehicles={vehicles} />
            )}

            {currentTab === 'live-map' && (
              <LiveMap stops={stops} vehicles={vehicles} routes={routes} />
            )}

            {currentTab === 'trips' && (
              <MyTrips
                currentUser={currentUser}
                onNavigateTab={(tab) => setCurrentTab(tab)}
              />
            )}

            {currentTab === 'analytics' && <Analytics />}

            {currentTab === 'intelligence' && <IntelligenceCenter />}

            {currentTab === 'query-lab' && <QueryLab />}
          </>
        )}
      </main>

      {/* Application Footer */}
      <Footer />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(user) => setCurrentUser(user)}
      />
    </div>
  );
}

export default App;
