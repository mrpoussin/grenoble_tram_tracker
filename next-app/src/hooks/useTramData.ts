import { useState, useEffect, useCallback } from 'react';
import { Stop, ProcessedArrival, TrackPoint } from '@/lib/types';

export function useTramData(routeId: string) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStops() {
      try {
        setLoading(true);
        const res = await fetch(`/api/routes/${encodeURIComponent(routeId)}/stops`);
        if (!res.ok) throw new Error('Failed to fetch stops');
        const data = await res.json();
        setStops(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchStops();
  }, [routeId]);

  const fetchStoptimes = useCallback(async (clusterId: string): Promise<ProcessedArrival[] | null> => {
    try {
      const res = await fetch(`/api/stoptimes/${encodeURIComponent(clusterId)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  return { stops, loading, error, fetchStoptimes };
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    // Initialize from localStorage on first render (client-side only)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tramC_favorites');
      if (stored) {
        try {
          return new Set(JSON.parse(stored));
        } catch {
          // Invalid stored data
        }
      }
    }
    return new Set();
  });

  const toggleFavorite = useCallback((clusterId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      localStorage.setItem('tramC_favorites', JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}

export function useTrackShape() {
  const [trackShape, setTrackShape] = useState<TrackPoint[]>([]);

  useEffect(() => {
    async function loadShape() {
      try {
        const res = await fetch('/tram_c_shape.json');
        if (res.ok) {
          const data = await res.json();
          setTrackShape(data);
        }
      } catch {
        // Shape data not available
      }
    }

    loadShape();
  }, []);

  return trackShape;
}
