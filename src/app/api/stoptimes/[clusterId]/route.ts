import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://data.mobilites-m.fr/api';
const HEADERS = {
  Origin: 'https://www.mobilites-m.fr',
};

interface StoptimeData {
  pattern: {
    id: string;
    desc: string;
    shortDesc: string;
    dir: number;
    lastStop: string;
    lastStopName: string;
  };
  times: Array<{
    stopId: string;
    stopName: string;
    realtime: boolean;
    realtimeArrival: number;
    realtimeDeparture: number;
    scheduledArrival: number;
    scheduledDeparture: number;
    arrivalDelay: number;
    departureDelay: number;
    serviceDay: number;
    tripId: string;
    realtimeState: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  try {
    const { clusterId } = await params;
    const res = await fetch(`${API_BASE}/routers/default/index/clusters/${clusterId}/stoptimes`, {
      headers: HEADERS,
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data: StoptimeData[] = await res.json();

    // Filter to only include Tram C patterns (pattern id starting with SEM:C:)
    const tramCPatterns = data.filter((pattern) => 
      pattern.pattern.id.startsWith('SEM:C:')
    );

    // Process and flatten arrivals - direction comes from pattern.dir
    const arrivals = tramCPatterns.flatMap((pattern) =>
      pattern.times.map((time) => {
        const arrivalTime = (time.serviceDay + time.realtimeArrival) * 1000;
        const scheduledTime = (time.serviceDay + time.scheduledArrival) * 1000;
        return {
          headsign: pattern.pattern.desc || pattern.pattern.shortDesc,
          direction: pattern.pattern.dir,
          arrivalTime,
          scheduledTime,
          realtime: time.realtime,
          // Delay in seconds (positive = late, negative = early)
          delay: time.arrivalDelay || 0,
          // Destination info
          destination: pattern.pattern.lastStopName || pattern.pattern.desc,
          tripId: time.tripId,
          realtimeState: time.realtimeState,
        };
      })
    );

    // Sort by arrival time
    arrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);

    return NextResponse.json(arrivals);
  } catch (error) {
    console.error('Error fetching stoptimes:', error);
    return NextResponse.json({ error: 'Failed to fetch stoptimes' }, { status: 500 });
  }
}
