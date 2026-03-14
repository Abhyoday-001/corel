/**
 * Tests for Validation Utilities (Person 1 Schema)
 */

jest.mock('../db/connection', () => ({
    query: jest.fn(),
    getClient: jest.fn(),
    withTransaction: jest.fn(),
}));

const { query } = require('../db/connection');
const {
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
} = require('../utils/validators');
const { NotFoundError, ValidationError, InvalidStatusTransitionError } = require('../utils/errors');

describe('Validators', () => {

    afterEach(() => jest.clearAllMocks());

    describe('validateEmail', () => {
        test('accepts valid emails', () => {
            expect(validateEmail('user@example.com')).toBe('user@example.com');
            expect(validateEmail('admin@ims.local')).toBe('admin@ims.local');
        });
        test('rejects invalid emails', () => {
            expect(() => validateEmail('notanemail')).toThrow(ValidationError);
            expect(() => validateEmail('@domain.com')).toThrow(ValidationError);
            expect(() => validateEmail('')).toThrow(ValidationError);
            expect(() => validateEmail(null)).toThrow(ValidationError);
        });
        test('lowercases and trims email', () => {
            expect(validateEmail('  Admin@IMS.Local  ')).toBe('admin@ims.local');
        });
    });

    describe('validatePositiveQty', () => {
        test('accepts positive integers', () => {
            expect(validatePositiveQty(1)).toBe(1);
            expect(validatePositiveQty(100)).toBe(100);
            expect(validatePositiveQty('50')).toBe(50);
        });
        test('rejects zero, negative, and non-integer', () => {
            expect(() => validatePositiveQty(0)).toThrow(ValidationError);
            expect(() => validatePositiveQty(-5)).toThrow(ValidationError);
            expect(() => validatePositiveQty(3.14)).toThrow(ValidationError);
            expect(() => validatePositiveQty('abc')).toThrow(ValidationError);
        });
    });

    describe('validateStatusTransition', () => {
        test('allows draft → ready', () => {
            expect(() => validateStatusTransition('draft', 'ready')).not.toThrow();
        });
        test('allows ready → done', () => {
            expect(() => validateStatusTransition('ready', 'done')).not.toThrow();
        });
        test('blocks draft → done (skipping)', () => {
            expect(() => validateStatusTransition('draft', 'done')).toThrow(InvalidStatusTransitionError);
        });
        test('blocks done → anything', () => {
            expect(() => validateStatusTransition('done', 'draft')).toThrow(InvalidStatusTransitionError);
        });
        test('blocks ready → draft (backward)', () => {
            expect(() => validateStatusTransition('ready', 'draft')).toThrow(InvalidStatusTransitionError);
        });
    });

    describe('validateProductById', () => {
        test('returns product when found', async () => {
            const mock = { id: 1, sku: 'LAP-001', name: '15" Laptop', category_name: 'Electronics' };
            query.mockResolvedValue({ rows: [mock] });
            const result = await validateProductById(1);
            expect(result).toEqual(mock);
        });
        test('throws NotFoundError when not found', async () => {
            query.mockResolvedValue({ rows: [] });
            await expect(validateProductById(999)).rejects.toThrow(NotFoundError);
        });
        test('throws ValidationError for invalid ID', async () => {
            await expect(validateProductById(-1)).rejects.toThrow(ValidationError);
        });
    });

    describe('validateProductBySKU', () => {
        test('returns product when found', async () => {
            query.mockResolvedValue({ rows: [{ id: 1, sku: 'LAP-001' }] });
            const result = await validateProductBySKU('LAP-001');
            expect(result.sku).toBe('LAP-001');
        });
        test('throws NotFoundError for non-existent SKU', async () => {
            query.mockResolvedValue({ rows: [] });
            await expect(validateProductBySKU('FAKE')).rejects.toThrow(NotFoundError);
        });
    });

    describe('validateLocation', () => {
        test('returns location with warehouse name', async () => {
            query.mockResolvedValue({ rows: [{ id: 1, name: 'A1 - High Bay', warehouse_name: 'Central Warehouse' }] });
            const result = await validateLocation(1);
            expect(result.warehouse_name).toBe('Central Warehouse');
        });
        test('throws NotFoundError when not found', async () => {
            query.mockResolvedValue({ rows: [] });
            await expect(validateLocation(999)).rejects.toThrow(NotFoundError);
        });
    });

    describe('validateWarehouse', () => {
        test('returns warehouse when found', async () => {
            query.mockResolvedValue({ rows: [{ id: 1, name: 'Central Warehouse' }] });
            const result = await validateWarehouse(1);
            expect(result.name).toBe('Central Warehouse');
        });
        test('throws NotFoundError when not found', async () => {
            query.mockResolvedValue({ rows: [] });
            await expect(validateWarehouse(999)).rejects.toThrow(NotFoundError);
        });
    });

    describe('validateReceipt', () => {
        test('returns receipt when found', async () => {
            query.mockResolvedValue({ rows: [{ id: 1, status: 'draft' }] });
            const result = await validateReceipt(1);
            expect(result.status).toBe('draft');
        });
        test('throws NotFoundError when not found', async () => {
            query.mockResolvedValue({ rows: [] });
            await expect(validateReceipt(999)).rejects.toThrow(NotFoundError);
        });
    });

    describe('validateDelivery', () => {
        test('returns delivery when found', async () => {
            query.mockResolvedValue({ rows: [{ id: 1, status: 'draft' }] });
            const result = await validateDelivery(1);
            expect(result.status).toBe('draft');
        });
        test('throws NotFoundError when not found', async () => {
            query.mockResolvedValue({ rows: [] });
            await expect(validateDelivery(999)).rejects.toThrow(NotFoundError);
        });
    });

    describe('validateTransfer', () => {
        test('returns transfer when found', async () => {
            query.mockResolvedValue({ rows: [{ id: 1, from_location: 1, to_location: 2 }] });
            const result = await validateTransfer(1);
            expect(result.from_location).toBe(1);
        });
        test('throws NotFoundError when not found', async () => {
            query.mockResolvedValue({ rows: [] });
            await expect(validateTransfer(999)).rejects.toThrow(NotFoundError);
        });
    });
});
