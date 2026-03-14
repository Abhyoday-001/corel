/**
 * Data Routes — Proxies to Person 1's services
 * 
 * Exposes CRUD for products, categories, warehouses, locations
 * using Person 1's service layer but through our unified Express server.
 */

const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');

// ─── CATEGORIES ───
router.get('/categories', async (req, res, next) => {
    try {
        const result = await query('SELECT * FROM categories ORDER BY name');
        res.json(result.rows);
    } catch (err) { next(err); }
});

router.post('/categories', async (req, res, next) => {
    try {
        const { name } = req.body;
        const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// ─── WAREHOUSES ───
router.get('/warehouses', async (req, res, next) => {
    try {
        const result = await query('SELECT * FROM warehouses ORDER BY name');
        res.json(result.rows);
    } catch (err) { next(err); }
});

router.post('/warehouses', async (req, res, next) => {
    try {
        const { name, location } = req.body;
        const result = await query('INSERT INTO warehouses (name, location) VALUES ($1, $2) RETURNING *', [name, location || null]);
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// ─── LOCATIONS ───
router.get('/locations', async (req, res, next) => {
    try {
        const result = await query(`
            SELECT l.*, w.name AS warehouse_name 
            FROM locations l 
            LEFT JOIN warehouses w ON w.id = l.warehouse_id 
            ORDER BY w.name, l.name
        `);
        res.json(result.rows);
    } catch (err) { next(err); }
});

router.post('/locations', async (req, res, next) => {
    try {
        const { warehouse_id, name } = req.body;
        const result = await query('INSERT INTO locations (warehouse_id, name) VALUES ($1, $2) RETURNING *', [warehouse_id, name]);
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// ─── PRODUCTS ───
router.get('/products', async (req, res, next) => {
    try {
        const { category_id } = req.query;
        let sql = `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE 1=1`;
        const params = [];
        if (category_id) {
            params.push(category_id);
            sql += ` AND p.category_id = $${params.length}`;
        }
        sql += ' ORDER BY p.name';
        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

router.get('/products/:id', async (req, res, next) => {
    try {
        const result = await query(
            `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

router.post('/products', async (req, res, next) => {
    try {
        const { name, sku, category_id, unit } = req.body;
        const result = await query(
            'INSERT INTO products (name, sku, category_id, unit) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, sku, category_id || null, unit || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

router.put('/products/:id', async (req, res, next) => {
    try {
        const { name, sku, category_id, unit } = req.body;
        const result = await query(
            `UPDATE products SET name=COALESCE($1,name), sku=COALESCE($2,sku), category_id=$3, unit=COALESCE($4,unit)
             WHERE id = $5 RETURNING *`,
            [name, sku, category_id, unit, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// ─── STOCK ───
router.get('/stock', async (req, res, next) => {
    try {
        const result = await query(`
            SELECT s.*, p.name AS product_name, p.sku, l.name AS location_name, w.name AS warehouse_name
            FROM stock s
            JOIN products p ON p.id = s.product_id
            JOIN locations l ON l.id = s.location_id
            LEFT JOIN warehouses w ON w.id = l.warehouse_id
            ORDER BY p.name, l.name
        `);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// ─── STOCK LEDGER ───
router.get('/stock-ledger', async (req, res, next) => {
    try {
        const result = await query(`
            SELECT sl.*, p.name AS product_name, p.sku, l.name AS location_name
            FROM stock_ledger sl
            JOIN products p ON p.id = sl.product_id
            LEFT JOIN locations l ON l.id = sl.location_id
            ORDER BY sl.created_at DESC
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) { next(err); }
});

module.exports = router;
