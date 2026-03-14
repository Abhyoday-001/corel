/**
 * Internal Transfer Operations Module
 * 
 * Adapted for Person 1's schema:
 *   transfers (id, from_location, to_location, created_at)
 *   transfer_items (id, transfer_id, product_id, quantity)
 * 
 * ZERO-SUM operation: total system stock doesn't change.
 * On "Done": single transaction subtracts from source, adds to destination.
 */

const { withTransaction, query } = require('../db/connection');
const { validateProductById, validateLocation, validatePositiveQty, validateTransfer } = require('../utils/validators');
const { ValidationError, InsufficientStockError } = require('../utils/errors');
const ledger = require('../services/ledger');

/**
 * Create a new transfer with items.
 */
async function createTransfer({ fromLocation, toLocation, items, userId }) {
    if (!fromLocation || !toLocation) {
        throw new ValidationError('Both from_location and to_location are required.');
    }
    if (Number(fromLocation) === Number(toLocation)) {
        throw new ValidationError('Source and destination locations must be different.');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new ValidationError('At least one item is required.');
    }

    await validateLocation(fromLocation);
    await validateLocation(toLocation);
    for (const item of items) {
        await validateProductById(item.product_id);
        validatePositiveQty(item.quantity);
    }

    return await withTransaction(async (client) => {
        const transferRes = await client.query(
            `INSERT INTO transfers (from_location, to_location) 
             VALUES ($1, $2) 
             RETURNING id, from_location, to_location, created_at`,
            [fromLocation, toLocation]
        );
        const transfer = transferRes.rows[0];

        for (const item of items) {
            await client.query(
                `INSERT INTO transfer_items (transfer_id, product_id, quantity) 
                 VALUES ($1, $2, $3)`,
                [transfer.id, item.product_id, parseInt(item.quantity)]
            );
        }

        return {
            success: true,
            message: 'Internal transfer created.',
            transfer: await getById(transfer.id),
        };
    });
}

/**
 * Execute a transfer — performs zero-sum stock movement in a single transaction.
 * Validates all items have sufficient stock at source before moving any.
 */
async function executeTransfer(transferId, userId) {
    const transfer = await validateTransfer(transferId);

    return await withTransaction(async (client) => {
        const itemsRes = await client.query(
            'SELECT * FROM transfer_items WHERE transfer_id = $1',
            [transferId]
        );

        // ─── STEP 1: Validate stock for ALL items ───
        for (const item of itemsRes.rows) {
            const stockRes = await client.query(
                `SELECT quantity FROM stock 
                 WHERE product_id = $1 AND location_id = $2 
                 FOR UPDATE`,
                [item.product_id, transfer.from_location]
            );

            const available = stockRes.rows.length > 0 ? stockRes.rows[0].quantity : 0;
            if (item.quantity > available) {
                throw new InsufficientStockError(
                    `Cannot transfer ${item.quantity} units of product ${item.product_id}. ` +
                    `Only ${available} available at source location ${transfer.from_location}.`
                );
            }
        }

        // ─── STEP 2: Execute zero-sum movement for each item ───
        for (const item of itemsRes.rows) {
            // Subtract from source
            await client.query(
                `UPDATE stock 
                 SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
                 WHERE product_id = $2 AND location_id = $3`,
                [item.quantity, item.product_id, transfer.from_location]
            );

            // Add to destination (upsert)
            await client.query(
                `INSERT INTO stock (product_id, location_id, quantity) 
                 VALUES ($1, $2, $3)
                 ON CONFLICT (product_id, location_id) 
                 DO UPDATE SET quantity = stock.quantity + $3, updated_at = CURRENT_TIMESTAMP`,
                [item.product_id, transfer.to_location, item.quantity]
            );

            // Write TWO ledger entries (debit + credit)
            await ledger.logEntry(client, {
                productId: item.product_id,
                locationId: transfer.from_location,
                operationType: 'transfer_out',
                quantityChange: -item.quantity,
                referenceId: transferId,
            });

            await ledger.logEntry(client, {
                productId: item.product_id,
                locationId: transfer.to_location,
                operationType: 'transfer_in',
                quantityChange: item.quantity,
                referenceId: transferId,
            });
        }

        return {
            success: true,
            message: `Transfer ${transferId} completed. Moved ${itemsRes.rows.length} item(s).`,
            transfer: await getById(transferId),
        };
    });
}

/**
 * Get a transfer by ID with its items.
 */
async function getById(id) {
    const transferRes = await query(
        `SELECT t.id, t.from_location, t.to_location, t.created_at,
                fl.name AS from_location_name, tl.name AS to_location_name
         FROM transfers t
         LEFT JOIN locations fl ON fl.id = t.from_location
         LEFT JOIN locations tl ON tl.id = t.to_location
         WHERE t.id = $1`,
        [id]
    );
    const transfer = transferRes.rows[0] || null;
    if (!transfer) return null;

    const itemsRes = await query(
        `SELECT ti.id, ti.transfer_id, ti.product_id, ti.quantity,
                p.name AS product_name, p.sku
         FROM transfer_items ti
         JOIN products p ON p.id = ti.product_id
         WHERE ti.transfer_id = $1`,
        [id]
    );
    transfer.items = itemsRes.rows;
    return transfer;
}

/**
 * Get all transfers.
 */
async function listTransfers({ limit = 50, offset = 0 } = {}) {
    const result = await query(
        `SELECT t.id, t.from_location, t.to_location, t.created_at,
                fl.name AS from_location_name, tl.name AS to_location_name
         FROM transfers t
         LEFT JOIN locations fl ON fl.id = t.from_location
         LEFT JOIN locations tl ON tl.id = t.to_location
         ORDER BY t.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
    );

    return {
        success: true,
        transfers: result.rows,
        count: result.rowCount,
    };
}

module.exports = {
    createTransfer,
    executeTransfer,
    getById,
    listTransfers,
};
