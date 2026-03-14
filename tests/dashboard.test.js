/**
 * Tests for Dashboard Service (Person 1 Schema)
 */

jest.mock('../db/connection', () => ({
    query: jest.fn(),
    getClient: jest.fn(),
    withTransaction: jest.fn(),
}));

const { query } = require('../db/connection');
const { getKPIs, getLowStockItems, getStockOverview } = require('../services/dashboard');

describe('Dashboard Service (Person 1 Schema)', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('getKPIs', () => {
        test('returns all KPIs from Person 1 tables', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ count: '10' }] })   // products
                .mockResolvedValueOnce({ rows: [{ count: '4' }] })    // categories
                .mockResolvedValueOnce({ rows: [{ count: '3' }] })    // warehouses
                .mockResolvedValueOnce({ rows: [{ count: '7' }] })    // locations
                .mockResolvedValueOnce({ rows: [{ total: '1500' }] }) // total stock
                .mockResolvedValueOnce({ rows: [{ count: '2' }] })    // low stock
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })    // pending receipts
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })    // pending deliveries
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })         // recent receipts
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })         // recent deliveries
                .mockResolvedValueOnce({ rows: [] });                  // recent transfers

            const result = await getKPIs();
            expect(result.success).toBe(true);
            expect(result.kpis.totalProducts).toBe(10);
            expect(result.kpis.totalCategories).toBe(4);
            expect(result.kpis.totalWarehouses).toBe(3);
            expect(result.kpis.totalStockUnits).toBe(1500);
            expect(result.kpis.lowStockItems).toBe(2);
        });
    });

    describe('getLowStockItems', () => {
        test('returns items below reorder_level', async () => {
            query.mockResolvedValueOnce({
                rows: [{ product_id: 1, sku: 'LAP-001', reorder_level: 10, total_stock: 3, deficit: 7 }],
                rowCount: 1,
            });
            const result = await getLowStockItems();
            expect(result.success).toBe(true);
            expect(result.lowStockItems[0].deficit).toBe(7);
        });
    });

    describe('getStockOverview', () => {
        test('returns stock with warehouse info', async () => {
            query.mockResolvedValueOnce({
                rows: [{ product_id: 1, product_name: 'Laptop', warehouse_name: 'Central', quantity: 40 }],
                rowCount: 1,
            });
            const result = await getStockOverview();
            expect(result.success).toBe(true);
            expect(result.stock[0].warehouse_name).toBe('Central');
        });
    });
});
