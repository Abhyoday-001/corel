/**
 * Inventory Adjustment Operations Module
 * 
 * Adapted for Person 1's schema:
 *   adjustments (id, product_id, location_id, quantity_change, reason, created_at)
 * 
 * Calculates difference, updates stock, writes ledger entry.
 */

const { withTransaction, query } = require('../db/connection');
const { validateProductById, validateLocation } = require('../utils/validators');
const { ValidationError } = require('../utils/errors');
const ledger = require('../services/ledger');

/**
 * Create an inventory adjustment.
 * Can be called in two modes:
 *   1. Direct quantity_change (Person 1's pattern)
 *   2. Physical count vs recorded (Person 3's mandate)
 */
async function createAdjustment({ product_id, location_id, quantity_change, physicalCount, reason, userId }) {
    await validateProductById(product_id);
    await validateLocation(location_id);

    let delta;
    let computedReason = reason;

    if (physicalCount !== undefined && physicalCount !== null) {
        // Person 3 mode: calculate difference from physical count
        const parsedCount = Number(physicalCount);
        if (!Number.isInteger(parsedCount) || parsedCount < 0) {
            throw new ValidationError(`Physical count must be a non-negative integer. Received: ${physicalCount}`);
        }

        // Get current recorded stock
        const stockRes = await query(
            'SELECT quantity FROM stock WHERE product_id = $1 AND location_id = $2',
            [product_id, location_id]
        );
        const recordedQty = stockRes.rows.length > 0 ? stockRes.rows[0].quantity : 0;
        delta = parsedCount - recordedQty;

        if (delta === 0) {
            return {
                success: true,
                message: 'No adjustment needed. Physical count matches recorded stock.',
                adjustment: { product_id, location_id, recordedQty, physicalCount: parsedCount, difference: 0 },
            };
        }

        computedReason = reason || `Adjustment: recorded=${recordedQty}, physical=${parsedCount}, diff=${delta}`;
    } else if (quantity_change !== undefined && quantity_change !== null) {
        // Person 1 mode: direct delta
        delta = Number(quantity_change);
        if (!Number.isInteger(delta)) {
            throw new ValidationError(`quantity_change must be an integer. Received: ${quantity_change}`);
        }
    } else {
        throw new ValidationError('Either quantity_change or physicalCount is required.');
    }

    return await withTransaction(async (client) => {
        // Insert adjustment record
        const adjRes = await client.query(
            `INSERT INTO adjustments (product_id, location_id, quantity_change, reason)
             VALUES ($1, $2, $3, $4)
             RETURNING id, product_id, location_id, quantity_change, reason, created_at`,
            [product_id, location_id, delta, computedReason || null]
        );
        const adjustment = adjRes.rows[0];

        // Update stock (upsert with delta, clamp to >= 0)
        const currentStockRes = await client.query(
            'SELECT quantity FROM stock WHERE product_id = $1 AND location_id = $2 FOR UPDATE',
            [product_id, location_id]
        );
        const currentQty = currentStockRes.rows.length > 0 ? currentStockRes.rows[0].quantity : 0;
        const newQty = Math.max(0, currentQty + delta);

        await client.query(
            `INSERT INTO stock (product_id, location_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id, location_id)
             DO UPDATE SET quantity = $3, updated_at = CURRENT_TIMESTAMP`,
            [product_id, location_id, newQty]
        );

        // Write ledger entry
        await ledger.logEntry(client, {
            productId: product_id,
            locationId: location_id,
            operationType: 'adjustment',
            quantityChange: delta,
            referenceId: adjustment.id,
        });

        return {
            success: true,
            message: `Adjustment completed. Stock changed by ${delta > 0 ? '+' : ''}${delta}.`,
            adjustment,
            newStockLevel: newQty,
        };
    });
}

/**
 * Get all adjustments.
 */
async function listAdjustments({ limit = 50, offset = 0 } = {}) {
    const result = await query(
        `SELECT a.id, a.product_id, a.location_id, a.quantity_change, a.reason, a.created_at,
                p.name AS product_name, p.sku, l.name AS location_name
         FROM adjustments a
         LEFT JOIN products p ON p.id = a.product_id
         LEFT JOIN locations l ON l.id = a.location_id
         ORDER BY a.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    return {
        success: true,
        adjustments: result.rows,
        count: result.rowCount,
    };
}

/**
 * Get adjustment by ID.
 */
async function getById(id) {
    const result = await query(
        `SELECT a.id, a.product_id, a.location_id, a.quantity_change, a.reason, a.created_at,
                p.name AS product_name, p.sku, l.name AS location_name
         FROM adjustments a
         LEFT JOIN products p ON p.id = a.product_id
         LEFT JOIN locations l ON l.id = a.location_id
         WHERE a.id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

module.exports = {
    createAdjustment,
    listAdjustments,
    getById,
};
