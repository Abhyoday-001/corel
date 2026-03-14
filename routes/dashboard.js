/**
 * Dashboard API Routes
 * 
 * Adapted for Person 1's schema.
 */

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const dashboard = require('../services/dashboard');
const ledgerService = require('../services/ledger');
const { validateProductById } = require('../utils/validators');

// All dashboard routes require authentication
router.use(authenticate);

// GET /api/dashboard/kpis
router.get('/kpis', async (req, res, next) => {
    try {
        const result = await dashboard.getKPIs();
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// GET /api/dashboard/low-stock
router.get('/low-stock', async (req, res, next) => {
    try {
        const result = await dashboard.getLowStockItems();
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// GET /api/dashboard/stock-overview
router.get('/stock-overview', async (req, res, next) => {
    try {
        const result = await dashboard.getStockOverview();
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// GET /api/dashboard/ledger/:productId
router.get('/ledger/:productId', async (req, res, next) => {
    try {
        const productId = parseInt(req.params.productId, 10);
        await validateProductById(productId);
        const { limit, offset } = req.query;
        const result = await ledgerService.getHistory(productId, {
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
        });
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
});

// GET /api/dashboard/ledger
router.get('/ledger', async (req, res, next) => {
    try {
        const { operationType, limit, offset } = req.query;
        const result = await ledgerService.getAllHistory({
            operationType,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
        });
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
