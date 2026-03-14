/**
 * Operations API Routes
 * 
 * Adapted for Person 1's multi-item schema (receipts/deliveries/transfers/adjustments).
 * All routes require authentication.
 */

const express = require('express');
const router = express.Router();

const { authenticate, authorizeRoles } = require('../middleware/auth');
const receipts = require('../operations/receipts');
const deliveries = require('../operations/deliveries');
const transfers = require('../operations/transfers');
const adjustments = require('../operations/adjustments');

// All operation routes require authentication
router.use(authenticate);

// ─────────────────────────────────────────────
// RECEIPTS
// ─────────────────────────────────────────────

// Create a new receipt (with items)
router.post('/receipts',
    authorizeRoles('inventory_manager', 'warehouse_staff', 'admin'),
    async (req, res, next) => {
        try {
            const { supplier, items } = req.body;
            const result = await receipts.createReceipt({
                supplier,
                items,
                userId: req.user.id,
            });
            res.status(201).json(result);
        } catch (err) {
            next(err);
        }
    }
);

// Update receipt status (draft → ready → done)
router.patch('/receipts/:id/status',
    authorizeRoles('inventory_manager', 'warehouse_staff', 'admin'),
    async (req, res, next) => {
        try {
            const { status } = req.body;
            const result = await receipts.updateReceiptStatus(
                req.params.id,
                status,
                req.user.id
            );
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// Get single receipt
router.get('/receipts/:id', async (req, res, next) => {
    try {
        const receipt = await receipts.getById(req.params.id);
        if (!receipt) return res.status(404).json({ success: false, error: 'Receipt not found' });
        res.json({ success: true, receipt });
    } catch (err) {
        next(err);
    }
});

// List receipts
router.get('/receipts', async (req, res, next) => {
    try {
        const { status, limit, offset } = req.query;
        const result = await receipts.listReceipts({
            status,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// DELIVERIES
// ─────────────────────────────────────────────

// Create a new delivery (with items)
router.post('/deliveries',
    authorizeRoles('inventory_manager', 'warehouse_staff', 'admin'),
    async (req, res, next) => {
        try {
            const { customer, items } = req.body;
            const result = await deliveries.createDelivery({
                customer,
                items,
                userId: req.user.id,
            });
            res.status(201).json(result);
        } catch (err) {
            next(err);
        }
    }
);

// Update delivery status
router.patch('/deliveries/:id/status',
    authorizeRoles('inventory_manager', 'warehouse_staff', 'admin'),
    async (req, res, next) => {
        try {
            const { status } = req.body;
            const result = await deliveries.updateDeliveryStatus(
                req.params.id,
                status,
                req.user.id
            );
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// Get single delivery
router.get('/deliveries/:id', async (req, res, next) => {
    try {
        const delivery = await deliveries.getById(req.params.id);
        if (!delivery) return res.status(404).json({ success: false, error: 'Delivery not found' });
        res.json({ success: true, delivery });
    } catch (err) {
        next(err);
    }
});

// List deliveries
router.get('/deliveries', async (req, res, next) => {
    try {
        const { status, limit, offset } = req.query;
        const result = await deliveries.listDeliveries({
            status,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// TRANSFERS
// ─────────────────────────────────────────────

// Create a new transfer (with items)
router.post('/transfers',
    authorizeRoles('inventory_manager', 'warehouse_staff', 'admin'),
    async (req, res, next) => {
        try {
            const { from_location, to_location, items } = req.body;
            const result = await transfers.createTransfer({
                fromLocation: from_location,
                toLocation: to_location,
                items,
                userId: req.user.id,
            });
            res.status(201).json(result);
        } catch (err) {
            next(err);
        }
    }
);

// Execute a transfer (validates stock and performs zero-sum movement)
router.post('/transfers/:id/execute',
    authorizeRoles('inventory_manager', 'warehouse_staff', 'admin'),
    async (req, res, next) => {
        try {
            const result = await transfers.executeTransfer(
                req.params.id,
                req.user.id
            );
            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// Get single transfer
router.get('/transfers/:id', async (req, res, next) => {
    try {
        const transfer = await transfers.getById(req.params.id);
        if (!transfer) return res.status(404).json({ success: false, error: 'Transfer not found' });
        res.json({ success: true, transfer });
    } catch (err) {
        next(err);
    }
});

// List transfers
router.get('/transfers', async (req, res, next) => {
    try {
        const { limit, offset } = req.query;
        const result = await transfers.listTransfers({
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────
// ADJUSTMENTS
// ─────────────────────────────────────────────

// Create an inventory adjustment
router.post('/adjustments',
    authorizeRoles('inventory_manager', 'warehouse_staff', 'admin'),
    async (req, res, next) => {
        try {
            const { product_id, location_id, quantity_change, physicalCount, reason } = req.body;
            const result = await adjustments.createAdjustment({
                product_id,
                location_id,
                quantity_change,
                physicalCount,
                reason,
                userId: req.user.id,
            });
            res.status(201).json(result);
        } catch (err) {
            next(err);
        }
    }
);

// Get single adjustment
router.get('/adjustments/:id', async (req, res, next) => {
    try {
        const adjustment = await adjustments.getById(req.params.id);
        if (!adjustment) return res.status(404).json({ success: false, error: 'Adjustment not found' });
        res.json({ success: true, adjustment });
    } catch (err) {
        next(err);
    }
});

// List adjustments
router.get('/adjustments', async (req, res, next) => {
    try {
        const { limit, offset } = req.query;
        const result = await adjustments.listAdjustments({
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
