const BASE_URL = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('transit_auth_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('transit_auth_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('transit_auth_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) errorMessage = errorJson.error;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// 1. Auth API
export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  demoLogin: (role: 'commuter' | 'admin' = 'commuter') =>
    request<any>('/auth/demo', { method: 'POST', body: JSON.stringify({ role }) }),
  getProfile: () => request<any>('/auth/me'),
  updatePreferences: (preferences: any) =>
    request<any>('/users/preferences', { method: 'PUT', body: JSON.stringify(preferences) }),
};

// 2. Routes & Stops API
export const transitApi = {
  getRoutes: (params?: { type?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<any>(`/routes${query ? `?${query}` : ''}`);
  },
  getRouteById: (routeId: string) => request<any>(`/routes/${routeId}`),
  getStops: (params?: { zone?: string; accessible?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<any>(`/stops${query ? `?${query}` : ''}`);
  },
  getNearbyStops: (lng: number, lat: number, maxDistance = 1500) =>
    request<any>(`/stops/nearby?lng=${lng}&lat=${lat}&maxDistance=${maxDistance}`),
};

// 3. Recommendations & AI API
export const recommendationsApi = {
  getRecommendations: (payload: {
    originCoords: [number, number];
    destCoords: [number, number];
    originName?: string;
    destName?: string;
    preferences?: any;
  }) => request<any>('/recommendations', { method: 'POST', body: JSON.stringify(payload) }),

  explainRecommendation: (payload: {
    recommended: any;
    alternatives: any[];
    preferences: any;
    originName?: string;
    destName?: string;
  }) => request<any>('/recommendations/explain', { method: 'POST', body: JSON.stringify(payload) }),
};

// 4. Saved Trips API (ACID Transaction)
export const tripsApi = {
  saveTrip: (tripData: any) =>
    request<any>('/trips/save', { method: 'POST', body: JSON.stringify(tripData) }),
  getSavedTrips: () => request<any>('/trips'),
  deleteSavedTrip: (tripId: string) =>
    request<any>(`/trips/${tripId}`, { method: 'DELETE' }),
};

// 5. Analytics API (MongoDB Aggregation Pipelines)
export const analyticsApi = {
  getKpis: () => request<any>('/analytics/kpis'),
  getDelayByRoute: () => request<any>('/analytics/delay-by-route'),
  getPeakHours: () => request<any>('/analytics/peak-hours'),
  getBusiestStops: () => request<any>('/analytics/busiest-stops'),
  getPreferences: () => request<any>('/analytics/preferences'),
  getMaterializedStats: () => request<any>('/analytics/materialized'),
};

// 6. Search & Vector Search API
export const searchApi = {
  search: (query: string, type?: string) => {
    const params = new URLSearchParams({ q: query });
    if (type) params.append('type', type);
    return request<any>(`/search?${params.toString()}`);
  },
  vectorSearch: (query: string) =>
    request<any>('/vector-search', { method: 'POST', body: JSON.stringify({ query }) }),
};

// 7. Live Stream & Simulation API
export const liveApi = {
  toggleSimulation: () => request<any>('/live/simulation/toggle', { method: 'POST' }),
  getSimulationStatus: () => request<any>('/live/simulation/status'),
  getActiveAlerts: () => request<any>('/live/alerts'),
};

// 8. MongoDB Intelligence & Query Lab API
export const mongoApi = {
  getIntelligenceCards: () => request<any>('/mongodb/intelligence'),
  runQueryLabDemo: (demoId: number) => request<any>(`/mongodb/query-lab/${demoId}`),
  getExplainStats: (collection = 'vehicles', routeId = 'M1') =>
    request<any>(`/mongodb/explain?collection=${collection}&routeId=${routeId}`),
  getIndexes: () => request<any>('/mongodb/indexes'),
};
