/**
 * Inventory Operations Engine — Server Entry Point
 * 
 * Integrated with Person 1's coreinventory database.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const { generateToken } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { checkConnection } = require('./db/connection');
const operationsRoutes = require('./routes/operations');
const dashboardRoutes = require('./routes/dashboard');
const dataRoutes = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Person 4's frontend from public/
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        next();
    });
}

// CORS
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
    } else {
        res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// ─── ROUTES ───

// Health check
app.get('/api/health', async (req, res) => {
    res.status(200).json({
        success: true,
        service: 'Inventory Operations Engine (Person 3)',
        database: 'in-memory (mocked)',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
    });
});

// Dev token generator
if (process.env.NODE_ENV !== 'production') {
    app.post('/api/dev/token', (req, res) => {
        const { id = 1, email = 'manager@ims.local', role = 'inventory_manager' } = req.body || {};
        const token = generateToken({ id, email, role });
        res.json({
            success: true,
            message: 'Dev token generated. Use in Authorization: Bearer <token>',
            token,
            user: { id, email, role },
        });
    });
}

// ─── API ROUTES (IN-MEMORY DEMO MODE) ───

// Auth Routes (Tanya's integration ported to in-memory)
const authRoutes = require('./routes/authMemory');
app.use('/api/auth', authRoutes);

// Protect all other /api routes
app.use('/api', authRoutes.requireAuth);

// Main Inventory Routes
const memoryRoutes = require('./routes/memory');
app.use('/api', memoryRoutes);

// 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: { type: 'NotFoundError', message: `Route ${req.method} ${req.url} not found.` },
    });
});

// Global error handler
app.use(errorHandler);

// ─── START ───
async function start() {
    app.listen(PORT, () => {
        console.log('╔══════════════════════════════════════════════╗');
        console.log('║   Inventory Operations Engine v2.0.0         ║');
        console.log(`║   Listening on port ${PORT}                     ║`);
        console.log('║   Running in MOCK/IN-MEMORY Demo Mode        ║');
        console.log('╚══════════════════════════════════════════════╝');
        console.log('');
        console.log('Endpoints:');
        console.log('  GET    /api/health');
        console.log('  POST   /api/dev/token              (dev only)');
        console.log('  GET    /api/dashboard/kpis');
        console.log('  GET    /api/dashboard/low-stock');
        console.log('  GET    /api/dashboard/stock-overview');
        console.log('  GET    /api/dashboard/ledger');
        console.log('  POST   /api/operations/receipts');
        console.log('  PATCH  /api/operations/receipts/:id/status');
        console.log('  POST   /api/operations/deliveries');
        console.log('  PATCH  /api/operations/deliveries/:id/status');
        console.log('  POST   /api/operations/transfers');
        console.log('  POST   /api/operations/transfers/:id/execute');
        console.log('  POST   /api/operations/adjustments');
    });
}

if (process.env.NODE_ENV !== 'test') {
    start().catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = app;
