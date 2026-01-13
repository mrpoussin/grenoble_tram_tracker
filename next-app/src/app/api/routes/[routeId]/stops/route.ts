import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://data.mobilites-m.fr/api';
const HEADERS = {
  Origin: 'https://www.mobilites-m.fr',
};

interface StopData {
  id: string;
  name: string;
  lat: number;
  lon: number;
  cluster: string;
  routes: Array<{ shortName: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const { routeId } = await params;
    const res = await fetch(`${API_BASE}/routers/default/index/routes/${routeId}/clusters`, {
      headers: HEADERS,
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data: StopData[] = await res.json();

    // Sort stops by latitude (north to south for Tram C)
    const sortedStops = data
      .filter((stop) => stop.routes?.some((r) => r.shortName === 'C'))
      .sort((a, b) => b.lat - a.lat)
      .map((stop) => ({
        id: stop.id,
        name: stop.name,
        lat: stop.lat,
        lon: stop.lon,
        cluster: stop.cluster,
      }));

    return NextResponse.json(sortedStops);
  } catch (error) {
    console.error('Error fetching stops:', error);
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 });
  }
}
