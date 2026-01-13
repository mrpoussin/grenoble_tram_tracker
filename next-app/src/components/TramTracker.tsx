'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProcessedArrival, StopArrivals, DIRECTION_COLORS, DIRECTION_NAMES } from '@/lib/types';
import { useTramData, useFavorites, useTrackShape } from '@/hooks/useTramData';
import { findClosestTrackPoint, calculateBearing } from '@/lib/tram-utils';
import StopCard from '@/components/StopCard';

// Dynamically import components that use Leaflet to avoid SSR issues
const FullscreenDashboard = dynamic(() => import('@/components/FullscreenDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-zinc-950">
      <div className="text-white text-xl">Loading map...</div>
    </div>
  ),
});

const ROUTE_ID = 'SEM:C';

export default function TramTracker() {
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stopArrivals, setStopArrivals] = useState<Map<string, StopArrivals>>(new Map());

  const { stops, loading, error, fetchStoptimes } = useTramData(ROUTE_ID);
  const { favorites, toggleFavorite } = useFavorites();
  const trackShape = useTrackShape();

  // Fetch arrivals for all stops
  const loadArrivals = useCallback(async () => {
    if (stops.length === 0) return;

    const newArrivals = new Map<string, StopArrivals>();

    await Promise.all(
      stops.map(async (stop) => {
        const arrivals = await fetchStoptimes(stop.cluster);
        if (arrivals) {
          // Separate by direction
          const dir1: ProcessedArrival[] = [];
          const dir2: ProcessedArrival[] = [];

          arrivals.forEach((arr: ProcessedArrival) => {
            if (String(arr.direction) === '1') {
              dir1.push(arr);
            } else {
              dir2.push(arr);
            }
          });

          // Calculate bearing for stop
          let bearing: number | null = null;
          if (trackShape.length > 0) {
            const pointIndex = findClosestTrackPoint(stop.lat, stop.lon, trackShape);
            if (pointIndex < trackShape.length - 1) {
              bearing = calculateBearing(
                trackShape[pointIndex].lat,
                trackShape[pointIndex].lon,
                trackShape[pointIndex + 1].lat,
                trackShape[pointIndex + 1].lon
              );
            }
          }

          newArrivals.set(stop.cluster, {
            direction1: dir1.slice(0, 3),
            direction2: dir2.slice(0, 3),
            bearing,
          });
        }
      })
    );

    setStopArrivals(newArrivals);
  }, [stops, fetchStoptimes, trackShape]);

  // Initial load and refresh interval
  useEffect(() => {
    if (stops.length > 0) {
      loadArrivals();
      const interval = setInterval(loadArrivals, 30000);
      return () => clearInterval(interval);
    }
  }, [stops, loadArrivals]);

  // Get favorite stops
  const favoriteStops = stops.filter((stop) => favorites.has(stop.cluster));

  if (isFullscreen && favoriteStops.length > 0) {
    return (
      <FullscreenDashboard
        stops={favoriteStops}
        stopArrivals={stopArrivals}
        trackShape={trackShape}
        onClose={() => setIsFullscreen(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#C20078] flex items-center justify-center font-bold text-xl">
                C
              </div>
              <div>
                <h1 className="text-xl font-bold">Tram C Tracker</h1>
                <p className="text-sm text-zinc-400">Grenoble · Real-time arrivals</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {favoriteStops.length > 0 && (
                <Button
                  onClick={() => setIsFullscreen(true)}
                  variant="outline"
                  className="border-[#C20078] text-[#C20078] hover:bg-[#C20078] hover:text-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  Fullscreen
                </Button>
              )}
              <Badge variant="secondary" className="bg-zinc-800">
                {stops.length} stops
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-[#C20078] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Loading stops...</p>
            </div>
          </div>
        ) : error ? (
          <Card className="bg-red-900/20 border-red-800">
            <CardContent className="p-6 text-center">
              <p className="text-red-400">{error}</p>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="mt-4 border-red-600 text-red-400"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'favorites')}>
            <div className="flex items-center justify-between mb-6">
              <TabsList className="bg-zinc-800">
                <TabsTrigger value="all" className="data-[state=active]:bg-[#C20078]">
                  All Stops
                </TabsTrigger>
                <TabsTrigger value="favorites" className="data-[state=active]:bg-[#C20078]">
                  Favorites ({favoriteStops.length})
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: DIRECTION_COLORS[1] }} />
                  <span className="text-zinc-400">{DIRECTION_NAMES[1]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: DIRECTION_COLORS[2] }} />
                  <span className="text-zinc-400">{DIRECTION_NAMES[2]}</span>
                </div>
              </div>
            </div>

            <TabsContent value="all" className="mt-0">
              <div className="grid gap-4">
                {stops.map((stop) => (
                  <StopCard
                    key={stop.cluster}
                    stop={stop}
                    arrivals={stopArrivals.get(stop.cluster)}
                    isFavorite={favorites.has(stop.cluster)}
                    onToggleFavorite={() => toggleFavorite(stop.cluster)}
                    trackShape={trackShape}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="favorites" className="mt-0">
              {favoriteStops.length === 0 ? (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-12 text-center">
                    <div className="text-5xl mb-4">⭐</div>
                    <h3 className="text-xl font-semibold mb-2">No favorites yet</h3>
                    <p className="text-zinc-400">
                      Click the star icon on any stop to add it to your favorites
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {favoriteStops.map((stop) => (
                    <StopCard
                      key={stop.cluster}
                      stop={stop}
                      arrivals={stopArrivals.get(stop.cluster)}
                      isFavorite={true}
                      onToggleFavorite={() => toggleFavorite(stop.cluster)}
                      trackShape={trackShape}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-auto py-4">
        <div className="container mx-auto px-4 text-center text-sm text-zinc-500">
          Data from{' '}
          <a
            href="https://www.mobilites-m.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#C20078] hover:underline"
          >
            Mobilités M
          </a>{' '}
          · Auto-refresh every 30s
        </div>
      </footer>
    </div>
  );
}
