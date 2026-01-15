import { NextResponse } from 'next/server';

const API_BASE = 'https://data.mobilites-m.fr/api';
const ROUTE_ID = 'SEM:C';

export async function GET() {
  try {
    // Get route details
    const routeResponse = await fetch(
      `${API_BASE}/routers/default/index/routes?codes=${ROUTE_ID}`,
      {
        headers: { Origin: 'https://www.mobilites-m.fr' },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    // Get calendar info
    const calendarResponse = await fetch(
      `${API_BASE}/routers/default/index/routes/${ROUTE_ID}/calendar`,
      {
        headers: { Origin: 'https://www.mobilites-m.fr' },
        next: { revalidate: 3600 },
      }
    );

    const routeData = await routeResponse.json();
    const calendarData = await calendarResponse.json();
    
    const route = routeData.value?.[0] || null;
    
    return NextResponse.json({
      route: route ? {
        id: route.id,
        shortName: route.shortName,
        longName: route.longName,
        color: route.color,
        textColor: route.textColor,
        mode: route.mode,
      } : null,
      calendar: {
        startDate: calendarData.startDate,
        endDate: calendarData.endDate,
        serviceDays: calendarData.calendar?.length || 0,
      },
      // Fun facts about Tram C
      facts: {
        inaugurated: '2006-10-28',
        length: '11.1 km',
        stops: 21,
        frequency: '4-8 min',
        firstTram: '05:00',
        lastTram: '01:00',
        color: '#C20078',
        name: 'Line C',
        terminus: ['Seyssins - Le Prisme', 'Saint-Martin-d\'Hères - Condillac-Universités'],
      },
    });
  } catch (error) {
    console.error('Route info API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
