import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://data.mobilites-m.fr/api';
const HEADERS = {
  Origin: 'https://www.mobilites-m.fr',
};

interface StopData {
  id: string;
  code?: string;
  name: string;
  lat: number;
  lon: number;
  cluster?: string;
  routes?: Array<{ shortName: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  console.log('[API /routes/[routeId]/stops] Request received');
  try {
    const { routeId } = await params;
    console.log('[API] Fetching clusters for routeId:', routeId);
    
    const apiUrl = `${API_BASE}/routers/default/index/routes/${routeId}/clusters`;
    console.log('[API] External API URL:', apiUrl);
    
    const res = await fetch(apiUrl, {
      headers: HEADERS,
    });

    console.log('[API] External API response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[API] External API error:', errorText);
      throw new Error(`API error: ${res.status}`);
    }

    const data: StopData[] = await res.json();
    console.log('[API] Raw data received:', data.length, 'stops');
    console.log('[API] Sample stop data:', JSON.stringify(data[0], null, 2));

    // Sort stops by latitude (north to south for Tram C)
    // Note: The API already returns stops for this route, no need to filter by shortName
    // Use 'code' field for cluster ID (API returns 'code' not 'cluster')
    // Exclude stops that are actually Tram B stops (Gières Gare, Plaine des Sports)
    const tramBStops = ['SEM:GENGIERGARE', 'SEM:GENPLAINEDS'];
    
    const sortedStops = data
      .filter((stop) => !tramBStops.includes(stop.code || ''))
      .sort((a, b) => b.lat - a.lat)
      .map((stop) => ({
        id: stop.id,
        name: stop.name,
        lat: stop.lat,
        lon: stop.lon,
        cluster: stop.code || stop.cluster || stop.id, // Use code as cluster ID
      }));

    console.log('[API] Sample mapped stop:', sortedStops[0]);
    console.log('[API] Filtered and sorted stops:', sortedStops.length);
    return NextResponse.json(sortedStops);
  } catch (error) {
    console.error('[API] Error fetching stops:', error);
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 });
  }
}
