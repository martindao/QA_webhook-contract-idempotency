import { describe, it, expect, beforeEach } from 'vitest';
import { validateContract, ALLOWED_TYPES, DEFAULT_TIMESTAMP_TOLERANCE_SECONDS } from '../../webhook-consumer/src/contract-validator.js';
import validEvents from '../fixtures/sample-events.json' with { type: 'json' };
import invalidPayloads from '../fixtures/invalid-payloads.json' with { type: 'json' };

describe('Contract Validator - Payload Schema', () => {
  describe('Required Fields', () => {
    it('should pass with all required fields present', () => {
      const payload = validPayload();
      // Don't pass secret - we're testing payload schema, not signature
      const result = validateContract(payload, {});

      expect(result.valid).toBe(true);
      expect(result.validation_details.id_present).toBe(true);
      expect(result.validation_details.type_valid).toBe(true);
      expect(result.validation_details.timestamp_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when id is missing', () => {
      const result = validateContract(invalidPayloads.missingId, {});

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'id')).toBeDefined();
      expect(result.validation_details.id_present).toBe(false);
    });

    it('should fail when type is missing', () => {
      const result = validateContract(invalidPayloads.missingType, {});

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'type')).toBeDefined();
    });

    it('should fail when timestamp is missing', () => {
      const result = validateContract(invalidPayloads.missingTimestamp, {});

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'timestamp')).toBeDefined();
      expect(result.validation_details.timestamp_error).toBeDefined();
    });

    it('should fail when data is missing', () => {
      const result = validateContract(invalidPayloads.missingData, {});

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'data')).toBeDefined();
    });
  });

  describe('Event Type Validation', () => {
    it('should accept payment.succeeded type', () => {
      const payload = { ...validPayload(), type: 'payment.succeeded' };
      const result = validateContract(payload, {});

      expect(result.validation_details.type_valid).toBe(true);
    });

    it('should accept payment.failed type', () => {
      const payload = { ...validPayload(), type: 'payment.failed' };
      const result = validateContract(payload, {});

      expect(result.validation_details.type_valid).toBe(true);
    });

    it('should accept order.created type', () => {
      const payload = { ...validPayload(), type: 'order.created' };
      const result = validateContract(payload, {});

      expect(result.validation_details.type_valid).toBe(true);
    });

    it('should accept order.shipped type', () => {
      const payload = { ...validPayload(), type: 'order.shipped' };
      const result = validateContract(payload, {});

      expect(result.validation_details.type_valid).toBe(true);
    });

    it('should reject invalid event type', () => {
      const result = validateContract(invalidPayloads.invalidType, {});

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'type')).toBeDefined();
      expect(result.validation_details.type_valid).toBe(false);
    });
  });

  describe('Timestamp Freshness', () => {
    it('should accept current timestamp', () => {
      const payload = { ...validPayload(), timestamp: new Date().toISOString() };
      const result = validateContract(payload, {});

      expect(result.validation_details.timestamp_fresh).toBe(true);
    });

    it('should reject timestamp older than 300 seconds', () => {
      const result = validateContract(invalidPayloads.oldTimestamp, {});

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'timestamp')).toBeDefined();
      expect(result.validation_details.timestamp_fresh).toBe(false);
    });
  });

  describe('Error Details', () => {
    it('should include error_type in errors', () => {
      const result = validateContract(invalidPayloads.missingId, {});

      expect(result.valid).toBe(false);
      const idError = result.errors.find(e => e.field === 'id');
      expect(idError).toBeDefined();
      expect(idError.error_type).toBe('missing_field');
    });

    it('should include specific error messages', () => {
      const result = validateContract(invalidPayloads.invalidType, {});

      expect(result.valid).toBe(false);
      const typeError = result.errors.find(e => e.field === 'type');
      expect(typeError).toBeDefined();
      expect(typeError.error_type).toBe('invalid_type');
      expect(typeError.error).toContain('not in allowed list');
    });
  });
});

// Helper to create valid payload
function validPayload() {
  return {
    id: 'evt_test_001',
    type: 'payment.succeeded',
    timestamp: new Date().toISOString(),
    data: { amount: 1000 }
  };
}
