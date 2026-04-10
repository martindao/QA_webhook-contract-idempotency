import { describe, it, expect } from 'vitest';
import { validateContract, TIMESTAMP_TOLERANCE_SECONDS } from '../../webhook-consumer/src/contract-validator.js';

describe('Contract Validator - Timestamp Drift', () => {
  describe('Timestamp Freshness Validation', () => {
    it('should accept timestamp within tolerance (current time)', () => {
      const payload = {
        id: 'evt_drift_001',
        type: 'payment.succeeded',
        timestamp: new Date().toISOString(),
        data: { amount: 1000 }
      };

      // Don't pass secret - we're testing timestamp drift, not signature
      const result = validateContract(payload, {});

      expect(result.valid).toBe(true);
      expect(result.details.timestamp_fresh).toBe(true);
    });

    it('should accept timestamp within tolerance (60 seconds ago)', () => {
      const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
      const payload = {
        id: 'evt_drift_002',
        type: 'payment.succeeded',
        timestamp: sixtySecondsAgo,
        data: { amount: 1000 }
      };

      const result = validateContract(payload, {});

      expect(result.valid).toBe(true);
      expect(result.details.timestamp_fresh).toBe(true);
    });

    it('should accept timestamp within tolerance (299 seconds ago)', () => {
      const justUnderTolerance = new Date(Date.now() - 299000).toISOString();
      const payload = {
        id: 'evt_drift_003',
        type: 'payment.succeeded',
        timestamp: justUnderTolerance,
        data: { amount: 1000 }
      };

      const result = validateContract(payload, {});

      expect(result.valid).toBe(true);
      expect(result.details.timestamp_fresh).toBe(true);
    });

    it('should reject timestamp beyond 300 second tolerance', () => {
      const beyondTolerance = new Date(Date.now() - 301000).toISOString();
      const payload = {
        id: 'evt_drift_004',
        type: 'payment.succeeded',
        timestamp: beyondTolerance,
        data: { amount: 1000 }
      };

      const result = validateContract(payload, {});

      expect(result.valid).toBe(false);
      expect(result.details.timestamp_fresh).toBe(false);
      expect(result.errors.find(e => e.field === 'timestamp')).toBeDefined();
    });

    it('should reject very old timestamp', () => {
      const veryOld = new Date(Date.now() - 86400000).toISOString(); // 24 hours ago
      const payload = {
        id: 'evt_drift_005',
        type: 'payment.succeeded',
        timestamp: veryOld,
        data: { amount: 1000 }
      };

      const result = validateContract(payload, {});

      expect(result.valid).toBe(false);
      expect(result.details.timestamp_fresh).toBe(false);
    });

    it('should reject future timestamp beyond tolerance', () => {
      const futureTimestamp = new Date(Date.now() + 301000).toISOString();
      const payload = {
        id: 'evt_drift_006',
        type: 'payment.succeeded',
        timestamp: futureTimestamp,
        data: { amount: 1000 }
      };

      const result = validateContract(payload, {});

      expect(result.valid).toBe(false);
      expect(result.details.timestamp_fresh).toBe(false);
    });
  });

  describe('Tolerance Configuration', () => {
    it('should use 300 second tolerance', () => {
      expect(TIMESTAMP_TOLERANCE_SECONDS).toBe(300);
    });
  });

  describe('Error Messages', () => {
    it('should include drift amount in error message', () => {
      const oldTimestamp = new Date(Date.now() - 600000).toISOString(); // 10 minutes ago
      const payload = {
        id: 'evt_drift_007',
        type: 'payment.succeeded',
        timestamp: oldTimestamp,
        data: { amount: 1000 }
      };

      const result = validateContract(payload, {});
      const timestampError = result.errors.find(e => e.field === 'timestamp');

      expect(timestampError).toBeDefined();
      expect(timestampError.error).toContain('seconds drift');
    });
  });
});
