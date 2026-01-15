'use client';

import dynamic from 'next/dynamic';

// Dynamically import TramTracker to avoid SSR issues with Leaflet
const TramTracker = dynamic(() => import('@/components/TramTracker'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-xl bg-[#C20078] flex items-center justify-center font-bold text-3xl text-white mx-auto mb-4">
          C
        </div>
        <p className="text-zinc-400">Loading Tram C Tracker...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <TramTracker />;
}
