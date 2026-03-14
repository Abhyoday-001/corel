/**
 * Validation Utilities
 * 
 * Adapted for Person 1's schema (coreinventory).
 * Uses: products, locations, warehouses, categories, stock tables.
 */

const { query } = require('../db/connection');
const { NotFoundError, ValidationError, InvalidStatusTransitionError } = require('./errors');

// Allowed status transitions: draft → ready → done
const STATUS_WORKFLOW = {
    draft: 'ready',
    ready: 'done',
};

const VALID_STATUSES = ['draft', 'ready', 'done', 'pending', 'received', 'partial', 'shipped', 'cancelled'];

/**
 * Validate that a product exists by its ID.
 * Person 1 schema: products (id, name, sku, category_id, unit)
 */
async function validateProductById(productId) {
    if (!productId || !Number.isInteger(Number(productId)) || Number(productId) <= 0) {
        throw new ValidationError('Product ID must be a positive integer.');
    }
    const result = await query(
        `SELECT p.*, c.name AS category_name 
         FROM products p 
         LEFT JOIN categories c ON c.id = p.category_id 
         WHERE p.id = $1`,
        [productId]
    );
    if (result.rows.length === 0) {
        throw new NotFoundError(`Error: Product ID ${productId} not found in database.`);
    }
    return result.rows[0];
}

/**
 * Validate that a product exists by its SKU.
 */
async function validateProductBySKU(sku) {
    if (!sku || typeof sku !== 'string' || sku.trim() === '') {
        throw new ValidationError('SKU must be a non-empty string.');
    }
    const result = await query(
        `SELECT p.*, c.name AS category_name 
         FROM products p 
         LEFT JOIN categories c ON c.id = p.category_id 
         WHERE p.sku = $1`,
        [sku.trim()]
    );
    if (result.rows.length === 0) {
        throw new NotFoundError(`Error: SKU ${sku} not found in database.`);
    }
    return result.rows[0];
}

/**
 * Validate that a location exists.
 * Person 1 schema: locations (id, warehouse_id, name)
 */
async function validateLocation(locationId) {
    if (!locationId || !Number.isInteger(Number(locationId)) || Number(locationId) <= 0) {
        throw new ValidationError('Location ID must be a positive integer.');
    }
    const result = await query(
        `SELECT l.*, w.name AS warehouse_name 
         FROM locations l 
         LEFT JOIN warehouses w ON w.id = l.warehouse_id 
         WHERE l.id = $1`,
        [locationId]
    );
    if (result.rows.length === 0) {
        throw new NotFoundError(`Error: Location ID ${locationId} not found in database.`);
    }
    return result.rows[0];
}

/**
 * Validate that a warehouse exists.
 * Person 1 schema: warehouses (id, name, location)
 */
async function validateWarehouse(warehouseId) {
    if (!warehouseId || !Number.isInteger(Number(warehouseId)) || Number(warehouseId) <= 0) {
        throw new ValidationError('Warehouse ID must be a positive integer.');
    }
    const result = await query('SELECT * FROM warehouses WHERE id = $1', [warehouseId]);
    if (result.rows.length === 0) {
        throw new NotFoundError(`Error: Warehouse ID ${warehouseId} not found in database.`);
    }
    return result.rows[0];
}

/**
 * Validate positive quantity.
 */
function validatePositiveQty(qty) {
    const parsed = Number(qty);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ValidationError(`Quantity must be a positive integer. Received: ${qty}`);
    }
    return parsed;
}

/**
 * Validate email format.
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        throw new ValidationError('Email is required and must be a string.');
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
        throw new ValidationError(`Invalid email format: ${email}`);
    }
    return email.trim().toLowerCase();
}

/**
 * Validate status transition: draft → ready → done.
 */
function validateStatusTransition(currentStatus, newStatus) {
    if (!VALID_STATUSES.includes(currentStatus)) {
        throw new ValidationError(`Unknown current status: '${currentStatus}'.`);
    }
    if (!VALID_STATUSES.includes(newStatus)) {
        throw new ValidationError(`Unknown target status: '${newStatus}'.`);
    }
    if (currentStatus === 'done' || currentStatus === 'received' || currentStatus === 'shipped') {
        throw new InvalidStatusTransitionError(currentStatus, newStatus);
    }
    const expectedNext = STATUS_WORKFLOW[currentStatus];
    if (expectedNext && newStatus !== expectedNext) {
        throw new InvalidStatusTransitionError(currentStatus, newStatus);
    }
}

/**
 * Validate a receipt exists.
 * Person 1 schema: receipts (id, supplier, status, created_at)
 */
async function validateReceipt(receiptId) {
    if (!receiptId) throw new ValidationError('Receipt ID is required.');
    const result = await query('SELECT * FROM receipts WHERE id = $1', [receiptId]);
    if (result.rows.length === 0) {
        throw new NotFoundError(`Error: Receipt ID ${receiptId} not found in database.`);
    }
    return result.rows[0];
}

/**
 * Validate a delivery exists.
 */
async function validateDelivery(deliveryId) {
    if (!deliveryId) throw new ValidationError('Delivery ID is required.');
    const result = await query('SELECT * FROM deliveries WHERE id = $1', [deliveryId]);
    if (result.rows.length === 0) {
        throw new NotFoundError(`Error: Delivery ID ${deliveryId} not found in database.`);
    }
    return result.rows[0];
}

/**
 * Validate a transfer exists.
 */
async function validateTransfer(transferId) {
    if (!transferId) throw new ValidationError('Transfer ID is required.');
    const result = await query('SELECT * FROM transfers WHERE id = $1', [transferId]);
    if (result.rows.length === 0) {
        throw new NotFoundError(`Error: Transfer ID ${transferId} not found in database.`);
    }
    return result.rows[0];
}

module.exports = {
    validateProductById,
    validateProductBySKU,
    validateLocation,
    validateWarehouse,
    validatePositiveQty,
    validateEmail,
    validateStatusTransition,
    validateReceipt,
    validateDelivery,
    validateTransfer,
    STATUS_WORKFLOW,
    VALID_STATUSES,
};
