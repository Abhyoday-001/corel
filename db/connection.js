/**
 * Database Connection Layer
 * 
 * Adapted for Person 1's PostgreSQL schema (coreinventory).
 * Uses the `pg` driver directly — NO ORM.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'coreinventory',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'admin',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterized SQL query against the pool.
 */
async function query(text, params = []) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV !== 'test' && duration > 100) {
            console.log('[DB] Slow query', { text: text.substring(0, 80), duration: `${duration}ms` });
        }
        return result;
    } catch (err) {
        err.query = text;
        throw err;
    }
}

/**
 * Get a dedicated client from the pool for transactional operations.
 */
async function getClient() {
    const client = await pool.connect();
    return client;
}

/**
 * Execute a function within a database transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 */
async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Lightweight connectivity check.
 */
async function checkConnection() {
    try {
        await pool.query('SELECT 1');
        console.log(`[DB] Connection verified (host=${pool.options.host}, db=${pool.options.database})`);
        return true;
    } catch (err) {
        console.error('[DB] Connection test failed:', err.message);
        return false;
    }
}

module.exports = {
    pool,
    query,
    getClient,
    withTransaction,
    checkConnection,
};
