/**
 * Dashboard Service
 * 
 * Adapted for Person 1's schema.
 * Uses: products, stock, receipts, deliveries, transfers, categories, warehouses, locations.
 */

const { query } = require('../db/connection');

/**
 * Get all dashboard KPIs.
 */
async function getKPIs() {
    const [
        productsCount,
        categoriesCount,
        warehousesCount,
        locationsCount,
        totalStockUnits,
        lowStockCount,
        pendingReceipts,
        pendingDeliveries,
        recentReceipts,
        recentDeliveries,
        recentTransfers,
    ] = await Promise.all([
        query('SELECT COUNT(*) AS count FROM products').then(r => parseInt(r.rows[0].count, 10)),
        query('SELECT COUNT(*) AS count FROM categories').then(r => parseInt(r.rows[0].count, 10)),
        query('SELECT COUNT(*) AS count FROM warehouses').then(r => parseInt(r.rows[0].count, 10)),
        query('SELECT COUNT(*) AS count FROM locations').then(r => parseInt(r.rows[0].count, 10)),
        query('SELECT COALESCE(SUM(quantity), 0) AS total FROM stock').then(r => parseInt(r.rows[0].total, 10)),
        // Low stock: products where total stock < reorder_level
        query(`
            SELECT COUNT(*) AS count FROM (
                SELECT p.id
                FROM products p
                LEFT JOIN stock s ON s.product_id = p.id
                WHERE p.reorder_level IS NOT NULL AND p.reorder_level > 0
                GROUP BY p.id, p.reorder_level
                HAVING COALESCE(SUM(s.quantity), 0) < p.reorder_level
            ) low
        `).then(r => parseInt(r.rows[0].count, 10)),
        // Pending receipts (not 'received' or 'done')
        query(`SELECT COUNT(*) AS count FROM receipts WHERE status NOT IN ('received', 'done')`).then(r => parseInt(r.rows[0].count, 10)),
        // Pending deliveries (not 'shipped' or 'done')
        query(`SELECT COUNT(*) AS count FROM deliveries WHERE status NOT IN ('shipped', 'done')`).then(r => parseInt(r.rows[0].count, 10)),
        // Recent receipts
        query('SELECT id, supplier, status, created_at FROM receipts ORDER BY created_at DESC LIMIT 5').then(r => r.rows),
        // Recent deliveries
        query('SELECT id, customer, status, created_at FROM deliveries ORDER BY created_at DESC LIMIT 5').then(r => r.rows),
        // Recent transfers
        query(`SELECT t.id, t.from_location, t.to_location, t.created_at,
                      fl.name AS from_location_name, tl.name AS to_location_name
               FROM transfers t
               LEFT JOIN locations fl ON fl.id = t.from_location
               LEFT JOIN locations tl ON tl.id = t.to_location
               ORDER BY t.created_at DESC LIMIT 5`).then(r => r.rows),
    ]);

    return {
        success: true,
        kpis: {
            totalProducts: productsCount,
            totalCategories: categoriesCount,
            totalWarehouses: warehousesCount,
            totalLocations: locationsCount,
            totalStockUnits,
            lowStockItems: lowStockCount,
            pendingReceipts,
            pendingDeliveries,
        },
        recentReceipts,
        recentDeliveries,
        recentTransfers,
    };
}

/**
 * Get low stock items with details.
 * Uses Person 1's reorder_level column.
 */
async function getLowStockItems() {
    const result = await query(`
        SELECT
            p.id AS product_id,
            p.name AS product_name,
            p.sku,
            p.reorder_level,
            COALESCE(SUM(s.quantity), 0) AS total_stock,
            (p.reorder_level - COALESCE(SUM(s.quantity), 0)) AS deficit
        FROM products p
        LEFT JOIN stock s ON s.product_id = p.id
        WHERE p.reorder_level IS NOT NULL AND p.reorder_level > 0
        GROUP BY p.id, p.name, p.sku, p.reorder_level
        HAVING COALESCE(SUM(s.quantity), 0) < p.reorder_level
        ORDER BY deficit DESC
    `);

    return {
        success: true,
        lowStockItems: result.rows,
        count: result.rowCount,
    };
}

/**
 * Get stock overview (all products with stock levels across locations).
 */
async function getStockOverview() {
    const result = await query(`
        SELECT 
            s.product_id, p.name AS product_name, p.sku, p.unit,
            c.name AS category_name,
            s.location_id, l.name AS location_name,
            w.name AS warehouse_name,
            s.quantity, s.updated_at,
            p.reorder_level
        FROM stock s
        JOIN products p ON p.id = s.product_id
        JOIN locations l ON l.id = s.location_id
        LEFT JOIN warehouses w ON w.id = l.warehouse_id
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.name, w.name, l.name
    `);

    return {
        success: true,
        stock: result.rows,
        count: result.rowCount,
    };
}

module.exports = {
    getKPIs,
    getLowStockItems,
    getStockOverview,
};
