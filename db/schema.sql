-- ============================================================
-- Inventory Management System — Database Schema
-- Person 1 (Data Architect) Reference Schema
-- Database: PostgreSQL
-- ============================================================

-- Users table (Person 2 manages auth, Person 3 references user_id)
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL CHECK (role IN ('inventory_manager', 'warehouse_staff', 'admin')),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id                  SERIAL PRIMARY KEY,
    sku                 VARCHAR(50) UNIQUE NOT NULL,
    name                VARCHAR(255) NOT NULL,
    category            VARCHAR(100),
    low_stock_threshold INTEGER DEFAULT 10,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locations table (Warehouses, Racks, etc.)
CREATE TABLE IF NOT EXISTS locations (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(50) NOT NULL CHECK (type IN ('warehouse', 'rack', 'zone')),
    parent_id   INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock Levels — current quantity per product per location
CREATE TABLE IF NOT EXISTS stock_levels (
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    current_qty INTEGER NOT NULL DEFAULT 0 CHECK (current_qty >= 0),
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, location_id)
);

-- Operations — every inventory movement (receipt, delivery, transfer, adjustment)
CREATE TABLE IF NOT EXISTS operations (
    id                   UUID PRIMARY KEY,
    type                 VARCHAR(20) NOT NULL CHECK (type IN ('receipt', 'delivery', 'transfer', 'adjustment')),
    status               VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'done')),
    product_id           INTEGER NOT NULL REFERENCES products(id),
    source_location_id   INTEGER REFERENCES locations(id),
    dest_location_id     INTEGER REFERENCES locations(id),
    quantity             INTEGER NOT NULL CHECK (quantity > 0),
    physical_count       INTEGER,  -- only used for adjustments
    recorded_qty         INTEGER,  -- only used for adjustments (snapshot at creation)
    notes                TEXT,
    user_id              INTEGER NOT NULL REFERENCES users(id),
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock Ledger — immutable log of every stock change (double-entry)
CREATE TABLE IF NOT EXISTS stock_ledger (
    id                   SERIAL PRIMARY KEY,
    timestamp            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    operation_id         UUID NOT NULL REFERENCES operations(id),
    product_id           INTEGER NOT NULL REFERENCES products(id),
    source_location_id   INTEGER REFERENCES locations(id),
    dest_location_id     INTEGER REFERENCES locations(id),
    quantity_change      INTEGER NOT NULL,  -- positive = add, negative = subtract
    resulting_qty        INTEGER NOT NULL,
    user_id              INTEGER NOT NULL REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_ledger_product   ON stock_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_operation  ON stock_ledger(operation_id);
CREATE INDEX IF NOT EXISTS idx_operations_type_status  ON operations(type, status);
CREATE INDEX IF NOT EXISTS idx_operations_product      ON operations(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_product    ON stock_levels(product_id);

-- ============================================================
-- Seed data for development / testing
-- ============================================================

-- Default admin user (password: 'admin123' — hashed placeholder)
INSERT INTO users (email, name, password_hash, role) VALUES
    ('admin@ims.local', 'Admin User', '$2b$10$placeholder_hash_admin', 'admin'),
    ('manager@ims.local', 'Inventory Manager', '$2b$10$placeholder_hash_manager', 'inventory_manager'),
    ('staff@ims.local', 'Warehouse Staff', '$2b$10$placeholder_hash_staff', 'warehouse_staff')
ON CONFLICT (email) DO NOTHING;

-- Sample locations
INSERT INTO locations (name, type) VALUES
    ('Warehouse Alpha', 'warehouse'),
    ('Warehouse Beta', 'warehouse'),
    ('Rack A1', 'rack'),
    ('Rack A2', 'rack'),
    ('Rack B1', 'rack'),
    ('Zone C', 'zone')
ON CONFLICT DO NOTHING;

-- Sample products
INSERT INTO products (sku, name, category, low_stock_threshold) VALUES
    ('SKU-001', 'Widget A', 'Electronics', 15),
    ('SKU-002', 'Gadget B', 'Electronics', 10),
    ('SKU-003', 'Part C', 'Mechanical', 20),
    ('SKU-004', 'Module D', 'Electrical', 5),
    ('SKU-005', 'Sensor E', 'Electronics', 25)
ON CONFLICT (sku) DO NOTHING;

-- Initial stock levels
INSERT INTO stock_levels (product_id, location_id, current_qty) VALUES
    (1, 1, 100),  -- Widget A in Warehouse Alpha
    (1, 3, 30),   -- Widget A in Rack A1
    (2, 1, 50),   -- Gadget B in Warehouse Alpha
    (2, 2, 75),   -- Gadget B in Warehouse Beta
    (3, 2, 200),  -- Part C in Warehouse Beta
    (4, 4, 8),    -- Module D in Rack A2 (near low stock)
    (5, 1, 3)     -- Sensor E in Warehouse Alpha (below threshold!)
ON CONFLICT (product_id, location_id) DO NOTHING;
