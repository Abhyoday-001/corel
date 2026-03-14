/**
 * Tests for Adjustment Operations (Person 1 Schema)
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
const { createAdjustment } = require('../operations/adjustments');
const { ValidationError } = require('../utils/errors');

describe('Adjustment Operations (Person 1 Schema)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('direct delta mode (Person 1 style)', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // product
        query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // location
        mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1, quantity_change: -5 }] }); // insert
        mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 100 }] }); // current stock
        mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // upsert stock

        const result = await createAdjustment({
            product_id: 1, location_id: 1, quantity_change: -5, reason: 'Damaged',
        });
        expect(result.success).toBe(true);
        expect(ledger.logEntry).toHaveBeenCalledWith(
            mockClient, expect.objectContaining({ operationType: 'adjustment', quantityChange: -5 })
        );
    });

    test('physical count mode (Person 3 style)', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // product
        query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // location
        query.mockResolvedValueOnce({ rows: [{ quantity: 80 }] }); // current stock = 80
        mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1, quantity_change: 20 }] }); // insert
        mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 80 }] }); // FOR UPDATE
        mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // upsert

        const result = await createAdjustment({
            product_id: 1, location_id: 1, physicalCount: 100, reason: 'Count correction',
        });
        expect(result.success).toBe(true);
        expect(result.message).toContain('+20');
    });

    test('no adjustment when counts match', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        query.mockResolvedValueOnce({ rows: [{ quantity: 50 }] });

        const result = await createAdjustment({
            product_id: 1, location_id: 1, physicalCount: 50,
        });
        expect(result.message).toContain('No adjustment needed');
        expect(ledger.logEntry).not.toHaveBeenCalled();
    });

    test('rejects when neither quantity_change nor physicalCount provided', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        await expect(createAdjustment({ product_id: 1, location_id: 1 }))
            .rejects.toThrow(ValidationError);
    });
});
