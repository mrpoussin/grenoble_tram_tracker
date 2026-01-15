export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  cluster: string;
}

export interface ProcessedArrival {
  headsign: string;
  direction: number;
  arrivalTime: number;
  scheduledTime?: number;
  realtime: boolean;
  delay?: number; // in seconds, positive = late, negative = early
  destination?: string;
  tripId?: string;
  realtimeState?: string;
}

export interface StopArrivals {
  direction1: ProcessedArrival[];
  direction2: ProcessedArrival[];
  bearing: number | null;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  seq: number;
}

// Air quality data
export interface AirQualityData {
  today: {
    index: number;
    quality: string;
    color: string;
    pollutants: string[];
    subIndices: Array<{
      polluant_nom: string;
      concentration: number;
      indice: number;
    }>;
  } | null;
  tomorrow: {
    index: number;
    quality: string;
    color: string;
  } | null;
  comment: string | null;
}

// Route info
export interface RouteInfo {
  route: {
    id: string;
    shortName: string;
    longName: string;
    color: string;
    textColor: string;
    mode: string;
  } | null;
  facts: {
    inaugurated: string;
    length: string;
    stops: number;
    frequency: string;
    firstTram: string;
    lastTram: string;
    color: string;
    terminus: string[];
  };
}

// Direction 1 = Toward Gières (east/south-east)
// Direction 2 = Toward Le Prisme (west/north-west)
export const DIRECTION_COLORS: Record<number, string> = {
  1: '#3b82f6', // Blue - Gières
  2: '#ec4899', // Pink - Le Prisme
};

// Get color based on arrival time (green = soon, orange = medium, red = far)
export function getArrivalColor(minutes: number): string {
  if (minutes <= 3) return '#22c55e'; // Green - arriving soon
  if (minutes <= 7) return '#f97316'; // Orange - medium wait
  return '#ef4444'; // Red - longer wait
}

// Get delay display text
export function getDelayText(delaySeconds: number): string {
  if (delaySeconds === 0) return '';
  const mins = Math.round(delaySeconds / 60);
  if (mins === 0) return '';
  if (mins > 0) return `+${mins}min`;
  return `${mins}min`;
}

// Get delay color
export function getDelayColor(delaySeconds: number): string {
  if (delaySeconds <= -60) return '#22c55e'; // Early - green
  if (delaySeconds <= 60) return '#a1a1aa'; // On time - gray
  if (delaySeconds <= 180) return '#f97316'; // Slightly late - orange
  return '#ef4444'; // Late - red
}

export const DIRECTION_NAMES: Record<number, string> = {
  1: 'GIÈRES',
  2: 'LE PRISME',
};
