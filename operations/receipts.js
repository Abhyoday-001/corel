/**
 * Receipt Operations Module
 * 
 * Adapted for Person 1's schema:
 *   receipts (id, supplier, status, created_at)
 *   receipt_items (id, receipt_id, product_id, location_id, quantity)
 * 
 * Workflow: Draft → Ready → Done
 * On "Done": increments stock per item and writes ledger entries.
 */

const { withTransaction, query } = require('../db/connection');
const { validateProductById, validateLocation, validatePositiveQty, validateStatusTransition, validateReceipt } = require('../utils/validators');
const { ValidationError } = require('../utils/errors');
const ledger = require('../services/ledger');

/**
 * Create a new receipt with items (status: draft).
 * 
 * @param {Object} params
 * @param {string} params.supplier
 * @param {Array<{product_id, location_id, quantity}>} params.items
 * @param {number} params.userId - From authenticated session.
 * @returns {Promise<Object>}
 */
async function createReceipt({ supplier, items, userId }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new ValidationError('At least one item is required.');
    }

    // Validate all items upfront
    for (const item of items) {
        await validateProductById(item.product_id);
        await validateLocation(item.location_id);
        validatePositiveQty(item.quantity);
    }

    return await withTransaction(async (client) => {
        // Insert receipt header
        const receiptRes = await client.query(
            `INSERT INTO receipts (supplier, status) 
             VALUES ($1, 'draft') 
             RETURNING id, supplier, status, created_at`,
            [supplier || null]
        );
        const receipt = receiptRes.rows[0];

        // Insert receipt items
        for (const item of items) {
            await client.query(
                `INSERT INTO receipt_items (receipt_id, product_id, location_id, quantity) 
                 VALUES ($1, $2, $3, $4)`,
                [receipt.id, item.product_id, item.location_id, parseInt(item.quantity)]
            );
        }

        return {
            success: true,
            message: 'Receipt created in draft status.',
            receipt: await getById(receipt.id),
        };
    });
}

/**
 * Update receipt status: draft → ready → done.
 * On "done": increments stock and writes to ledger for each item.
 */
async function updateReceiptStatus(receiptId, newStatus, userId) {
    const receipt = await validateReceipt(receiptId);
    validateStatusTransition(receipt.status, newStatus);

    if (newStatus === 'done') {
        return await withTransaction(async (client) => {
            // Get all items for this receipt
            const itemsRes = await client.query(
                'SELECT * FROM receipt_items WHERE receipt_id = $1',
                [receiptId]
            );

            // Process each item: increment stock + write ledger
            for (const item of itemsRes.rows) {
                // Upsert stock (add quantity)
                const stockRes = await client.query(
                    `INSERT INTO stock (product_id, location_id, quantity) 
                     VALUES ($1, $2, $3)
                     ON CONFLICT (product_id, location_id) 
                     DO UPDATE SET quantity = stock.quantity + $3, updated_at = CURRENT_TIMESTAMP
                     RETURNING quantity`,
                    [item.product_id, item.location_id, item.quantity]
                );

                // Write ledger entry
                await ledger.logEntry(client, {
                    productId: item.product_id,
                    locationId: item.location_id,
                    operationType: 'receipt',
                    quantityChange: item.quantity,
                    referenceId: receiptId,
                });
            }

            // Update receipt status
            await client.query(
                `UPDATE receipts SET status = $1 WHERE id = $2`,
                [newStatus, receiptId]
            );

            return {
                success: true,
                message: `Receipt ${receiptId} completed. Stock updated for ${itemsRes.rows.length} item(s).`,
                receipt: await getById(receiptId),
            };
        });
    }

    // draft → ready: just update status
    await query(`UPDATE receipts SET status = $1 WHERE id = $2`, [newStatus, receiptId]);

    return {
        success: true,
        message: `Receipt ${receiptId} status updated to '${newStatus}'.`,
        receipt: await getById(receiptId),
    };
}

/**
 * Get a receipt by ID with its items.
 */
async function getById(id) {
    const receiptRes = await query(
        'SELECT id, supplier, status, created_at FROM receipts WHERE id = $1',
        [id]
    );
    const receipt = receiptRes.rows[0] || null;
    if (!receipt) return null;

    const itemsRes = await query(
        `SELECT ri.id, ri.receipt_id, ri.product_id, ri.location_id, ri.quantity,
                p.name AS product_name, p.sku, l.name AS location_name
         FROM receipt_items ri
         JOIN products p ON p.id = ri.product_id
         JOIN locations l ON l.id = ri.location_id
         WHERE ri.receipt_id = $1`,
        [id]
    );
    receipt.items = itemsRes.rows;
    return receipt;
}

/**
 * Get all receipts with optional status filter.
 */
async function listReceipts({ status, limit = 50, offset = 0 } = {}) {
    let sql = 'SELECT id, supplier, status, created_at FROM receipts';
    const params = [];

    if (status) {
        params.push(status);
        sql += ` WHERE status = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    return {
        success: true,
        receipts: result.rows,
        count: result.rowCount,
    };
}

module.exports = {
    createReceipt,
    updateReceiptStatus,
    getById,
    listReceipts,
};
