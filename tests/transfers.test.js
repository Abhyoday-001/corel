/**
 * Tests for Transfer Operations (Person 1 Schema)
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
const { createTransfer, executeTransfer } = require('../operations/transfers');
const { ValidationError, InsufficientStockError } = require('../utils/errors');

describe('Transfer Operations (Person 1 Schema)', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('createTransfer', () => {
        test('blocks transfer to same location', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 1 }] }) // product
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // from loc
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // to loc (same!)

            await expect(createTransfer({
                fromLocation: 1, toLocation: 1,
                items: [{ product_id: 1, quantity: 10 }], userId: 1,
            })).rejects.toThrow(ValidationError);
        });
    });

    describe('executeTransfer', () => {
        test('performs zero-sum with dual ledger entries', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 1, from_location: 1, to_location: 2 }] });
            // get items
            mockClient.query.mockResolvedValueOnce({ rows: [{ product_id: 1, quantity: 20 }] });
            // stock check: 100 available
            mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 100 }] });
            // subtract source
            mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
            // upsert dest
            mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 20 }] });
            // getById queries
            query.mockResolvedValueOnce({ rows: [{ id: 1, from_location: 1, to_location: 2 }] })
                .mockResolvedValueOnce({ rows: [{ product_id: 1, quantity: 20 }] });

            const result = await executeTransfer(1, 1);
            expect(result.success).toBe(true);
            // TWO ledger entries: transfer_out + transfer_in
            expect(ledger.logEntry).toHaveBeenCalledTimes(2);
            expect(ledger.logEntry).toHaveBeenCalledWith(
                mockClient, expect.objectContaining({ operationType: 'transfer_out', quantityChange: -20 })
            );
            expect(ledger.logEntry).toHaveBeenCalledWith(
                mockClient, expect.objectContaining({ operationType: 'transfer_in', quantityChange: 20 })
            );
        });

        test('blocks when source has insufficient stock', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 1, from_location: 1, to_location: 2 }] });
            mockClient.query.mockResolvedValueOnce({ rows: [{ product_id: 1, quantity: 200 }] });
            mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 50 }] });

            await expect(executeTransfer(1, 1)).rejects.toThrow(InsufficientStockError);
        });
    });
});
