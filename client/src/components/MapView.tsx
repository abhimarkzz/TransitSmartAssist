import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Stop, Vehicle, RouteCandidateResult } from '../types';
import { Eye, Layers, Compass, Zap } from 'lucide-react';

interface MapViewProps {
  stops: Stop[];
  vehicles: Vehicle[];
  selectedRoute?: RouteCandidateResult | null;
  originCoords?: [number, number] | null;
  destCoords?: [number, number] | null;
  originName?: string;
  destName?: string;
  onSelectStop?: (stop: Stop) => void;
  height?: string;
}

export const MapView: React.FC<MapViewProps> = ({
  stops,
  vehicles,
  selectedRoute,
  originCoords,
  destCoords,
  originName = 'Origin',
  destName = 'Destination',
  onSelectStop,
  height = '500px',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);

  const [showStops, setShowStops] = useState(true);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Centered at MetroCity Central Hub [-73.9851, 40.7488] -> Leaflet takes [lat, lng]!
    const map = L.map(mapContainerRef.current, {
      center: [40.7488, -73.9851],
      zoom: 13,
      zoomControl: false,
    });

    // Sleek CartoDB Dark Matter tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    stopsLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render Transit Stops
  useEffect(() => {
    if (!stopsLayerRef.current) return;
    stopsLayerRef.current.clearLayers();

    if (!showStops) return;

    stops.forEach((stop) => {
      const [lng, lat] = stop.location.coordinates;
      const crowdColor =
        stop.currentCrowdLevel === 'LOW'
          ? '#10B981'
          : stop.currentCrowdLevel === 'MODERATE'
          ? '#F59E0B'
          : stop.currentCrowdLevel === 'HIGH'
          ? '#EF4444'
          : '#A855F7';

      const icon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div style="
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: ${crowdColor};
            border: 2px solid #0B0F19;
            box-shadow: 0 0 6px ${crowdColor}80;
            cursor: pointer;
          "></div>
        `,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const marker = L.marker([lat, lng], { icon });

      const amenitiesHtml = (stop.amenities || [])
        .map(
          (a) =>
            `<span style="background: #1E293B; color: #94A3B8; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 4px;">${a}</span>`
        )
        .join('');

      marker.bindPopup(`
        <div style="font-family: inherit; min-width: 200px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <strong style="color: #F8FAFC; font-size: 13px;">${stop.name}</strong>
            <span style="background: ${crowdColor}20; color: ${crowdColor}; font-size: 10px; padding: 1px 6px; border-radius: 9999px; font-weight: 600;">
              ${stop.currentCrowdLevel}
            </span>
          </div>
          <p style="color: #94A3B8; font-size: 11px; margin: 0 0 6px 0;">Zone: ${stop.zone} | Code: ${stop.code}</p>
          <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;">
            ${amenitiesHtml}
          </div>
          <div style="font-size: 11px; color: #38BDF8; font-weight: 500;">
            Connecting: ${(stop.connectingRoutes || []).join(', ') || 'Local Line'}
          </div>
        </div>
      `);

      if (onSelectStop) {
        marker.on('click', () => onSelectStop(stop));
      }

      stopsLayerRef.current?.addLayer(marker);
    });
  }, [stops, showStops, onSelectStop]);

  // Render Active Moving Vehicles
  useEffect(() => {
    if (!vehiclesLayerRef.current) return;
    vehiclesLayerRef.current.clearLayers();

    if (!showVehicles) return;

    vehicles.forEach((veh) => {
      const [lng, lat] = veh.location.coordinates;
      const crowdColor =
        veh.crowdLevel === 'LOW'
          ? '#10B981'
          : veh.crowdLevel === 'MODERATE'
          ? '#3B82F6'
          : veh.crowdLevel === 'HIGH'
          ? '#F59E0B'
          : '#EF4444';

      const icon = L.divIcon({
        className: 'custom-vehicle-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            background: #111827;
            border: 2px solid ${crowdColor};
            color: #F8FAFC;
            border-radius: 8px;
            padding: 2px 5px;
            font-size: 10px;
            font-weight: 700;
            box-shadow: 0 0 10px ${crowdColor}60;
            white-space: nowrap;
            cursor: pointer;
          ">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${crowdColor}; margin-right: 4px; display: inline-block;"></span>
            ${veh.routeId}
          </div>
        `,
        iconSize: [40, 20],
        iconAnchor: [20, 10],
      });

      const marker = L.marker([lat, lng], { icon });

      marker.bindPopup(`
        <div style="font-family: inherit; min-width: 180px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <strong style="color: #F8FAFC; font-size: 13px;">${veh.vehicleId}</strong>
            <span style="color: ${crowdColor}; font-weight: 700; font-size: 11px;">${veh.routeId}</span>
          </div>
          <div style="font-size: 11px; color: #94A3B8; margin-bottom: 6px;">
            Speed: <span style="color: #F1F5F9; font-weight: 600;">${veh.speedKmH} km/h</span> |
            Occupancy: <span style="color: ${crowdColor}; font-weight: 600;">${veh.occupancy}%</span>
          </div>
          <div style="font-size: 11px; color: #94A3B8;">
            Delay: <span style="color: ${veh.delaySeconds > 120 ? '#EF4444' : '#10B981'}; font-weight: 600;">${Math.round(veh.delaySeconds / 60)} min</span> |
            Status: <span style="color: #F1F5F9;">${veh.status}</span>
          </div>
        </div>
      `);

      vehiclesLayerRef.current?.addLayer(marker);
    });
  }, [vehicles, showVehicles]);

  // Render Selected Route Polyline
  useEffect(() => {
    if (!mapRef.current) return;

    if (routePolylineRef.current) {
      mapRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (!selectedRoute || !selectedRoute.geometry || !showRoutes) return;

    // Convert GeoJSON [lng, lat] coordinates to Leaflet [lat, lng]
    const latLngs: L.LatLngExpression[] = selectedRoute.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng]
    );

    const polyline = L.polyline(latLngs, {
      color: selectedRoute.color || '#3B82F6',
      weight: 5,
      opacity: 0.85,
      dashArray: selectedRoute.type === 'EXPRESS' ? '8, 8' : undefined,
    }).addTo(mapRef.current);

    routePolylineRef.current = polyline;

    // Fit map bounds to route
    mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  }, [selectedRoute, showRoutes]);

  // Render Origin and Destination Markers
  useEffect(() => {
    if (!mapRef.current) return;

    if (originMarkerRef.current) {
      mapRef.current.removeLayer(originMarkerRef.current);
      originMarkerRef.current = null;
    }
    if (destMarkerRef.current) {
      mapRef.current.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }

    if (originCoords) {
      const [lng, lat] = originCoords;
      const originIcon = L.divIcon({
        className: 'origin-marker',
        html: `
          <div style="
            width: 22px;
            height: 22px;
            background: #10B981;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 14px #10B981;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            font-size: 10px;
            font-weight: 800;
          ">A</div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = L.marker([lat, lng], { icon: originIcon }).addTo(mapRef.current);
      marker.bindPopup(`<strong style="color: #10B981;">Departure:</strong> ${originName}`);
      originMarkerRef.current = marker;
    }

    if (destCoords) {
      const [lng, lat] = destCoords;
      const destIcon = L.divIcon({
        className: 'dest-marker',
        html: `
          <div style="
            width: 22px;
            height: 22px;
            background: #EF4444;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 14px #EF4444;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            font-size: 10px;
            font-weight: 800;
          ">B</div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = L.marker([lat, lng], { icon: destIcon }).addTo(mapRef.current);
      marker.bindPopup(`<strong style="color: #EF4444;">Destination:</strong> ${destName}`);
      destMarkerRef.current = marker;
    }
  }, [originCoords, destCoords, originName, destName]);

  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.setView([40.7488, -73.9851], 13);
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950" style={{ height }}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Floating Controls */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col space-y-2">
        {/* Layer Toggles */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-xl flex items-center space-x-1">
          <button
            onClick={() => setShowVehicles(!showVehicles)}
            title="Toggle Live Vehicles"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
              showVehicles ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>Vehicles ({vehicles.length})</span>
          </button>

          <button
            onClick={() => setShowStops(!showStops)}
            title="Toggle Transit Stops"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
              showStops ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Stops ({stops.length})</span>
          </button>

          <button
            onClick={handleResetView}
            title="Recenter Map"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selected Route Info Overlay */}
      {selectedRoute && (
        <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-2xl max-w-sm">
          <div className="flex items-center space-x-2 mb-1">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedRoute.color }}
            ></span>
            <span className="text-xs font-bold text-white">{selectedRoute.name}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            ETA: <span className="text-emerald-400 font-semibold">{selectedRoute.travelMinutes} mins</span> |
            Walk: <span className="text-blue-400 font-semibold">{selectedRoute.walkingDistanceMeters}m</span> |
            Crowd: <span className="text-amber-400 font-semibold">{selectedRoute.crowdLevel}</span>
          </p>
        </div>
      )}
    </div>
  );
};
