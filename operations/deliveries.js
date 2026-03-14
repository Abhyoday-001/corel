/**
 * Delivery Operations Module
 * 
 * Adapted for Person 1's schema:
 *   deliveries (id, customer, status, created_at)
 *   delivery_items (id, delivery_id, product_id, location_id, quantity)
 * 
 * Workflow: Draft → Ready → Done
 * CRITICAL: On "Done", blocks if any item's quantity > available stock.
 */

const { withTransaction, query } = require('../db/connection');
const { validateProductById, validateLocation, validatePositiveQty, validateStatusTransition, validateDelivery } = require('../utils/validators');
const { ValidationError, InsufficientStockError } = require('../utils/errors');
const ledger = require('../services/ledger');

/**
 * Create a new delivery with items (status: draft).
 */
async function createDelivery({ customer, items, userId }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new ValidationError('At least one item is required.');
    }

    for (const item of items) {
        await validateProductById(item.product_id);
        await validateLocation(item.location_id);
        validatePositiveQty(item.quantity);
    }

    return await withTransaction(async (client) => {
        const deliveryRes = await client.query(
            `INSERT INTO deliveries (customer, status) 
             VALUES ($1, 'draft') 
             RETURNING id, customer, status, created_at`,
            [customer || null]
        );
        const delivery = deliveryRes.rows[0];

        for (const item of items) {
            await client.query(
                `INSERT INTO delivery_items (delivery_id, product_id, location_id, quantity) 
                 VALUES ($1, $2, $3, $4)`,
                [delivery.id, item.product_id, item.location_id, parseInt(item.quantity)]
            );
        }

        return {
            success: true,
            message: 'Delivery order created in draft status.',
            delivery: await getById(delivery.id),
        };
    });
}

/**
 * Update delivery status: draft → ready → done.
 * On "done": checks stock per item, decrements, writes ledger.
 * BLOCKS if insufficient stock for ANY item.
 */
async function updateDeliveryStatus(deliveryId, newStatus, userId) {
    const delivery = await validateDelivery(deliveryId);
    validateStatusTransition(delivery.status, newStatus);

    if (newStatus === 'done') {
        return await withTransaction(async (client) => {
            const itemsRes = await client.query(
                'SELECT * FROM delivery_items WHERE delivery_id = $1',
                [deliveryId]
            );

            // Check ALL items have sufficient stock before processing any
            for (const item of itemsRes.rows) {
                const stockRes = await client.query(
                    `SELECT quantity FROM stock 
                     WHERE product_id = $1 AND location_id = $2 
                     FOR UPDATE`,
                    [item.product_id, item.location_id]
                );

                const available = stockRes.rows.length > 0 ? stockRes.rows[0].quantity : 0;
                if (item.quantity > available) {
                    throw new InsufficientStockError(
                        `Cannot deliver ${item.quantity} units of product ${item.product_id} ` +
                        `at location ${item.location_id}. Only ${available} available. ` +
                        `Delivery blocked to prevent negative stock.`
                    );
                }
            }

            // All checks passed — process each item
            for (const item of itemsRes.rows) {
                await client.query(
                    `UPDATE stock 
                     SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
                     WHERE product_id = $2 AND location_id = $3`,
                    [item.quantity, item.product_id, item.location_id]
                );

                await ledger.logEntry(client, {
                    productId: item.product_id,
                    locationId: item.location_id,
                    operationType: 'delivery',
                    quantityChange: -item.quantity,
                    referenceId: deliveryId,
                });
            }

            await client.query(
                `UPDATE deliveries SET status = $1 WHERE id = $2`,
                [newStatus, deliveryId]
            );

            return {
                success: true,
                message: `Delivery ${deliveryId} completed. Stock decremented for ${itemsRes.rows.length} item(s).`,
                delivery: await getById(deliveryId),
            };
        });
    }

    await query(`UPDATE deliveries SET status = $1 WHERE id = $2`, [newStatus, deliveryId]);

    return {
        success: true,
        message: `Delivery ${deliveryId} status updated to '${newStatus}'.`,
        delivery: await getById(deliveryId),
    };
}

/**
 * Get a delivery by ID with its items.
 */
async function getById(id) {
    const deliveryRes = await query(
        'SELECT id, customer, status, created_at FROM deliveries WHERE id = $1',
        [id]
    );
    const delivery = deliveryRes.rows[0] || null;
    if (!delivery) return null;

    const itemsRes = await query(
        `SELECT di.id, di.delivery_id, di.product_id, di.location_id, di.quantity,
                p.name AS product_name, p.sku, l.name AS location_name
         FROM delivery_items di
         JOIN products p ON p.id = di.product_id
         JOIN locations l ON l.id = di.location_id
         WHERE di.delivery_id = $1`,
        [id]
    );
    delivery.items = itemsRes.rows;
    return delivery;
}

/**
 * Get all deliveries with optional status filter.
 */
async function listDeliveries({ status, limit = 50, offset = 0 } = {}) {
    let sql = 'SELECT id, customer, status, created_at FROM deliveries';
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
        deliveries: result.rows,
        count: result.rowCount,
    };
}

module.exports = {
    createDelivery,
    updateDeliveryStatus,
    getById,
    listDeliveries,
};
