/**
 * Database Initializer
 * 
 * Reads schema.sql and executes it against the configured database.
 * Usage: node db/init.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('./connection');

async function initializeDatabase() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('[DB Init] Connecting to database...');
    const client = await pool.connect();

    try {
        console.log('[DB Init] Running schema...');
        await client.query(schema);
        console.log('[DB Init] ✅ Schema applied successfully.');

        // Verify tables
        const tables = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename;
        `);
        console.log('[DB Init] Tables created:');
        tables.rows.forEach((row) => console.log(`  - ${row.tablename}`));
    } catch (err) {
        console.error('[DB Init] ❌ Error applying schema:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

initializeDatabase();
