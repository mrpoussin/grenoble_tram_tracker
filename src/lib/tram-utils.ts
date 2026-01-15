import { TrackPoint } from './types';

export function formatArrival(arrivalTime: number): string {
  const now = Date.now();
  const diff = arrivalTime - now;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Now';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

export function getMinutesUntil(arrivalTime: number): number {
  const now = Date.now();
  return Math.floor((arrivalTime - now) / 60000);
}

export function findClosestTrackPoint(
  lat: number,
  lon: number,
  trackShape: TrackPoint[]
): number {
  let minDist = Infinity;
  let closestIndex = 0;

  trackShape.forEach((point, index) => {
    const dist = Math.sqrt(Math.pow(point.lat - lat, 2) + Math.pow(point.lon - lon, 2));
    if (dist < minDist) {
      minDist = dist;
      closestIndex = index;
    }
  });

  return closestIndex;
}

export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);

  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

export function getTrackDirection(
  pointIndex: number,
  direction: string,
  trackShape: TrackPoint[]
): number | null {
  if (trackShape.length < 2) return null;

  // Direction 1 = toward higher sequence (Gières)
  // Direction 2 = toward lower sequence (Le Prisme)
  const lookAhead = 5;

  if (direction === '1') {
    // Going toward Gières (higher seq)
    const nextIndex = Math.min(pointIndex + lookAhead, trackShape.length - 1);
    if (nextIndex === pointIndex) return null;

    return calculateBearing(
      trackShape[pointIndex].lat,
      trackShape[pointIndex].lon,
      trackShape[nextIndex].lat,
      trackShape[nextIndex].lon
    );
  } else {
    // Going toward Le Prisme (lower seq)
    const prevIndex = Math.max(pointIndex - lookAhead, 0);
    if (prevIndex === pointIndex) return null;

    return calculateBearing(
      trackShape[pointIndex].lat,
      trackShape[pointIndex].lon,
      trackShape[prevIndex].lat,
      trackShape[prevIndex].lon
    );
  }
}
