/**
 * Stock Ledger Service
 * 
 * Adapted for Person 1's schema:
 *   stock_ledger (id, product_id, location_id, operation_type, quantity_change, reference_id, created_at)
 * 
 * Double-Entry Principle: every stock change writes an immutable ledger row.
 */

const { query } = require('../db/connection');

/**
 * Log a stock movement entry in the ledger.
 * Called within an existing transaction (pass the client).
 * 
 * Person 1's ledger schema uses operation_type + reference_id instead of UUID operation_id.
 */
async function logEntry(client, { productId, locationId, operationType, quantityChange, referenceId }) {
    const result = await client.query(
        `INSERT INTO stock_ledger (product_id, location_id, operation_type, quantity_change, reference_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [productId, locationId, operationType, quantityChange, referenceId]
    );
    return result.rows[0];
}

/**
 * Get the ledger history for a specific product.
 */
async function getHistory(productId, { limit = 50, offset = 0 } = {}) {
    const countResult = await query(
        'SELECT COUNT(*) AS total FROM stock_ledger WHERE product_id = $1',
        [productId]
    );

    const entriesResult = await query(
        `SELECT 
            sl.*,
            p.name AS product_name,
            p.sku AS product_sku,
            l.name AS location_name,
            w.name AS warehouse_name
         FROM stock_ledger sl
         JOIN products p ON sl.product_id = p.id
         LEFT JOIN locations l ON sl.location_id = l.id
         LEFT JOIN warehouses w ON w.id = l.warehouse_id
         WHERE sl.product_id = $1
         ORDER BY sl.created_at DESC
         LIMIT $2 OFFSET $3`,
        [productId, limit, offset]
    );

    return {
        entries: entriesResult.rows,
        total: parseInt(countResult.rows[0].total, 10),
        limit,
        offset,
    };
}

/**
 * Get the full ledger (all products) with optional filters.
 */
async function getAllHistory({ operationType, limit = 50, offset = 0 } = {}) {
    let whereClause = '';
    const params = [];

    if (operationType) {
        params.push(operationType);
        whereClause = `WHERE sl.operation_type = $${params.length}`;
    }

    const countQuery = `SELECT COUNT(*) AS total FROM stock_ledger sl ${whereClause}`;
    const countResult = await query(countQuery, params);

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const entriesQuery = `
        SELECT 
            sl.*,
            p.name AS product_name,
            p.sku AS product_sku,
            l.name AS location_name,
            w.name AS warehouse_name
        FROM stock_ledger sl
        JOIN products p ON sl.product_id = p.id
        LEFT JOIN locations l ON sl.location_id = l.id
        LEFT JOIN warehouses w ON w.id = l.warehouse_id
        ${whereClause}
        ORDER BY sl.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;
    const entriesResult = await query(entriesQuery, params);

    return {
        entries: entriesResult.rows,
        total: parseInt(countResult.rows[0].total, 10),
        limit,
        offset,
    };
}

module.exports = {
    logEntry,
    getHistory,
    getAllHistory,
};
