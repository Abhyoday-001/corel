/**
 * In-Memory API — All routes using the memory store.
 * Replaces PostgreSQL-dependent routes for demo/dev.
 */

const express = require('express');
const router = express.Router();
const mem = require('../db/memoryStore');

// ─── HELPERS ───
function productWithCategory(p) {
    const cat = mem.categories.find(c => c.id === p.category_id);
    return { ...p, category_name: cat ? cat.name : null };
}
function locationWithWarehouse(l) {
    const wh = mem.warehouses.find(w => w.id === l.warehouse_id);
    return { ...l, warehouse_name: wh ? wh.name : null };
}

// ─── CATEGORIES ───
router.get('/categories', (req, res) => res.json(mem.categories));
router.post('/categories', (req, res) => {
    const id = Math.max(0, ...mem.categories.map(c => c.id)) + 1;
    const cat = { id, name: req.body.name };
    mem.categories.push(cat);
    res.status(201).json(cat);
});

// ─── WAREHOUSES ───
router.get('/warehouses', (req, res) => res.json(mem.warehouses));
router.post('/warehouses', (req, res) => {
    const id = Math.max(0, ...mem.warehouses.map(w => w.id)) + 1;
    const wh = { id, name: req.body.name, location: req.body.location || null };
    mem.warehouses.push(wh);
    res.status(201).json(wh);
});

// ─── LOCATIONS ───
router.get('/locations', (req, res) => res.json(mem.locations.map(locationWithWarehouse)));
router.post('/locations', (req, res) => {
    const id = Math.max(0, ...mem.locations.map(l => l.id)) + 1;
    const loc = { id, warehouse_id: Number(req.body.warehouse_id), name: req.body.name };
    mem.locations.push(loc);
    res.status(201).json(locationWithWarehouse(loc));
});

// ─── PRODUCTS ───
router.get('/products', (req, res) => {
    let list = mem.products.map(productWithCategory);
    if (req.query.category_id) list = list.filter(p => p.category_id == req.query.category_id);
    res.json(list);
});
router.get('/products/:id', (req, res) => {
    const p = mem.products.find(p => p.id == req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json(productWithCategory(p));
});
router.post('/products', (req, res) => {
    const id = Math.max(0, ...mem.products.map(p => p.id)) + 1;
    const product = { id, name: req.body.name, sku: req.body.sku, category_id: Number(req.body.category_id) || null, unit: req.body.unit || null, reorder_level: Number(req.body.reorder_level) || 0 };
    mem.products.push(product);
    res.status(201).json(productWithCategory(product));
});

// ─── STOCK ───
router.get('/stock', (req, res) => {
    const rows = mem.stock.map(s => {
        const p = mem.products.find(pr => pr.id === s.product_id) || {};
        const l = mem.locations.find(lo => lo.id === s.location_id) || {};
        const w = mem.warehouses.find(wh => wh.id === l.warehouse_id) || {};
        return { ...s, product_name: p.name, sku: p.sku, location_name: l.name, warehouse_name: w.name };
    });
    res.json(rows);
});

// ─── RECEIPTS ───
router.get('/operations/receipts', (req, res) => {
    let list = [...mem.receipts];
    if (req.query.status) list = list.filter(r => r.status === req.query.status);
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, receipts: list, count: list.length });
});
router.get('/operations/receipts/:id', (req, res) => {
    const r = mem.receipts.find(r => r.id == req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const items = mem.receipt_items.filter(i => i.receipt_id == r.id).map(i => {
        const p = mem.products.find(pr => pr.id === i.product_id) || {};
        const l = mem.locations.find(lo => lo.id === i.location_id) || {};
        return { ...i, product_name: p.name, sku: p.sku, location_name: l.name };
    });
    res.json({ success: true, receipt: { ...r, items } });
});
router.post('/operations/receipts', (req, res) => {
    const id = mem.nextId('receipts');
    const receipt = { id, supplier: req.body.supplier || null, status: 'draft', created_at: new Date().toISOString() };
    mem.receipts.push(receipt);
    const items = (req.body.items || []).map((item, idx) => {
        const ri = { id: Math.max(0, ...mem.receipt_items.map(i => i.id)) + idx + 1, receipt_id: id, product_id: Number(item.product_id), location_id: Number(item.location_id), quantity: Number(item.quantity) };
        mem.receipt_items.push(ri);
        return ri;
    });
    res.status(201).json({ success: true, message: 'Receipt created.', receipt: { ...receipt, items } });
});
router.patch('/operations/receipts/:id/status', (req, res) => {
    const r = mem.receipts.find(r => r.id == req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const newStatus = req.body.status;
    if (r.status === 'done') return res.status(400).json({ error: { message: 'Already done' } });
    if (r.status === 'draft' && newStatus !== 'ready') return res.status(400).json({ error: { message: 'Must go draft→ready first' } });
    if (newStatus === 'done') {
        const items = mem.receipt_items.filter(i => i.receipt_id == r.id);
        items.forEach(item => {
            mem.upsertStock(item.product_id, item.location_id, item.quantity);
            mem.addLedgerEntry({ product_id: item.product_id, location_id: item.location_id, operation_type: 'receipt', quantity_change: item.quantity, reference_id: r.id });
        });
    }
    r.status = newStatus;
    res.json({ success: true, message: `Receipt → ${newStatus}` });
});

// ─── DELIVERIES ───
router.get('/operations/deliveries', (req, res) => {
    let list = [...mem.deliveries];
    if (req.query.status) list = list.filter(d => d.status === req.query.status);
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, deliveries: list, count: list.length });
});
router.post('/operations/deliveries', (req, res) => {
    const id = mem.nextId('deliveries');
    const delivery = { id, customer: req.body.customer || null, status: 'draft', created_at: new Date().toISOString() };
    mem.deliveries.push(delivery);
    (req.body.items || []).forEach((item, idx) => {
        mem.delivery_items.push({ id: Math.max(0, ...mem.delivery_items.map(i => i.id)) + idx + 1, delivery_id: id, product_id: Number(item.product_id), location_id: Number(item.location_id), quantity: Number(item.quantity) });
    });
    res.status(201).json({ success: true, message: 'Delivery created.' });
});
router.patch('/operations/deliveries/:id/status', (req, res) => {
    const d = mem.deliveries.find(d => d.id == req.params.id);
    if (!d) return res.status(404).json({ error: 'Not found' });
    const newStatus = req.body.status;
    if (d.status === 'done') return res.status(400).json({ error: { message: 'Already done' } });
    if (d.status === 'draft' && newStatus !== 'ready') return res.status(400).json({ error: { message: 'Must go draft→ready first' } });
    if (newStatus === 'done') {
        const items = mem.delivery_items.filter(i => i.delivery_id == d.id);
        for (const item of items) {
            const avail = mem.getStockQty(item.product_id, item.location_id);
            if (item.quantity > avail) return res.status(400).json({ error: { message: `Insufficient stock for product ${item.product_id}: need ${item.quantity}, have ${avail}` } });
        }
        items.forEach(item => {
            mem.upsertStock(item.product_id, item.location_id, -item.quantity);
            mem.addLedgerEntry({ product_id: item.product_id, location_id: item.location_id, operation_type: 'delivery', quantity_change: -item.quantity, reference_id: d.id });
        });
    }
    d.status = newStatus;
    res.json({ success: true, message: `Delivery → ${newStatus}` });
});

// ─── TRANSFERS ───
router.get('/operations/transfers', (req, res) => {
    const list = mem.transfers.map(t => {
        const fl = mem.locations.find(l => l.id === t.from_location) || {};
        const tl = mem.locations.find(l => l.id === t.to_location) || {};
        return { ...t, from_location_name: fl.name, to_location_name: tl.name };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, transfers: list, count: list.length });
});
router.post('/operations/transfers', (req, res) => {
    const id = mem.nextId('transfers');
    const transfer = { id, from_location: Number(req.body.from_location), to_location: Number(req.body.to_location), created_at: new Date().toISOString() };
    mem.transfers.push(transfer);
    (req.body.items || []).forEach((item, idx) => {
        mem.transfer_items.push({ id: Math.max(0, ...mem.transfer_items.map(i => i.id)) + idx + 1, transfer_id: id, product_id: Number(item.product_id), quantity: Number(item.quantity) });
    });
    res.status(201).json({ success: true, message: 'Transfer created.' });
});
router.post('/operations/transfers/:id/execute', (req, res) => {
    const t = mem.transfers.find(t => t.id == req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    const items = mem.transfer_items.filter(i => i.transfer_id == t.id);
    for (const item of items) {
        const avail = mem.getStockQty(item.product_id, t.from_location);
        if (item.quantity > avail) return res.status(400).json({ error: { message: `Insufficient stock for product ${item.product_id}: need ${item.quantity}, have ${avail}` } });
    }
    items.forEach(item => {
        mem.upsertStock(item.product_id, t.from_location, -item.quantity);
        mem.upsertStock(item.product_id, t.to_location, item.quantity);
        mem.addLedgerEntry({ product_id: item.product_id, location_id: t.from_location, operation_type: 'transfer_out', quantity_change: -item.quantity, reference_id: t.id });
        mem.addLedgerEntry({ product_id: item.product_id, location_id: t.to_location, operation_type: 'transfer_in', quantity_change: item.quantity, reference_id: t.id });
    });
    res.json({ success: true, message: `Transfer #${t.id} executed.` });
});

// ─── ADJUSTMENTS ───
router.get('/operations/adjustments', (req, res) => {
    const list = mem.adjustments.map(a => {
        const p = mem.products.find(pr => pr.id === a.product_id) || {};
        const l = mem.locations.find(lo => lo.id === a.location_id) || {};
        return { ...a, product_name: p.name, sku: p.sku, location_name: l.name };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, adjustments: list, count: list.length });
});
router.post('/operations/adjustments', (req, res) => {
    const { product_id, location_id, physicalCount, quantity_change, reason } = req.body;
    let delta;
    if (physicalCount !== undefined) {
        const currentQty = mem.getStockQty(product_id, location_id);
        delta = Number(physicalCount) - currentQty;
        if (delta === 0) return res.json({ success: true, message: 'No adjustment needed.' });
    } else {
        delta = Number(quantity_change);
    }
    const id = mem.nextId('adjustments');
    const adj = { id, product_id: Number(product_id), location_id: Number(location_id), quantity_change: delta, reason: reason || null, created_at: new Date().toISOString() };
    mem.adjustments.push(adj);
    mem.upsertStock(product_id, location_id, delta);
    mem.addLedgerEntry({ product_id: Number(product_id), location_id: Number(location_id), operation_type: 'adjustment', quantity_change: delta, reference_id: id });
    res.status(201).json({ success: true, message: `Adjustment: ${delta > 0 ? '+' : ''}${delta}`, adjustment: adj });
});

// ─── DASHBOARD ───
router.get('/dashboard/kpis', (req, res) => {
    const totalProducts = mem.products.length;
    const totalCategories = mem.categories.length;
    const totalWarehouses = mem.warehouses.length;
    const totalLocations = mem.locations.length;
    const totalStockUnits = mem.stock.reduce((sum, s) => sum + s.quantity, 0);

    // Low stock: total per product < reorder_level
    const productTotals = {};
    mem.stock.forEach(s => { productTotals[s.product_id] = (productTotals[s.product_id] || 0) + s.quantity; });
    const lowStockItems = mem.products.filter(p => p.reorder_level > 0 && (productTotals[p.id] || 0) < p.reorder_level).length;

    const pendingReceipts = mem.receipts.filter(r => r.status !== 'done' && r.status !== 'received').length;
    const pendingDeliveries = mem.deliveries.filter(d => d.status !== 'done' && d.status !== 'shipped').length;

    res.json({
        success: true,
        kpis: { totalProducts, totalCategories, totalWarehouses, totalLocations, totalStockUnits, lowStockItems, pendingReceipts, pendingDeliveries },
        recentReceipts: mem.receipts.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
        recentDeliveries: mem.deliveries.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
        recentTransfers: mem.transfers.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map(t => {
            const fl = mem.locations.find(l => l.id === t.from_location) || {};
            const tl = mem.locations.find(l => l.id === t.to_location) || {};
            return { ...t, from_location_name: fl.name, to_location_name: tl.name };
        }),
        // Chart data
        stockByWarehouse: mem.warehouses.map(wh => {
            const locIds = mem.locations.filter(l => l.warehouse_id === wh.id).map(l => l.id);
            const total = mem.stock.filter(s => locIds.includes(s.location_id)).reduce((sum, s) => sum + s.quantity, 0);
            return { warehouse: wh.name, total };
        }),
        stockByCategory: mem.categories.map(cat => {
            const productIds = mem.products.filter(p => p.category_id === cat.id).map(p => p.id);
            const total = mem.stock.filter(s => productIds.includes(s.product_id)).reduce((sum, s) => sum + s.quantity, 0);
            return { category: cat.name, total };
        }),
        operationsSummary: {
            receipts: { draft: mem.receipts.filter(r => r.status === 'draft').length, ready: mem.receipts.filter(r => r.status === 'ready').length, done: mem.receipts.filter(r => r.status === 'done').length },
            deliveries: { draft: mem.deliveries.filter(d => d.status === 'draft').length, ready: mem.deliveries.filter(d => d.status === 'ready').length, done: mem.deliveries.filter(d => d.status === 'done').length },
        },
        lowStockDetails: mem.products.filter(p => p.reorder_level > 0 && (productTotals[p.id] || 0) < p.reorder_level).map(p => ({
            product_id: p.id, product_name: p.name, sku: p.sku, reorder_level: p.reorder_level, total_stock: productTotals[p.id] || 0, deficit: p.reorder_level - (productTotals[p.id] || 0),
        })),
    });
});

router.get('/dashboard/stock-overview', (req, res) => {
    const rows = mem.stock.map(s => {
        const p = mem.products.find(pr => pr.id === s.product_id) || {};
        const l = mem.locations.find(lo => lo.id === s.location_id) || {};
        const w = mem.warehouses.find(wh => wh.id === l.warehouse_id) || {};
        const c = mem.categories.find(cat => cat.id === p.category_id) || {};
        return { ...s, product_name: p.name, sku: p.sku, unit: p.unit, category_name: c.name, location_name: l.name, warehouse_name: w.name, reorder_level: p.reorder_level };
    });
    res.json({ success: true, stock: rows, count: rows.length });
});

router.get('/dashboard/low-stock', (req, res) => {
    const productTotals = {};
    mem.stock.forEach(s => { productTotals[s.product_id] = (productTotals[s.product_id] || 0) + s.quantity; });
    const items = mem.products.filter(p => p.reorder_level > 0 && (productTotals[p.id] || 0) < p.reorder_level).map(p => ({
        product_id: p.id, product_name: p.name, sku: p.sku, reorder_level: p.reorder_level, total_stock: productTotals[p.id] || 0, deficit: p.reorder_level - (productTotals[p.id] || 0),
    }));
    res.json({ success: true, lowStockItems: items, count: items.length });
});

router.get('/dashboard/ledger', (req, res) => {
    let entries = [...mem.stock_ledger];
    if (req.query.operationType) entries = entries.filter(e => e.operation_type === req.query.operationType);
    entries = entries.map(e => {
        const p = mem.products.find(pr => pr.id === e.product_id) || {};
        const l = mem.locations.find(lo => lo.id === e.location_id) || {};
        const w = mem.warehouses.find(wh => wh.id === (l.warehouse_id)) || {};
        return { ...e, product_name: p.name, product_sku: p.sku, location_name: l.name, warehouse_name: w.name };
    });
    entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    res.json({ success: true, entries: entries.slice(offset, offset + limit), total: entries.length, limit, offset });
});

module.exports = router;
