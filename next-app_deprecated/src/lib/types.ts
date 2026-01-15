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
  realtime: boolean;
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

// Direction 1 = Toward Gières (east/south-east)
// Direction 2 = Toward Le Prisme (west/north-west)
export const DIRECTION_COLORS: Record<number, string> = {
  1: '#38ef7d', // Green - Gières
  2: '#f5576c', // Red - Le Prisme
};

export const DIRECTION_NAMES: Record<number, string> = {
  1: 'GIÈRES',
  2: 'LE PRISME',
};
