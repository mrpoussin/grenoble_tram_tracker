'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Stop, TrackPoint, DIRECTION_COLORS } from '@/lib/types';
import { findClosestTrackPoint, getTrackDirection } from '@/lib/tram-utils';

interface FullscreenMapProps {
  stops: Stop[];
  trackShape: TrackPoint[];
}

export default function FullscreenMap({ stops, trackShape }: FullscreenMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lon]));

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Draw track line
    if (trackShape.length > 0) {
      const trackPoints: [number, number][] = trackShape.map((p) => [p.lat, p.lon]);
      L.polyline(trackPoints, {
        color: '#C20078',
        weight: 4,
        opacity: 0.6,
      }).addTo(map);
    }

    // Add markers and arrows for each stop
    stops.forEach((stop) => {
      // Stop marker
      const marker = L.marker([stop.lat, stop.lon], {
        icon: L.divIcon({
          className: 'stop-marker',
          html: `<div style="
            background: #C20078;
            border: 3px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
          "></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map);

      marker.bindTooltip(stop.name, {
        permanent: true,
        direction: 'top',
        offset: [0, -10],
        className: 'stop-tooltip',
      });

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
    });

    if (stops.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [stops, trackShape]);

  return <div ref={containerRef} className="w-full h-full" />;
}

function addDirectionArrow(
  map: L.Map,
  lat: number,
  lon: number,
  bearing: number,
  color: string,
  label: string
) {
  const distance = 0.0008;
  const arrowLength = 0.0006;

  const bearingRad = (bearing * Math.PI) / 180;
  const latFactor = Math.cos((lat * Math.PI) / 180);

  const startLat = lat + distance * 0.5 * Math.cos(bearingRad);
  const startLon = lon + (distance * 0.5 * Math.sin(bearingRad)) / latFactor;

  const endLat = startLat + arrowLength * Math.cos(bearingRad);
  const endLon = startLon + (arrowLength * Math.sin(bearingRad)) / latFactor;

  const labelOffset = 0.0004;
  const labelLat = endLat + labelOffset * Math.cos(bearingRad);
  const labelLon = endLon + (labelOffset * Math.sin(bearingRad)) / latFactor;

  L.polyline([[startLat, startLon], [endLat, endLon]], {
    color,
    weight: 5,
    opacity: 0.9,
  }).addTo(map);

  const arrowHead = L.divIcon({
    className: 'arrow-head',
    html: `<div style="
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 12px solid ${color};
      transform: rotate(${bearing}deg);
      transform-origin: center center;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  L.marker([endLat, endLon], { icon: arrowHead, interactive: false }).addTo(map);

  const labelIcon = L.divIcon({
    className: 'direction-label',
    html: `<div style="
      background: ${color};
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">${label}</div>`,
    iconSize: [80, 20],
    iconAnchor: [40, 10],
  });

  L.marker([labelLat, labelLon], { icon: labelIcon, interactive: false }).addTo(map);
}
