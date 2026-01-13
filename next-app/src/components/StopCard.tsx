'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Stop, StopArrivals, ProcessedArrival, TrackPoint, DIRECTION_COLORS, DIRECTION_NAMES } from '@/lib/types';
import { formatArrival, getMinutesUntil } from '@/lib/tram-utils';

// Dynamically import map component to avoid SSR issues
const StopMap = dynamic(() => import('./StopMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-800 rounded-lg animate-pulse" />,
});

interface StopCardProps {
  stop: Stop;
  arrivals?: StopArrivals;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  trackShape: TrackPoint[];
}

export default function StopCard({
  stop,
  arrivals,
  isFavorite,
  onToggleFavorite,
  trackShape,
}: StopCardProps) {
  const bearing = arrivals?.bearing ?? null;

  // Determine column order based on bearing
  // If bearing is 0-180 (east), direction 1 (Gières) goes on the right
  // If bearing is 180-360 (west), direction 1 (Gières) goes on the left
  const dir1OnLeft = bearing !== null && bearing > 180;

  const leftColumn = dir1OnLeft
    ? { dir: 1, arrivals: arrivals?.direction1 ?? [] }
    : { dir: 2, arrivals: arrivals?.direction2 ?? [] };

  const rightColumn = dir1OnLeft
    ? { dir: 2, arrivals: arrivals?.direction2 ?? [] }
    : { dir: 1, arrivals: arrivals?.direction1 ?? [] };

  return (
    <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#C20078] flex items-center justify-center font-bold text-sm">
              C
            </div>
            <CardTitle className="text-lg font-semibold text-white">{stop.name}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFavorite}
            className={isFavorite ? 'text-yellow-400' : 'text-zinc-500 hover:text-yellow-400'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill={isFavorite ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr_150px] gap-4">
          {/* Arrivals columns */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: DIRECTION_COLORS[leftColumn.dir] }}
                />
                <span className="text-xs font-medium text-zinc-400">
                  → {DIRECTION_NAMES[leftColumn.dir]}
                </span>
              </div>
              {leftColumn.arrivals.length > 0 ? (
                leftColumn.arrivals.slice(0, 3).map((arr, idx) => (
                  <ArrivalBadge key={idx} arrival={arr} direction={leftColumn.dir} />
                ))
              ) : (
                <span className="text-sm text-zinc-500">No arrivals</span>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: DIRECTION_COLORS[rightColumn.dir] }}
                />
                <span className="text-xs font-medium text-zinc-400">
                  → {DIRECTION_NAMES[rightColumn.dir]}
                </span>
              </div>
              {rightColumn.arrivals.length > 0 ? (
                rightColumn.arrivals.slice(0, 3).map((arr, idx) => (
                  <ArrivalBadge key={idx} arrival={arr} direction={rightColumn.dir} />
                ))
              ) : (
                <span className="text-sm text-zinc-500">No arrivals</span>
              )}
            </div>
          </div>

          {/* Mini Map */}
          <div className="h-32 rounded-lg overflow-hidden">
            <StopMap stop={stop} trackShape={trackShape} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ArrivalBadge({ arrival, direction }: { arrival: ProcessedArrival; direction: number }) {
  const minutes = getMinutesUntil(arrival.arrivalTime);
  const isImminent = minutes <= 2;

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 rounded-md"
      style={{
        background: `${DIRECTION_COLORS[direction]}20`,
        borderLeft: `3px solid ${DIRECTION_COLORS[direction]}`,
      }}
    >
      <span
        className={`text-lg font-bold tabular-nums ${isImminent ? 'animate-pulse' : ''}`}
        style={{ color: DIRECTION_COLORS[direction] }}
      >
        {formatArrival(arrival.arrivalTime)}
      </span>
      {arrival.realtime && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-zinc-800">
          LIVE
        </Badge>
      )}
    </div>
  );
}
