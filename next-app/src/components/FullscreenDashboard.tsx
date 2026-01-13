'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Stop, StopArrivals, TrackPoint, DIRECTION_COLORS, DIRECTION_NAMES } from '@/lib/types';
import { getMinutesUntil } from '@/lib/tram-utils';

const FullscreenMap = dynamic(() => import('./FullscreenMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-900 animate-pulse" />,
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
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#C20078] flex items-center justify-center font-bold text-2xl">
            C
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tram C Dashboard</h1>
            <p className="text-zinc-400">
              {currentTime.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </p>
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
      <div className="flex-1 grid grid-cols-[1fr_400px] gap-6 p-6 overflow-hidden">
        {/* Stop Arrivals */}
        <div className="overflow-y-auto space-y-6">
          {stops.map((stop) => {
            const arrivals = stopArrivals.get(stop.cluster);
            const bearing = arrivals?.bearing ?? null;
            const dir1OnLeft = bearing !== null && bearing > 180;

            const leftColumn = dir1OnLeft
              ? { dir: 1, arrivals: arrivals?.direction1 ?? [] }
              : { dir: 2, arrivals: arrivals?.direction2 ?? [] };

            const rightColumn = dir1OnLeft
              ? { dir: 2, arrivals: arrivals?.direction2 ?? [] }
              : { dir: 1, arrivals: arrivals?.direction1 ?? [] };

            return (
              <div
                key={stop.cluster}
                className="bg-zinc-900 rounded-xl p-6 border border-zinc-800"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[#C20078] flex items-center justify-center font-bold text-lg">
                    C
                  </div>
                  <h2 className="text-2xl font-bold">{stop.name}</h2>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div>
                    <div
                      className="flex items-center gap-2 mb-4 pb-2 border-b"
                      style={{ borderColor: DIRECTION_COLORS[leftColumn.dir] }}
                    >
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ background: DIRECTION_COLORS[leftColumn.dir] }}
                      />
                      <span className="text-xl font-semibold">
                        → {DIRECTION_NAMES[leftColumn.dir]}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {leftColumn.arrivals.length > 0 ? (
                        leftColumn.arrivals.slice(0, 3).map((arr, idx) => {
                          const minutes = getMinutesUntil(arr.arrivalTime);
                          const isImminent = minutes <= 2;
                          return (
                            <div
                              key={idx}
                              className={`text-5xl font-bold tabular-nums ${
                                isImminent ? 'animate-pulse' : ''
                              }`}
                              style={{ color: DIRECTION_COLORS[leftColumn.dir] }}
                            >
                              {minutes <= 0 ? 'NOW' : `${minutes} min`}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-2xl text-zinc-500">No arrivals</div>
                      )}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div>
                    <div
                      className="flex items-center gap-2 mb-4 pb-2 border-b"
                      style={{ borderColor: DIRECTION_COLORS[rightColumn.dir] }}
                    >
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ background: DIRECTION_COLORS[rightColumn.dir] }}
                      />
                      <span className="text-xl font-semibold">
                        → {DIRECTION_NAMES[rightColumn.dir]}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {rightColumn.arrivals.length > 0 ? (
                        rightColumn.arrivals.slice(0, 3).map((arr, idx) => {
                          const minutes = getMinutesUntil(arr.arrivalTime);
                          const isImminent = minutes <= 2;
                          return (
                            <div
                              key={idx}
                              className={`text-5xl font-bold tabular-nums ${
                                isImminent ? 'animate-pulse' : ''
                              }`}
                              style={{ color: DIRECTION_COLORS[rightColumn.dir] }}
                            >
                              {minutes <= 0 ? 'NOW' : `${minutes} min`}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-2xl text-zinc-500">No arrivals</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Map */}
        <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
          <FullscreenMap stops={stops} trackShape={trackShape} />
        </div>
      </div>
    </div>
  );
}
