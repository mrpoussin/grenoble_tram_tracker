const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const API_BASE = 'https://data.mobilites-m.fr/api';
const API_URL = `${API_BASE}/dyn/trr/json`;

// Helper function to fetch with required headers
async function fetchWithHeaders(url) {
    return fetch(url, {
        headers: {
            'Origin': 'https://www.mobilites-m.fr',
            'Accept': 'application/json'
        }
    });
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to fetch transit line status
app.get('/api/transit', async (req, res) => {
    try {
        const response = await fetchWithHeaders(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching transit data:', error);
        res.status(500).json({ error: 'Failed to fetch transit data' });
    }
});

// API endpoint to fetch all routes/lines
app.get('/api/routes', async (req, res) => {
    try {
        const response = await fetchWithHeaders(`${API_BASE}/routers/default/index/routes`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching routes:', error);
        res.status(500).json({ error: 'Failed to fetch routes' });
    }
});

// API endpoint to fetch stops for a specific line
app.get('/api/routes/:routeId/stops', async (req, res) => {
    try {
        const { routeId } = req.params;
        const response = await fetchWithHeaders(`${API_BASE}/routers/default/index/routes/${encodeURIComponent(routeId)}/stops`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching stops:', error);
        res.status(500).json({ error: 'Failed to fetch stops' });
    }
});

// API endpoint to fetch stop times for a cluster (zone d'arrêt)
app.get('/api/stoptimes/:clusterId', async (req, res) => {
    try {
        const { clusterId } = req.params;
        const response = await fetchWithHeaders(`${API_BASE}/routers/default/index/clusters/${encodeURIComponent(clusterId)}/stoptimes`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching stop times:', error);
        res.status(500).json({ error: 'Failed to fetch stop times' });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚊 Grenoble Tram Tracker running at http://localhost:${PORT}`);
});
