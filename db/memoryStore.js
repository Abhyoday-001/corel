/**
 * In-Memory Data Store
 * 
 * Replaces PostgreSQL for demo/development — pre-populated with
 * realistic inventory data. Supports full CRUD + transactional semantics.
 */

// ─── SEED DATA ───

const categories = [
    { id: 1, name: 'Electronics' },
    { id: 2, name: 'Raw Materials' },
    { id: 3, name: 'Furniture' },
    { id: 4, name: 'Office Supplies' },
    { id: 5, name: 'Safety Equipment' },
    { id: 6, name: 'Packaging' },
];

const warehouses = [
    { id: 1, name: 'Central Warehouse', location: 'Building A, Industrial Park' },
    { id: 2, name: 'East Distribution Center', location: 'Sector 12, East Zone' },
    { id: 3, name: 'West Storage Facility', location: 'Plot 45, West Avenue' },
];

const locations = [
    { id: 1, warehouse_id: 1, name: 'A1 - High Bay Rack' },
    { id: 2, warehouse_id: 1, name: 'A2 - Ground Floor Shelf' },
    { id: 3, warehouse_id: 1, name: 'B1 - Cold Storage' },
    { id: 4, warehouse_id: 2, name: 'D1 - Loading Dock' },
    { id: 5, warehouse_id: 2, name: 'D2 - Staging Area' },
    { id: 6, warehouse_id: 3, name: 'W1 - Bulk Storage' },
    { id: 7, warehouse_id: 3, name: 'W2 - Small Parts' },
];

const products = [
    { id: 1, name: '15" Laptop Pro', sku: 'LAP-001', category_id: 1, unit: 'pcs', reorder_level: 10 },
    { id: 2, name: 'Wireless Mouse', sku: 'MOU-002', category_id: 1, unit: 'pcs', reorder_level: 50 },
    { id: 3, name: 'USB-C Hub 7-Port', sku: 'HUB-003', category_id: 1, unit: 'pcs', reorder_level: 20 },
    { id: 4, name: 'Steel Rods 12mm', sku: 'STL-004', category_id: 2, unit: 'kg', reorder_level: 200 },
    { id: 5, name: 'Copper Wire 2.5mm', sku: 'COP-005', category_id: 2, unit: 'meter', reorder_level: 500 },
    { id: 6, name: 'Aluminium Sheet 3mm', sku: 'ALU-006', category_id: 2, unit: 'kg', reorder_level: 100 },
    { id: 7, name: 'Office Chair Ergonomic', sku: 'CHR-007', category_id: 3, unit: 'pcs', reorder_level: 15 },
    { id: 8, name: 'Standing Desk 120cm', sku: 'DSK-008', category_id: 3, unit: 'pcs', reorder_level: 8 },
    { id: 9, name: 'A4 Paper 80gsm', sku: 'PAP-009', category_id: 4, unit: 'ream', reorder_level: 100 },
    { id: 10, name: 'Printer Toner Black', sku: 'TNR-010', category_id: 4, unit: 'pcs', reorder_level: 20 },
    { id: 11, name: 'Safety Helmet', sku: 'HLM-011', category_id: 5, unit: 'pcs', reorder_level: 30 },
    { id: 12, name: 'Hi-Vis Vest', sku: 'VIS-012', category_id: 5, unit: 'pcs', reorder_level: 40 },
    { id: 13, name: 'Bubble Wrap Roll', sku: 'BWR-013', category_id: 6, unit: 'roll', reorder_level: 25 },
    { id: 14, name: 'Cardboard Box Large', sku: 'BOX-014', category_id: 6, unit: 'pcs', reorder_level: 100 },
    { id: 15, name: 'Packing Tape', sku: 'TPE-015', category_id: 6, unit: 'roll', reorder_level: 60 },
];

const stock = [
    // Central Warehouse — well stocked
    { product_id: 1, location_id: 1, quantity: 45, updated_at: d(-1) },
    { product_id: 2, location_id: 1, quantity: 120, updated_at: d(-2) },
    { product_id: 3, location_id: 2, quantity: 35, updated_at: d(-1) },
    { product_id: 4, location_id: 2, quantity: 800, updated_at: d(-3) },
    { product_id: 5, location_id: 3, quantity: 1200, updated_at: d(-5) },
    { product_id: 6, location_id: 3, quantity: 60, updated_at: d(-2) },   // below reorder!
    { product_id: 7, location_id: 2, quantity: 22, updated_at: d(-1) },
    { product_id: 9, location_id: 2, quantity: 250, updated_at: d(-4) },
    { product_id: 11, location_id: 1, quantity: 18, updated_at: d(-6) },   // below reorder!
    // East Distribution
    { product_id: 1, location_id: 4, quantity: 12, updated_at: d(-1) },
    { product_id: 8, location_id: 4, quantity: 5, updated_at: d(-2) },   // below reorder!
    { product_id: 10, location_id: 5, quantity: 8, updated_at: d(-3) },   // below reorder!
    { product_id: 14, location_id: 5, quantity: 45, updated_at: d(-1) },   // below reorder!
    // West Storage
    { product_id: 4, location_id: 6, quantity: 1500, updated_at: d(-2) },
    { product_id: 13, location_id: 6, quantity: 15, updated_at: d(-4) },   // below reorder!
    { product_id: 15, location_id: 7, quantity: 30, updated_at: d(-3) },   // below reorder!
    { product_id: 12, location_id: 7, quantity: 55, updated_at: d(-1) },
];

// Pre-populated operations
let nextReceiptId = 4, nextDeliveryId = 4, nextTransferId = 3, nextAdjustmentId = 4;
let nextLedgerId = 20;

const receipts = [
    { id: 1, supplier: 'TechWorld Distributors', status: 'done', created_at: d(-10) },
    { id: 2, supplier: 'Metro Steel Corp', status: 'ready', created_at: d(-3) },
    { id: 3, supplier: 'PaperMill Inc', status: 'draft', created_at: d(-1) },
];

const receipt_items = [
    { id: 1, receipt_id: 1, product_id: 1, location_id: 1, quantity: 30 },
    { id: 2, receipt_id: 1, product_id: 2, location_id: 1, quantity: 100 },
    { id: 3, receipt_id: 2, product_id: 4, location_id: 2, quantity: 500 },
    { id: 4, receipt_id: 2, product_id: 6, location_id: 3, quantity: 200 },
    { id: 5, receipt_id: 3, product_id: 9, location_id: 2, quantity: 150 },
    { id: 6, receipt_id: 3, product_id: 10, location_id: 5, quantity: 40 },
];

const deliveries = [
    { id: 1, customer: 'Global Industries Ltd', status: 'done', created_at: d(-8) },
    { id: 2, customer: 'Tech Hub Solutions', status: 'ready', created_at: d(-2) },
    { id: 3, customer: 'OfficeMax Corp', status: 'draft', created_at: d(0) },
];

const delivery_items = [
    { id: 1, delivery_id: 1, product_id: 4, location_id: 2, quantity: 200 },
    { id: 2, delivery_id: 2, product_id: 7, location_id: 2, quantity: 5 },
    { id: 3, delivery_id: 2, product_id: 3, location_id: 2, quantity: 10 },
    { id: 4, delivery_id: 3, product_id: 9, location_id: 2, quantity: 50 },
];

const transfers = [
    { id: 1, from_location: 1, to_location: 4, created_at: d(-5) },
    { id: 2, from_location: 6, to_location: 2, created_at: d(-1) },
];

const transfer_items = [
    { id: 1, transfer_id: 1, product_id: 1, quantity: 15 },
    { id: 2, transfer_id: 2, product_id: 4, quantity: 300 },
];

const adjustments = [
    { id: 1, product_id: 2, location_id: 1, quantity_change: -5, reason: 'Damaged in transit', created_at: d(-7) },
    { id: 2, product_id: 11, location_id: 1, quantity_change: -12, reason: 'Expired safety cert', created_at: d(-4) },
    { id: 3, product_id: 12, location_id: 7, quantity_change: 10, reason: 'Found uncounted stock', created_at: d(-2) },
];

const stock_ledger = [
    { id: 1, product_id: 1, location_id: 1, operation_type: 'receipt', quantity_change: 30, reference_id: 1, created_at: d(-10) },
    { id: 2, product_id: 2, location_id: 1, operation_type: 'receipt', quantity_change: 100, reference_id: 1, created_at: d(-10) },
    { id: 3, product_id: 4, location_id: 2, operation_type: 'delivery', quantity_change: -200, reference_id: 1, created_at: d(-8) },
    { id: 4, product_id: 2, location_id: 1, operation_type: 'adjustment', quantity_change: -5, reference_id: 1, created_at: d(-7) },
    { id: 5, product_id: 11, location_id: 1, operation_type: 'adjustment', quantity_change: -12, reference_id: 2, created_at: d(-4) },
    { id: 6, product_id: 1, location_id: 1, operation_type: 'transfer_out', quantity_change: -15, reference_id: 1, created_at: d(-5) },
    { id: 7, product_id: 1, location_id: 4, operation_type: 'transfer_in', quantity_change: 15, reference_id: 1, created_at: d(-5) },
    { id: 8, product_id: 12, location_id: 7, operation_type: 'adjustment', quantity_change: 10, reference_id: 3, created_at: d(-2) },
    { id: 9, product_id: 4, location_id: 6, operation_type: 'transfer_out', quantity_change: -300, reference_id: 2, created_at: d(-1) },
    { id: 10, product_id: 4, location_id: 2, operation_type: 'transfer_in', quantity_change: 300, reference_id: 2, created_at: d(-1) },
];

// Helper: date N days ago
function d(daysOffset) {
    const dt = new Date();
    dt.setDate(dt.getDate() + daysOffset);
    return dt.toISOString();
}

// ─── QUERY ENGINE ───
// Mimics pg's { rows, rowCount } interface

function findAll(table) { return { rows: [...table], rowCount: table.length }; }
function findById(table, id) {
    const row = table.find(r => r.id === Number(id));
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
}
function findWhere(table, cond) {
    const rows = table.filter(row => Object.entries(cond).every(([k, v]) => row[k] == v));
    return { rows, rowCount: rows.length };
}

// ─── EXPORTED API (used by routes/data.js and operations modules) ───

const memdb = {
    categories, warehouses, locations, products, stock,
    receipts, receipt_items, deliveries, delivery_items,
    transfers, transfer_items, adjustments, stock_ledger,

    // ID generators
    nextId(table) {
        if (table === 'receipts') return nextReceiptId++;
        if (table === 'deliveries') return nextDeliveryId++;
        if (table === 'transfers') return nextTransferId++;
        if (table === 'adjustments') return nextAdjustmentId++;
        if (table === 'stock_ledger') return nextLedgerId++;
        return Math.max(0, ...this[table].map(r => r.id || 0)) + 1;
    },

    findAll, findById, findWhere,

    // Upsert stock
    upsertStock(productId, locationId, delta) {
        const existing = stock.find(s => s.product_id == productId && s.location_id == locationId);
        if (existing) {
            existing.quantity += delta;
            existing.updated_at = new Date().toISOString();
            return existing.quantity;
        } else {
            const entry = { product_id: Number(productId), location_id: Number(locationId), quantity: delta, updated_at: new Date().toISOString() };
            stock.push(entry);
            return delta;
        }
    },

    getStockQty(productId, locationId) {
        const s = stock.find(s => s.product_id == productId && s.location_id == locationId);
        return s ? s.quantity : 0;
    },

    addLedgerEntry(entry) {
        const id = this.nextId('stock_ledger');
        const row = { id, ...entry, created_at: new Date().toISOString() };
        stock_ledger.unshift(row); // newest first
        return row;
    },
};

module.exports = memdb;
