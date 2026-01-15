'use client';

import { useState, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Stop, StopArrivals, ProcessedArrival, TrackPoint, AirQualityData, DIRECTION_COLORS, DIRECTION_NAMES, getArrivalColor, getDelayText, getDelayColor } from '@/lib/types';
import { getMinutesUntil } from '@/lib/tram-utils';

const FullscreenMap = dynamic(() => import('./FullscreenMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-900 animate-pulse" />,
});

// Separate clock component - only this re-renders every second
function Clock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <p className="text-zinc-400">
      {currentTime.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}
    </p>
  );
}

// Arrival time display - updates independently
function ArrivalTime({ arrival, isPrimary }: { arrival: ProcessedArrival | undefined; isPrimary: boolean }) {
  const [minutes, setMinutes] = useState<number | null>(
    arrival ? getMinutesUntil(arrival.arrivalTime) : null
  );

  useEffect(() => {
    if (!arrival) {
      setMinutes(null);
      return;
    }

    // Update immediately
    setMinutes(getMinutesUntil(arrival.arrivalTime));

    // Then update every second
    const timer = setInterval(() => {
      setMinutes(getMinutesUntil(arrival.arrivalTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [arrival]);

  if (minutes === null) {
    return isPrimary ? <span className="text-6xl text-zinc-600">--</span> : null;
  }

  const delayText = arrival?.delay ? getDelayText(arrival.delay) : '';
  const delayColor = arrival?.delay ? getDelayColor(arrival.delay) : '#a1a1aa';

  if (isPrimary) {
    return (
      <div className="flex flex-col items-start">
        <span
          className={`text-8xl font-black tabular-nums leading-none ${minutes <= 2 ? 'animate-pulse' : ''}`}
          style={{ color: getArrivalColor(minutes) }}
        >
          {minutes <= 0 ? 'NOW' : `${minutes}'`}
        </span>
        {delayText && (
          <span className="text-lg font-medium" style={{ color: delayColor }}>
            {delayText}
          </span>
        )}
      </div>
    );
  }

  return (
    <span
      className="text-5xl font-bold tabular-nums"
      style={{ color: getArrivalColor(minutes) }}
    >
      {minutes}'
    </span>
  );
}

// Air quality widget
function AirQualityWidget() {
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);

  useEffect(() => {
    async function fetchAirQuality() {
      try {
        const res = await fetch('/api/airquality');
        if (res.ok) {
          const data = await res.json();
          setAirQuality(data);
        }
      } catch (error) {
        console.error('Failed to fetch air quality:', error);
      }
    }
    fetchAirQuality();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAirQuality, 300000);
    return () => clearInterval(interval);
  }, []);

  if (!airQuality?.today) return null;

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
        style={{ background: airQuality.today.color }}
      >
        {airQuality.today.index}
      </div>
      <div className="text-sm">
        <div className="text-white font-medium">Air: {airQuality.today.quality}</div>
        <div className="text-zinc-400 text-xs">
          {airQuality.today.pollutants?.slice(0, 2).join(', ')}
        </div>
      </div>
    </div>
  );
}

// Stats widget showing line statistics
function StatsWidget({ stopArrivals }: { stopArrivals: Map<string, StopArrivals> }) {
  // Calculate some stats
  const allArrivals: ProcessedArrival[] = [];
  stopArrivals.forEach((arrivals) => {
    allArrivals.push(...arrivals.direction1, ...arrivals.direction2);
  });

  const realtimeCount = allArrivals.filter(a => a.realtime).length;
  const totalCount = allArrivals.length;
  const avgDelay = allArrivals.reduce((sum, a) => sum + (a.delay || 0), 0) / (totalCount || 1);

  const nextArrivals = allArrivals
    .filter(a => a.arrivalTime > Date.now())
    .sort((a, b) => a.arrivalTime - b.arrivalTime);

  const nextTram = nextArrivals[0];
  const nextMinutes = nextTram ? getMinutesUntil(nextTram.arrivalTime) : null;

  return (
    <div className="grid grid-cols-4 gap-4 text-center">
      <div>
        <div className="text-3xl font-bold text-white">{Math.round(realtimeCount / (totalCount || 1) * 100)}%</div>
        <div className="text-xs text-zinc-400">Live Data</div>
      </div>
      <div>
        <div className="text-3xl font-bold" style={{ color: getDelayColor(avgDelay) }}>
          {avgDelay > 0 ? '+' : ''}{Math.round(avgDelay / 60)}
        </div>
        <div className="text-xs text-zinc-400">Avg Delay (min)</div>
      </div>
      <div>
        <div className="text-3xl font-bold text-white">{totalCount}</div>
        <div className="text-xs text-zinc-400">Tracked Trams</div>
      </div>
      <div>
        <div className="text-3xl font-bold" style={{ color: nextMinutes !== null ? getArrivalColor(nextMinutes) : '#a1a1aa' }}>
          {nextMinutes !== null ? `${nextMinutes}'` : '--'}
        </div>
        <div className="text-xs text-zinc-400">Next Tram</div>
      </div>
    </div>
  );
}

// Memoized stop row - only re-renders when arrivals change
const StopRow = memo(function StopRow({
  stop,
  arrivals,
}: {
  stop: Stop;
  arrivals: StopArrivals | undefined;
}) {
  const bearing = arrivals?.bearing ?? null;
  const dir1OnLeft = bearing !== null && bearing > 180;

  const leftColumn = dir1OnLeft
    ? { dir: 1, arrivals: arrivals?.direction1 ?? [] }
    : { dir: 2, arrivals: arrivals?.direction2 ?? [] };

  const rightColumn = dir1OnLeft
    ? { dir: 2, arrivals: arrivals?.direction2 ?? [] }
    : { dir: 1, arrivals: arrivals?.direction1 ?? [] };

  return (
    <div className="bg-zinc-900 rounded-2xl px-8 py-4 border border-zinc-800 flex items-center min-h-[calc((100%-24px)/4)]">
      {/* Stop Name */}
      <div className="w-80 flex items-center gap-4 shrink-0">
        <div className="w-14 h-14 rounded-xl bg-[#C20078] flex items-center justify-center font-bold text-3xl">
          C
        </div>
        <h2 className="text-3xl font-bold text-white truncate">{stop.name}</h2>
      </div>

      {/* Left Direction */}
      <div className="flex-1 flex items-center gap-6">
        <div
          className="w-6 h-6 rounded-full shrink-0"
          style={{ background: DIRECTION_COLORS[leftColumn.dir] }}
        />
        <span className="text-2xl text-zinc-300 w-40 shrink-0">
          {DIRECTION_NAMES[leftColumn.dir]}
        </span>
        <div className="flex items-baseline gap-4">
          <ArrivalTime arrival={leftColumn.arrivals[0]} isPrimary={true} />
          <ArrivalTime arrival={leftColumn.arrivals[1]} isPrimary={false} />
        </div>
      </div>

      {/* Right Direction */}
      <div className="flex-1 flex items-center gap-6 justify-end">
        <div className="flex items-baseline gap-4">
          <ArrivalTime arrival={rightColumn.arrivals[1]} isPrimary={false} />
          <ArrivalTime arrival={rightColumn.arrivals[0]} isPrimary={true} />
        </div>
        <span className="text-2xl text-zinc-300 w-40 text-right shrink-0">
          {DIRECTION_NAMES[rightColumn.dir]}
        </span>
        <div
          className="w-6 h-6 rounded-full shrink-0"
          style={{ background: DIRECTION_COLORS[rightColumn.dir] }}
        />
      </div>
    </div>
  );
});

// Memoized map component
const MemoizedMap = memo(function MemoizedMap({
  stops,
  trackShape,
}: {
  stops: Stop[];
  trackShape: TrackPoint[];
}) {
  return <FullscreenMap stops={stops} trackShape={trackShape} />;
});

interface FullscreenDashboardProps {
  stops: Stop[];
  stopArrivals: Map<string, StopArrivals>;
  trackShape: TrackPoint[];
  onClose: () => void;
}

export default function FullscreenDashboard({
  stops,
  stopArrivals,
  trackShape,
  onClose,
}: FullscreenDashboardProps) {
  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#C20078] flex items-center justify-center font-bold text-2xl">
            C
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Tram C Dashboard</h1>
            <Clock />
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          Exit Fullscreen
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
        {/* Stop Arrivals - 2/3 of screen, max 4 rows */}
        <div className="flex-[2] overflow-y-auto">
          <div className="h-full flex flex-col gap-2">
            {stops.map((stop) => (
              <StopRow
                key={stop.cluster}
                stop={stop}
                arrivals={stopArrivals.get(stop.cluster)}
              />
            ))}
          </div>
        </div>

        {/* Bottom Panel - Map + Info */}
        <div className="flex-1 flex gap-4">
          {/* Map - 2/3 of bottom */}
          <div className="flex-[2] bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
            <MemoizedMap stops={stops} trackShape={trackShape} />
          </div>

          {/* Info Panel - 1/3 of bottom */}
          <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex flex-col gap-4 overflow-hidden">
            {/* Air Quality */}
            <div className="flex items-center justify-between">
              <AirQualityWidget />
              <div className="text-right">
                <div className="text-xs text-zinc-500">TRAM C</div>
                <div className="text-sm text-zinc-300">Grenoble</div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-800" />

            {/* Stats */}
            <StatsWidget stopArrivals={stopArrivals} />

            {/* Divider */}
            <div className="border-t border-zinc-800" />

            {/* Line Info */}
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-zinc-400 text-xs mb-1">🕐 Hours</div>
                  <div className="text-white font-medium">05:00 - 01:00</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-zinc-400 text-xs mb-1">⏱️ Frequency</div>
                  <div className="text-white font-medium">4-8 min</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-zinc-400 text-xs mb-1">📏 Length</div>
                  <div className="text-white font-medium">11.1 km</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-zinc-400 text-xs mb-1">🚏 Stops</div>
                  <div className="text-white font-medium">21 stops</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 col-span-2">
                  <div className="text-zinc-400 text-xs mb-1">🎂 Inaugurated</div>
                  <div className="text-white font-medium">October 28, 2006</div>
                </div>
              </div>

              {/* Terminus */}
              <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg">
                <div className="text-zinc-400 text-xs mb-2">🚊 Terminus</div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ background: DIRECTION_COLORS[2] }} />
                  <span className="text-white">Le Prisme</span>
                  <span className="text-zinc-500 flex-1 text-center">↔</span>
                  <span className="text-white">Condillac</span>
                  <div className="w-3 h-3 rounded-full" style={{ background: DIRECTION_COLORS[1] }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
