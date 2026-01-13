// Tram C Line ID
const TRAM_C_ID = 'SEM:C';

// DOM Elements
const stopsContainer = document.getElementById('stopsContainer');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdateSpan = document.getElementById('lastUpdate');
const directionFilter = document.getElementById('directionFilter');
const tabAllStops = document.getElementById('tabAllStops');
const tabDashboard = document.getElementById('tabDashboard');
const dashboardCount = document.getElementById('dashboardCount');
const dashboardEmpty = document.getElementById('dashboardEmpty');

// Store data globally
let tramCStops = [];
let stopsWithArrivals = {};
let currentView = 'all'; // 'all' or 'dashboard'
let favoriteStops = loadFavorites();
let stopMaps = {}; // Store map instances
let fullscreenMap = null; // Fullscreen map instance
let isFullscreen = false;

// Tram C stops in order from Le Prisme to Condillac (Direction 1)
// This is the actual route order
const TRAM_C_STOP_ORDER = [
    'SEM:GENPRISME',      // Le Prisme
    'SEM:GENMASDESIL',    // Mas des Iles
    'SEM:GENGRANDPRE',    // Grand Pré
    'SEM:GENFAUCONNI',    // Fauconnière
    'SEM:GENSEYHDV',      // Seyssinet-Pariset Hôtel de Ville
    'SEM:GENVALLCATA',    // Vallier - Catane
    'SEM:GENVACA',        // Vallier - Docteur Calmette
    'SEM:GENVALLIBE',     // Vallier - Libération
    'SEM:GENFOCHFERI',    // Foch - Ferrié
    'SEM:GENGUSTRIVE',    // Gustave Rivet
    'SEM:GENCHAVANT',     // Chavant
    'SEM:GENGREHOTEL',    // Grenoble Hôtel de Ville
    'SEM:GENVALMY',       // Flandrin - Valmy
    'SEM:GENPERIBROS',    // Péri - Brossolette
    'SEM:GENNEYRBELL',    // Neyrpic - Belledonne
    'SEM:GENTA',          // Université - Les Taillées
    'SEM:GENGABFAURE',    // Gabriel Fauré - MUSE
    'SEM:GENBIBLIUNI',    // Université - Bibliothèques
    'SEM:GENCONDIUNI',    // Université - Condillac
    'SEM:GENMAYENCIN',    // Mayencin - Champ Roman
    'SEM:GENGIERGARE',    // Gières Gare - Université
    'SEM:GENPLAINEDS'     // Plaine des Sports
];

// Direction colors
const DIRECTION_COLORS = {
    '1': '#38ef7d', // Green - towards Condillac/Gières
    '2': '#f5576c'  // Red - towards Le Prisme
};

// Get stop index in the line order
function getStopIndex(clusterId) {
    return TRAM_C_STOP_ORDER.indexOf(clusterId);
}

// Store stop coordinates by cluster ID for direction calculation
let stopCoordinates = {};

// Store the tram track shape (loaded from GTFS data)
let tramTrackShape = [];

// Load the tram track shape
async function loadTrackShape() {
    try {
        const response = await fetch('/tram_c_shape.json');
        tramTrackShape = await response.json();
        console.log(`Loaded ${tramTrackShape.length} track shape points`);
    } catch (error) {
        console.error('Failed to load track shape:', error);
    }
}

// Find the closest point on the track to a given location
function findClosestTrackPoint(lat, lon) {
    let minDist = Infinity;
    let closestIndex = 0;
    
    for (let i = 0; i < tramTrackShape.length; i++) {
        const point = tramTrackShape[i];
        const dist = Math.sqrt(
            Math.pow(point.lat - lat, 2) + 
            Math.pow((point.lon - lon) * Math.cos(lat * Math.PI / 180), 2)
        );
        if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
        }
    }
    
    return closestIndex;
}

// Get track direction at a specific point index
// Returns bearing in degrees (0 = North, 90 = East, etc.)
function getTrackDirection(pointIndex, direction) {
    // For direction 1 (toward Gières): look at next points
    // For direction 2 (toward Le Prisme): look at previous points
    
    let fromIndex, toIndex;
    
    if (direction === '1') {
        // Direction 1: going forward in the shape (Le Prisme -> Gières)
        fromIndex = Math.max(0, pointIndex - 2);
        toIndex = Math.min(tramTrackShape.length - 1, pointIndex + 3);
    } else {
        // Direction 2: going backward in the shape (Gières -> Le Prisme)
        fromIndex = Math.min(tramTrackShape.length - 1, pointIndex + 2);
        toIndex = Math.max(0, pointIndex - 3);
    }
    
    if (fromIndex === toIndex || !tramTrackShape[fromIndex] || !tramTrackShape[toIndex]) {
        return null;
    }
    
    const from = tramTrackShape[fromIndex];
    const to = tramTrackShape[toIndex];
    
    return calculateBearing(from.lat, from.lon, to.lat, to.lon);
}

// LocalStorage functions
function loadFavorites() {
    try {
        const saved = localStorage.getItem('tramC_favorites');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
}

function saveFavorites() {
    localStorage.setItem('tramC_favorites', JSON.stringify(favoriteStops));
    updateDashboardCount();
}

function toggleFavorite(clusterId) {
    const index = favoriteStops.indexOf(clusterId);
    if (index === -1) {
        favoriteStops.push(clusterId);
    } else {
        favoriteStops.splice(index, 1);
    }
    saveFavorites();
    renderStops();
}

function isFavorite(clusterId) {
    return favoriteStops.includes(clusterId);
}

function updateDashboardCount() {
    dashboardCount.textContent = favoriteStops.length;
}

// Initialize map for a stop
function initStopMap(mapId, stop) {
    // Clean up existing map if any
    if (stopMaps[mapId]) {
        stopMaps[mapId].remove();
        delete stopMaps[mapId];
    }
    
    const mapElement = document.getElementById(mapId);
    if (!mapElement) return;
    
    const lat = stop.lat;
    const lon = stop.lon;
    const clusterId = stop.cluster || stop.id;
    
    // Create map
    const map = L.map(mapId, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false
    }).setView([lat, lon], 16);
    
    // Add tile layer (CartoDB dark theme to match our UI)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);
    
    // Add stop marker
    const stopIcon = L.divIcon({
        className: 'stop-marker',
        html: `<div style="
            width: 12px;
            height: 12px;
            background: #C20078;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    
    L.marker([lat, lon], { icon: stopIcon }).addTo(map);
    
    // Find the closest point on the track
    const trackPointIndex = findClosestTrackPoint(lat, lon);
    
    // Get track direction at this point for each tram direction
    if (tramTrackShape.length > 0) {
        // Direction 1: toward Gières (green)
        const bearing1 = getTrackDirection(trackPointIndex, '1');
        if (bearing1 !== null) {
            addDirectionArrow(map, lat, lon, bearing1, DIRECTION_COLORS['1'], '→ Gières');
        }
        
        // Direction 2: toward Le Prisme (red)
        const bearing2 = getTrackDirection(trackPointIndex, '2');
        if (bearing2 !== null) {
            addDirectionArrow(map, lat, lon, bearing2, DIRECTION_COLORS['2'], '→ Le Prisme');
        }
    }
    
    stopMaps[mapId] = map;
    
    // Force map to recalculate size after render
    setTimeout(() => map.invalidateSize(), 100);
}

// Calculate bearing between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}

// Add direction arrow to map
function addDirectionArrow(map, lat, lon, bearing, color, title) {
    const distance = 0.0006; // ~60m offset for arrow start
    const arrowLength = 0.0005; // ~50m arrow length
    
    // Convert bearing to radians
    // Bearing: 0° = North, 90° = East, 180° = South, 270° = West
    const bearingRad = bearing * Math.PI / 180;
    
    // For latitude: North is positive, so cos(bearing) gives correct direction
    // For longitude: East is positive, so sin(bearing) gives correct direction
    // Longitude needs to be corrected for latitude (cosine factor)
    const latFactor = Math.cos(lat * Math.PI / 180);
    
    // Calculate start point (offset from center in direction of bearing)
    const startLat = lat + (distance * 0.5) * Math.cos(bearingRad);
    const startLon = lon + (distance * 0.5) * Math.sin(bearingRad) / latFactor;
    
    // Calculate end point (further along the bearing)
    const endLat = startLat + arrowLength * Math.cos(bearingRad);
    const endLon = startLon + arrowLength * Math.sin(bearingRad) / latFactor;
    
    // Draw arrow line
    const arrow = L.polyline([[startLat, startLon], [endLat, endLon]], {
        color: color,
        weight: 4,
        opacity: 0.9
    }).addTo(map);
    
    // Add arrowhead - rotate so it points in the direction of travel
    // CSS rotation: 0deg = pointing up, positive = clockwise
    // Bearing: 0deg = North (up), positive = clockwise
    // So we need to rotate the triangle to point in the bearing direction
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
        iconAnchor: [6, 6]
    });
    
    L.marker([endLat, endLon], { icon: arrowHead, title: title }).addTo(map);
}

// Convert seconds since midnight to readable time
function formatSecondsToTime(seconds) {
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Calculate minutes until arrival
function getMinutesUntil(arrivalSeconds, serviceDay) {
    const now = new Date();
    const arrivalTime = new Date(serviceDay * 1000);
    arrivalTime.setHours(0, 0, 0, 0);
    arrivalTime.setSeconds(arrivalSeconds);
    
    const diffMs = arrivalTime - now;
    const diffMinutes = Math.floor(diffMs / 60000);
    
    return diffMinutes;
}

// Format arrival display
function formatArrival(minutes) {
    if (minutes <= 0) return 'Now';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
}

// Get unique stops (deduplicate by cluster, keeping unique direction info)
function getUniqueStops(stops) {
    const clusterMap = new Map();
    
    stops.forEach(stop => {
        const clusterId = stop.cluster || stop.id;
        if (!clusterMap.has(clusterId)) {
            clusterMap.set(clusterId, stop);
        }
    });
    
    return Array.from(clusterMap.values());
}

// Fetch Tram C stops
async function fetchTramCStops() {
    const response = await fetch(`/api/routes/${encodeURIComponent(TRAM_C_ID)}/stops`);
    if (!response.ok) throw new Error('Failed to fetch stops');
    return response.json();
}

// Fetch stop times for a cluster
async function fetchStopTimes(clusterId) {
    try {
        const response = await fetch(`/api/stoptimes/${encodeURIComponent(clusterId)}`);
        if (!response.ok) return [];
        return response.json();
    } catch (err) {
        console.error(`Error fetching times for ${clusterId}:`, err);
        return [];
    }
}

// Filter arrivals for Tram C only
function filterTramCArrivals(arrivals) {
    return arrivals.filter(pattern => {
        const patternId = pattern.pattern?.id || '';
        return patternId.startsWith('SEM:C:');
    });
}

// Create stop card element
function createStopCard(stop, arrivals) {
    const tramCArrivals = filterTramCArrivals(arrivals);
    const directionValue = directionFilter.value;
    
    // Filter by direction if selected
    const filteredArrivals = directionValue === 'all' 
        ? tramCArrivals 
        : tramCArrivals.filter(a => a.pattern?.dir === directionValue);
    
    const card = document.createElement('div');
    card.className = 'stop-card';
    
    const clusterId = stop.cluster || stop.id;
    const isFav = isFavorite(clusterId);
    const mapId = `map-${stop.code || clusterId.replace(/[^a-zA-Z0-9]/g, '')}`;
    
    // Collect all upcoming arrivals separated by direction
    const arrivalsDir1 = []; // Toward Gières
    const arrivalsDir2 = []; // Toward Le Prisme
    
    filteredArrivals.forEach(pattern => {
        const destination = pattern.pattern?.shortDesc || pattern.pattern?.desc || 'Unknown';
        const direction = pattern.pattern?.dir;
        
        pattern.times?.forEach(time => {
            const arrivalSeconds = time.realtimeArrival || time.scheduledArrival;
            const isRealtime = time.realtime === true;
            const minutes = getMinutesUntil(arrivalSeconds, time.serviceDay);
            
            if (minutes >= -1 && minutes < 120) { // Show arrivals in next 2 hours
                const arrivalData = {
                    minutes,
                    destination,
                    direction,
                    isRealtime,
                    time: formatSecondsToTime(arrivalSeconds)
                };
                
                // Direction 1 = toward Gières/Condillac, Direction 2 = toward Le Prisme
                // API returns direction as integer (1 or 2)
                if (direction === 1 || direction === '1') {
                    arrivalsDir1.push(arrivalData);
                } else if (direction === 2 || direction === '2') {
                    arrivalsDir2.push(arrivalData);
                }
            }
        });
    });
    
    // Sort each direction by arrival time (soonest first)
    arrivalsDir1.sort((a, b) => a.minutes - b.minutes);
    arrivalsDir2.sort((a, b) => a.minutes - b.minutes);
    
    // Take first 5 arrivals per direction
    const displayDir1 = arrivalsDir1.slice(0, 5);
    const displayDir2 = arrivalsDir2.slice(0, 5);
    
    // Generate HTML for each column
    const generateColumnHtml = (arrivals, dirColor, dirLabel) => {
        const arrivalsListHtml = arrivals.length > 0 
            ? arrivals.map(arr => `
                <div class="arrival-row">
                    <span class="${arr.isRealtime ? 'realtime-indicator' : 'scheduled-indicator'}"></span>
                    <span class="arrival-time ${arr.isRealtime ? 'realtime' : 'scheduled'}">${formatArrival(arr.minutes)}</span>
                    <span class="arrival-clock">${arr.time}</span>
                </div>
            `).join('')
            : '<div class="no-arrivals">No trams</div>';
        
        return `
            <div class="direction-column">
                <div class="direction-header" style="border-color: ${dirColor}">
                    <div class="direction-arrow-small" style="background: ${dirColor}"></div>
                    <span style="color: ${dirColor}">${dirLabel}</span>
                </div>
                <div class="arrivals-list">
                    ${arrivalsListHtml}
                </div>
            </div>
        `;
    };
    
    const arrivalsHtml = `
        <div class="arrivals-columns">
            ${generateColumnHtml(displayDir1, DIRECTION_COLORS['1'], '→ Gières')}
            ${generateColumnHtml(displayDir2, DIRECTION_COLORS['2'], '→ Le Prisme')}
        </div>
    `;
    
    card.innerHTML = `
        <div class="stop-header">
            <div class="stop-info">
                <div class="stop-name">${stop.name}</div>
                <div class="stop-city">${stop.city}</div>
            </div>
            <button class="favorite-btn ${isFav ? 'favorited' : ''}" data-cluster="${clusterId}" title="${isFav ? 'Remove from dashboard' : 'Add to dashboard'}">
                ${isFav ? '⭐' : '☆'}
            </button>
            <span class="stop-code">#${stop.code}</span>
        </div>
        <div class="stop-card-content">
            <div class="stop-info-section">
                <div class="arrivals-container">
                    ${arrivalsHtml}
                </div>
                <div class="direction-legend">
                    <div class="direction-item">
                        <div class="direction-arrow dir-1"></div>
                        <span style=\"color: ${DIRECTION_COLORS['1']}\">→ Gières</span>
                    </div>
                    <div class="direction-item">
                        <div class="direction-arrow dir-2"></div>
                        <span style="color: ${DIRECTION_COLORS['2']}">→ Le Prisme</span>
                    </div>
                </div>
            </div>
            <div class="stop-map-section">
                <div id="${mapId}" class="stop-map"></div>
            </div>
        </div>
    `;
    
    // Store stop data for map initialization
    card.dataset.mapId = mapId;
    card.dataset.stopLat = stop.lat;
    card.dataset.stopLon = stop.lon;
    card.dataset.stopData = JSON.stringify(stop);
    
    // Add click handler for favorite button
    const favBtn = card.querySelector('.favorite-btn');
    favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(clusterId);
    });
    
    return card;
}

// Render all stops with arrivals
function renderStops() {
    stopsContainer.innerHTML = '';
    dashboardEmpty.classList.add('hidden');
    
    // Add legend
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `
        <div class="legend-item">
            <span class="realtime-indicator"></span>
            <span>Real-time</span>
        </div>
        <div class="legend-item">
            <span class="scheduled-indicator"></span>
            <span>Scheduled</span>
        </div>
        <div class="legend-item">
            <span>☆/⭐</span>
            <span>Add to Dashboard</span>
        </div>
    `;
    stopsContainer.appendChild(legend);
    
    const uniqueStops = getUniqueStops(tramCStops);
    
    // Sort stops by name for consistent display
    uniqueStops.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    
    // Filter for dashboard view
    let stopsToShow = uniqueStops;
    if (currentView === 'dashboard') {
        stopsToShow = uniqueStops.filter(stop => isFavorite(stop.cluster || stop.id));
        
        if (stopsToShow.length === 0) {
            stopsContainer.innerHTML = '';
            dashboardEmpty.classList.remove('hidden');
            return;
        }
    }
    
    stopsToShow.forEach(stop => {
        const arrivals = stopsWithArrivals[stop.cluster] || [];
        const card = createStopCard(stop, arrivals);
        stopsContainer.appendChild(card);
    });
    
    // Initialize maps after cards are in the DOM
    setTimeout(() => {
        // First, build the stopCoordinates lookup from all stops
        stopsToShow.forEach(stop => {
            const clusterId = stop.cluster || stop.id;
            stopCoordinates[clusterId] = { lat: stop.lat, lon: stop.lon };
        });
        
        // Also ensure all unique stops have their coordinates stored
        const uniqueStops = getUniqueStops(tramCStops);
        uniqueStops.forEach(stop => {
            const clusterId = stop.cluster || stop.id;
            if (!stopCoordinates[clusterId]) {
                stopCoordinates[clusterId] = { lat: stop.lat, lon: stop.lon };
            }
        });
        
        // Now initialize maps
        stopsToShow.forEach(stop => {
            const clusterId = stop.cluster || stop.id;
            const mapId = `map-${stop.code || clusterId.replace(/[^a-zA-Z0-9]/g, '')}`;
            initStopMap(mapId, stop);
        });
    }, 50);
}

// Fetch all data
async function fetchAllData() {
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    stopsContainer.innerHTML = '';
    
    try {
        // Fetch Tram C stops
        tramCStops = await fetchTramCStops();
        
        // Get unique clusters
        const uniqueStops = getUniqueStops(tramCStops);
        const clusters = [...new Set(uniqueStops.map(s => s.cluster).filter(Boolean))];
        
        // Fetch stop times for all clusters in parallel (batch of 5)
        stopsWithArrivals = {};
        
        for (let i = 0; i < clusters.length; i += 5) {
            const batch = clusters.slice(i, i + 5);
            const results = await Promise.all(batch.map(c => fetchStopTimes(c)));
            batch.forEach((cluster, idx) => {
                stopsWithArrivals[cluster] = results[idx];
            });
        }
        
        renderStops();
        lastUpdateSpan.textContent = new Date().toLocaleTimeString('fr-FR');
        loading.classList.add('hidden');
        
    } catch (err) {
        console.error('Error fetching data:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

// Tab switching
function switchView(view) {
    currentView = view;
    
    if (view === 'all') {
        tabAllStops.classList.add('active');
        tabDashboard.classList.remove('active');
    } else {
        tabAllStops.classList.remove('active');
        tabDashboard.classList.add('active');
    }
    
    renderStops();
}

// Event listeners
refreshBtn.addEventListener('click', fetchAllData);

directionFilter.addEventListener('change', () => {
    renderStops();
});

tabAllStops.addEventListener('click', () => switchView('all'));
tabDashboard.addEventListener('click', () => switchView('dashboard'));

// Fullscreen button
const btnFullscreen = document.getElementById('btnFullscreen');
btnFullscreen.addEventListener('click', enterFullscreen);

// Fullscreen mode functions
function enterFullscreen() {
    if (favoriteStops.length === 0) {
        alert('Add stops to your dashboard first by clicking the star icon!');
        return;
    }
    
    isFullscreen = true;
    
    // Create fullscreen overlay
    const overlay = document.createElement('div');
    overlay.className = 'fullscreen-overlay';
    overlay.id = 'fullscreenOverlay';
    
    // Get favorite stops data
    const uniqueStops = getUniqueStops(tramCStops);
    const favoriteStopsData = uniqueStops.filter(stop => isFavorite(stop.cluster || stop.id));
    
    // Build arrivals HTML for each stop
    const stopsHtml = favoriteStopsData.map(stop => {
        const arrivals = stopsWithArrivals[stop.cluster] || [];
        const tramCArrivals = arrivals.filter(a => a.pattern?.id?.includes(':C:') || a.pattern?.id?.includes(':C0:') || a.pattern?.id?.includes(':C1:'));
        
        // Separate by direction
        const arrivalsDir1 = [];
        const arrivalsDir2 = [];
        
        tramCArrivals.forEach(pattern => {
            const direction = pattern.pattern?.dir;
            pattern.times?.forEach(time => {
                const arrivalSeconds = time.realtimeArrival || time.scheduledArrival;
                const isRealtime = time.realtime === true;
                const minutes = getMinutesUntil(arrivalSeconds, time.serviceDay);
                
                if (minutes >= -1 && minutes < 120) {
                    const data = {
                        minutes,
                        isRealtime,
                        time: formatSecondsToTime(arrivalSeconds)
                    };
                    if (direction === 1 || direction === '1') arrivalsDir1.push(data);
                    else if (direction === 2 || direction === '2') arrivalsDir2.push(data);
                }
            });
        });
        
        arrivalsDir1.sort((a, b) => a.minutes - b.minutes);
        arrivalsDir2.sort((a, b) => a.minutes - b.minutes);
        
        const dir1Html = arrivalsDir1.slice(0, 2).map(a => `
            <div class="fullscreen-arrival-row">
                <span class="${a.isRealtime ? 'realtime-indicator' : 'scheduled-indicator'}"></span>
                <span class="fullscreen-arrival-time ${a.isRealtime ? 'realtime' : 'scheduled'}">${formatArrival(a.minutes)}</span>
                <span class="fullscreen-arrival-clock">${a.time}</span>
            </div>
        `).join('') || '<div class="fullscreen-arrival-row" style="color: rgba(255,255,255,0.4)">No trams</div>';
        
        const dir2Html = arrivalsDir2.slice(0, 2).map(a => `
            <div class="fullscreen-arrival-row">
                <span class="${a.isRealtime ? 'realtime-indicator' : 'scheduled-indicator'}"></span>
                <span class="fullscreen-arrival-time ${a.isRealtime ? 'realtime' : 'scheduled'}">${formatArrival(a.minutes)}</span>
                <span class="fullscreen-arrival-clock">${a.time}</span>
            </div>
        `).join('') || '<div class="fullscreen-arrival-row" style="color: rgba(255,255,255,0.4)">No trams</div>';
        
        // Determine which direction points more to the right (East) vs left (West)
        // Bearing: 0=North, 90=East(right), 180=South, 270=West(left)
        let dir1OnRight = true; // Default: Gières on right
        
        if (tramTrackShape.length > 0) {
            const trackPointIndex = findClosestTrackPoint(stop.lat, stop.lon);
            const bearing1 = getTrackDirection(trackPointIndex, '1');
            
            if (bearing1 !== null) {
                // If bearing is between 90-270, the arrow points more southward
                // If bearing is between 0-180, the arrow has an eastward (right) component
                // Normalize: 0-180 = right side, 180-360 = left side
                dir1OnRight = (bearing1 >= 0 && bearing1 < 180);
            }
        }
        
        // Build columns based on arrow direction
        const leftColumn = dir1OnRight ? `
            <div class="fullscreen-direction">
                <div class="fullscreen-direction-header" style="border-color: ${DIRECTION_COLORS['2']}">
                    <div class="fullscreen-direction-dot" style="background: ${DIRECTION_COLORS['2']}"></div>
                    <span style="color: ${DIRECTION_COLORS['2']}">→ Le Prisme</span>
                </div>
                <div class="fullscreen-arrivals-list">${dir2Html}</div>
            </div>
        ` : `
            <div class="fullscreen-direction">
                <div class="fullscreen-direction-header" style="border-color: ${DIRECTION_COLORS['1']}">
                    <div class="fullscreen-direction-dot" style="background: ${DIRECTION_COLORS['1']}"></div>
                    <span style="color: ${DIRECTION_COLORS['1']}">→ Gières</span>
                </div>
                <div class="fullscreen-arrivals-list">${dir1Html}</div>
            </div>
        `;
        
        const rightColumn = dir1OnRight ? `
            <div class="fullscreen-direction">
                <div class="fullscreen-direction-header" style="border-color: ${DIRECTION_COLORS['1']}">
                    <div class="fullscreen-direction-dot" style="background: ${DIRECTION_COLORS['1']}"></div>
                    <span style="color: ${DIRECTION_COLORS['1']}">→ Gières</span>
                </div>
                <div class="fullscreen-arrivals-list">${dir1Html}</div>
            </div>
        ` : `
            <div class="fullscreen-direction">
                <div class="fullscreen-direction-header" style="border-color: ${DIRECTION_COLORS['2']}">
                    <div class="fullscreen-direction-dot" style="background: ${DIRECTION_COLORS['2']}"></div>
                    <span style="color: ${DIRECTION_COLORS['2']}">→ Le Prisme</span>
                </div>
                <div class="fullscreen-arrivals-list">${dir2Html}</div>
            </div>
        `;
        
        return `
            <div class="fullscreen-stop-card" data-lat="${stop.lat}" data-lon="${stop.lon}" data-name="${stop.name}">
                <div class="fullscreen-stop-header">
                    <span class="fullscreen-stop-name">${stop.name}</span>
                    <span class="fullscreen-stop-code">#${stop.code}</span>
                </div>
                <div class="fullscreen-directions">
                    ${leftColumn}
                    ${rightColumn}
                </div>
            </div>
        `;
    }).join('');
    
    overlay.innerHTML = `
        <div class="fullscreen-header">
            <div class="fullscreen-title">
                <span class="line-badge tram-c">C</span>
                <h2>Tram C Dashboard</h2>
            </div>
            <div class="fullscreen-time" id="fullscreenTime">${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
            <button class="btn-exit-fullscreen" id="btnExitFullscreen">✕ Exit Fullscreen</button>
        </div>
        <div class="fullscreen-content">
            <div class="fullscreen-arrivals">
                <div class="fullscreen-stops-grid">
                    ${stopsHtml}
                </div>
            </div>
            <div class="fullscreen-map-section">
                <div id="fullscreenMap" class="fullscreen-map"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Initialize fullscreen map
    setTimeout(() => initFullscreenMap(favoriteStopsData), 100);
    
    // Exit button
    document.getElementById('btnExitFullscreen').addEventListener('click', exitFullscreen);
    
    // Update time every second
    const timeInterval = setInterval(() => {
        const timeEl = document.getElementById('fullscreenTime');
        if (timeEl) {
            timeEl.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else {
            clearInterval(timeInterval);
        }
    }, 1000);
    
    // ESC key to exit
    document.addEventListener('keydown', handleEscKey);
}

function handleEscKey(e) {
    if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
    }
}

function exitFullscreen() {
    isFullscreen = false;
    
    // Clean up map
    if (fullscreenMap) {
        fullscreenMap.remove();
        fullscreenMap = null;
    }
    
    // Remove overlay
    const overlay = document.getElementById('fullscreenOverlay');
    if (overlay) {
        overlay.remove();
    }
    
    document.removeEventListener('keydown', handleEscKey);
}

function initFullscreenMap(favoriteStopsData) {
    const mapContainer = document.getElementById('fullscreenMap');
    if (!mapContainer) return;
    
    // Calculate bounds from favorite stops
    const bounds = L.latLngBounds();
    favoriteStopsData.forEach(stop => {
        bounds.extend([stop.lat, stop.lon]);
    });
    
    // Create map
    fullscreenMap = L.map('fullscreenMap', {
        zoomControl: true,
        attributionControl: false
    });
    
    // Add tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(fullscreenMap);
    
    // Draw track line if we have shape data
    if (tramTrackShape.length > 0) {
        const trackPoints = tramTrackShape.map(p => [p.lat, p.lon]);
        L.polyline(trackPoints, {
            color: '#C20078',
            weight: 4,
            opacity: 0.6
        }).addTo(fullscreenMap);
    }
    
    // Add markers for favorite stops with direction arrows
    favoriteStopsData.forEach(stop => {
        const lat = stop.lat;
        const lon = stop.lon;
        
        // Add stop marker
        const marker = L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'fullscreen-stop-marker',
                html: `<div style="
                    background: #C20078;
                    border: 3px solid white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(fullscreenMap);
        
        marker.bindTooltip(stop.name, {
            permanent: true,
            direction: 'top',
            offset: [0, -10],
            className: 'stop-tooltip'
        });
        
        // Add direction arrows based on track shape
        if (tramTrackShape.length > 0) {
            const trackPointIndex = findClosestTrackPoint(lat, lon);
            
            // Direction 1: toward Gières (green)
            const bearing1 = getTrackDirection(trackPointIndex, '1');
            if (bearing1 !== null) {
                addFullscreenDirectionArrow(fullscreenMap, lat, lon, bearing1, DIRECTION_COLORS['1'], 'GIÈRES');
            }
            
            // Direction 2: toward Le Prisme (red)
            const bearing2 = getTrackDirection(trackPointIndex, '2');
            if (bearing2 !== null) {
                addFullscreenDirectionArrow(fullscreenMap, lat, lon, bearing2, DIRECTION_COLORS['2'], 'LE PRISME');
            }
        }
    });
    
    // Fit bounds with padding
    if (favoriteStopsData.length > 0) {
        fullscreenMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Add direction arrow for fullscreen map (larger arrows)
function addFullscreenDirectionArrow(map, lat, lon, bearing, color, destinationName) {
    const distance = 0.0008; // Offset for arrow start
    const arrowLength = 0.0006; // Arrow length
    
    const bearingRad = bearing * Math.PI / 180;
    const latFactor = Math.cos(lat * Math.PI / 180);
    
    // Calculate start point
    const startLat = lat + (distance * 0.5) * Math.cos(bearingRad);
    const startLon = lon + (distance * 0.5) * Math.sin(bearingRad) / latFactor;
    
    // Calculate end point
    const endLat = startLat + arrowLength * Math.cos(bearingRad);
    const endLon = startLon + arrowLength * Math.sin(bearingRad) / latFactor;
    
    // Calculate label position (further along the arrow direction)
    const labelOffset = 0.0004;
    const labelLat = endLat + labelOffset * Math.cos(bearingRad);
    const labelLon = endLon + labelOffset * Math.sin(bearingRad) / latFactor;
    
    // Draw arrow line
    L.polyline([[startLat, startLon], [endLat, endLon]], {
        color: color,
        weight: 5,
        opacity: 0.9
    }).addTo(map);
    
    // Add arrowhead
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
        iconAnchor: [8, 8]
    });
    
    L.marker([endLat, endLon], { icon: arrowHead, interactive: false }).addTo(map);
    
    // Add destination label
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
        ">${destinationName}</div>`,
        iconSize: [80, 20],
        iconAnchor: [40, 10]
    });
    
    L.marker([labelLat, labelLon], { icon: labelIcon, interactive: false }).addTo(map);
}

// Initial load
updateDashboardCount();

// Load track shape first, then fetch data
loadTrackShape().then(() => {
    fetchAllData();
});

// Auto-refresh every 60 seconds
setInterval(fetchAllData, 60000);
