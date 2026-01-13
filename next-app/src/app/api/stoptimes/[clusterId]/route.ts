import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://data.mobilites-m.fr/api';
const HEADERS = {
  Origin: 'https://www.mobilites-m.fr',
};

interface StoptimeData {
  times: Array<{
    stopId: string;
    realtime: boolean;
    realtimeArrival: number;
    realtimeDeparture: number;
    serviceDay: number;
    tripId: string;
    headsign: string;
    directionId: number;
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

    // Process and flatten arrivals
    const arrivals = data.flatMap((pattern) =>
      pattern.times.map((time) => {
        const arrivalTime = (time.serviceDay + time.realtimeArrival) * 1000;
        return {
          headsign: time.headsign,
          direction: time.directionId,
          arrivalTime,
          realtime: time.realtime,
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
