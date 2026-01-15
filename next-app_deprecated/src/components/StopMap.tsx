'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Stop, TrackPoint, DIRECTION_COLORS } from '@/lib/types';
import { findClosestTrackPoint, getTrackDirection } from '@/lib/tram-utils';

interface StopMapProps {
  stop: Stop;
  trackShape: TrackPoint[];
}

export default function StopMap({ stop, trackShape }: StopMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [stop.lat, stop.lon],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Draw track line
    if (trackShape.length > 0) {
      const trackPoints: [number, number][] = trackShape.map((p) => [p.lat, p.lon]);
      L.polyline(trackPoints, {
        color: '#C20078',
        weight: 3,
        opacity: 0.6,
      }).addTo(map);
    }

    // Stop marker
    L.marker([stop.lat, stop.lon], {
      icon: L.divIcon({
        className: 'stop-marker',
        html: `<div style="
          background: #C20078;
          border: 2px solid white;
          border-radius: 50%;
          width: 12px;
          height: 12px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
    }).addTo(map);

    // Direction arrows
    if (trackShape.length > 0) {
      const trackPointIndex = findClosestTrackPoint(stop.lat, stop.lon, trackShape);

      const bearing1 = getTrackDirection(trackPointIndex, '1', trackShape);
      if (bearing1 !== null) {
        addDirectionArrow(map, stop.lat, stop.lon, bearing1, DIRECTION_COLORS[1], 'GIÈRES');
      }

      const bearing2 = getTrackDirection(trackPointIndex, '2', trackShape);
      if (bearing2 !== null) {
        addDirectionArrow(map, stop.lat, stop.lon, bearing2, DIRECTION_COLORS[2], 'LE PRISME');
      }
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [stop, trackShape]);

  return <div ref={containerRef} className="w-full h-full rounded-lg" />;
}

function addDirectionArrow(
  map: L.Map,
  lat: number,
  lon: number,
  bearing: number,
  color: string,
  label: string
) {
  const distance = 0.0006;
  const arrowLength = 0.0004;

  const bearingRad = (bearing * Math.PI) / 180;
  const latFactor = Math.cos((lat * Math.PI) / 180);

  const startLat = lat + distance * 0.5 * Math.cos(bearingRad);
  const startLon = lon + (distance * 0.5 * Math.sin(bearingRad)) / latFactor;

  const endLat = startLat + arrowLength * Math.cos(bearingRad);
  const endLon = startLon + (arrowLength * Math.sin(bearingRad)) / latFactor;

  // Label position
  const labelOffset = 0.0003;
  const labelLat = endLat + labelOffset * Math.cos(bearingRad);
  const labelLon = endLon + (labelOffset * Math.sin(bearingRad)) / latFactor;

  // Arrow line
  L.polyline([[startLat, startLon], [endLat, endLon]], {
    color,
    weight: 4,
    opacity: 0.9,
  }).addTo(map);

  // Arrow head
  const arrowHead = L.divIcon({
    className: 'arrow-head',
    html: `<div style="
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 10px solid ${color};
      transform: rotate(${bearing}deg);
      transform-origin: center center;
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

  L.marker([endLat, endLon], { icon: arrowHead, interactive: false }).addTo(map);

  // Direction label
  const labelIcon = L.divIcon({
    className: 'direction-label',
    html: `<div style="
      background: ${color};
      color: white;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 700;
      white-space: nowrap;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    ">${label}</div>`,
    iconSize: [60, 16],
    iconAnchor: [30, 8],
  });

  L.marker([labelLat, labelLon], { icon: labelIcon, interactive: false }).addTo(map);
}
