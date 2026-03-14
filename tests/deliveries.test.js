/**
 * Tests for Delivery Operations (Person 1 Schema)
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
const { createDelivery, updateDeliveryStatus } = require('../operations/deliveries');
const { InsufficientStockError } = require('../utils/errors');

describe('Delivery Operations (Person 1 Schema)', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('updateDeliveryStatus', () => {
        test('BLOCKS delivery when any item has insufficient stock', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'ready' }] }); // validate
            mockClient.query.mockResolvedValueOnce({
                rows: [
                    { product_id: 1, location_id: 1, quantity: 100 },
                ]
            });
            // stock check: only 50 available
            mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 50 }] });

            await expect(updateDeliveryStatus(1, 'done', 1))
                .rejects.toThrow(InsufficientStockError);
            expect(ledger.logEntry).not.toHaveBeenCalled();
        });

        test('completes delivery when stock is sufficient', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'ready' }] });
            mockClient.query.mockResolvedValueOnce({
                rows: [
                    { product_id: 1, location_id: 1, quantity: 20 },
                ]
            });
            // stock check: 100 available
            mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 100 }] });
            // decrement stock
            mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
            // update status
            mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
            // getById
            query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'done' }] })
                .mockResolvedValueOnce({ rows: [] });

            const result = await updateDeliveryStatus(1, 'done', 1);
            expect(result.success).toBe(true);
            expect(ledger.logEntry).toHaveBeenCalledWith(
                mockClient,
                expect.objectContaining({ quantityChange: -20, operationType: 'delivery' })
            );
        });
    });
});
