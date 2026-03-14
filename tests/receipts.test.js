/**
 * Tests for Receipt Operations (Person 1 Schema)
 */

jest.mock('../db/connection', () => {
    const mockClient = { query: jest.fn(), release: jest.fn() };
    return {
        query: jest.fn(),
        getClient: jest.fn().mockResolvedValue(mockClient),
        withTransaction: jest.fn(async (fn) => await fn(mockClient)),
        pool: { connect: jest.fn().mockResolvedValue(mockClient) },
        _mockClient: mockClient,
    };
});
jest.mock('../services/ledger', () => ({ logEntry: jest.fn().mockResolvedValue({ id: 1 }) }));

const { query, _mockClient: mockClient } = require('../db/connection');
const ledger = require('../services/ledger');
const { createReceipt, updateReceiptStatus } = require('../operations/receipts');
const { ValidationError } = require('../utils/errors');

describe('Receipt Operations (Person 1 Schema)', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('createReceipt', () => {
        test('creates receipt with items in draft', async () => {
            // validateProductById + validateLocation per item
            query.mockResolvedValueOnce({ rows: [{ id: 1, sku: 'LAP-001' }] })
                .mockResolvedValueOnce({ rows: [{ id: 1, name: 'A1' }] });
            // receipt insert
            mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1, supplier: 'Vendor', status: 'draft' }] });
            // item insert
            mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
            // getById calls
            query.mockResolvedValueOnce({ rows: [{ id: 1, supplier: 'Vendor', status: 'draft' }] })
                .mockResolvedValueOnce({ rows: [{ product_id: 1, quantity: 50 }] });

            const result = await createReceipt({
                supplier: 'Vendor',
                items: [{ product_id: 1, location_id: 1, quantity: 50 }],
                userId: 1,
            });
            expect(result.success).toBe(true);
        });

        test('rejects empty items', async () => {
            await expect(createReceipt({ supplier: 'X', items: [], userId: 1 }))
                .rejects.toThrow(ValidationError);
        });
    });

    describe('updateReceiptStatus', () => {
        test('completing receipt updates stock and writes ledger per item', async () => {
            // validateReceipt
            query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'ready' }] });
            // get items
            mockClient.query.mockResolvedValueOnce({
                rows: [
                    { product_id: 1, location_id: 1, quantity: 50 },
                    { product_id: 2, location_id: 1, quantity: 30 },
                ]
            });
            // upsert stock × 2
            mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 90 }] });
            mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 90 }] });
            // update status
            mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
            // getById
            query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'done' }] })
                .mockResolvedValueOnce({ rows: [] });

            const result = await updateReceiptStatus(1, 'done', 1);
            expect(result.success).toBe(true);
            expect(ledger.logEntry).toHaveBeenCalledTimes(2);
        });

        test('blocks draft → done (skipping ready)', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'draft' }] });
            await expect(updateReceiptStatus(1, 'done', 1)).rejects.toThrow();
        });
    });
});
