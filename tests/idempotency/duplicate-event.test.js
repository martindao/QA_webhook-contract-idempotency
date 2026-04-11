import { describe, it, expect, beforeEach } from 'vitest';
import { isProcessed, markProcessed, getMetrics, reset, getStore } from '../../webhook-consumer/src/idempotency-store.js';

describe('Idempotency Store - Duplicate Event Handling', () => {
  beforeEach(() => {
    reset();
  });

  describe('New Event Processing', () => {
    it('should process a new event successfully', () => {
      const payload = {
        id: 'evt_dup_001',
        type: 'payment.succeeded',
        timestamp: new Date().toISOString(),
        data: { amount: 1000 }
      };

      const result = markProcessed('evt_dup_001', payload);

      expect(result.event_id).toBe('evt_dup_001');
      expect(result.receive_count).toBe(1);
      expect(result.processed_count).toBe(1);
    });

    it('should track total unique events', () => {
      const payload = validPayload('evt_unique_001');
      markProcessed('evt_unique_001', payload);

      const metrics = getMetrics();
      expect(metrics.total_unique).toBe(1);
    });

    it('should use sha256: prefix for payload hash', () => {
      const payload = validPayload('evt_hash_001');
      const result = markProcessed('evt_hash_001', payload);

      expect(result.payload_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });
  });

  describe('Duplicate Event Handling', () => {
    it('should skip duplicate event (same event ID)', () => {
      const payload = validPayload('evt_dup_002');

      // First processing
      markProcessed('evt_dup_002', payload);

      // Duplicate processing attempt
      const result = markProcessed('evt_dup_002', payload);

      expect(result.receive_count).toBe(2);
      expect(result.processed_count).toBe(1); // Should NOT increment
    });

    it('should increment receive_count on duplicate', () => {
      const payload = validPayload('evt_dup_003');

      markProcessed('evt_dup_003', payload);
      markProcessed('evt_dup_003', payload);
      markProcessed('evt_dup_003', payload);

      const metrics = getMetrics();
      expect(metrics.total_duplicates_skipped).toBe(2);
    });

    it('should track total duplicates skipped', () => {
      const payload = validPayload('evt_dup_004');

      markProcessed('evt_dup_004', payload);
      markProcessed('evt_dup_004', payload);
      markProcessed('evt_dup_004', payload);

      const metrics = getMetrics();
      expect(metrics.total_duplicates_skipped).toBe(2);
    });
  });

  describe('Payload Hash Mismatch Detection', () => {
    it('should detect payload hash mismatch on duplicate', () => {
      const payload1 = validPayload('evt_mismatch_001');
      payload1.data.amount = 1000;

      const payload2 = validPayload('evt_mismatch_001');
      payload2.data.amount = 2000; // Different payload

      // First processing
      markProcessed('evt_mismatch_001', payload1);

      // Duplicate with different payload
      const result = markProcessed('evt_mismatch_001', payload2);

      expect(result.receive_count).toBe(2);
      expect(result.processed_count).toBe(1);
      expect(result.payload_hash_mismatches).toBeDefined();
      expect(result.payload_hash_mismatches.length).toBe(1);
      expect(result.payload_hash_mismatches[0].expected_hash).toMatch(/^sha256:/);
      expect(result.payload_hash_mismatches[0].received_hash).toMatch(/^sha256:/);
    });

    it('should track multiple payload hash mismatches', () => {
      const payload1 = validPayload('evt_multi_mismatch_001');
      payload1.data.amount = 1000;

      const payload2 = validPayload('evt_multi_mismatch_001');
      payload2.data.amount = 2000;

      const payload3 = validPayload('evt_multi_mismatch_001');
      payload3.data.amount = 3000;

      markProcessed('evt_multi_mismatch_001', payload1);
      markProcessed('evt_multi_mismatch_001', payload2);
      const result = markProcessed('evt_multi_mismatch_001', payload3);

      expect(result.payload_hash_mismatches.length).toBe(2);
    });

    it('should preserve original payload hash on mismatch', () => {
      const payload1 = validPayload('evt_preserve_001');
      payload1.data.amount = 1000;

      const payload2 = validPayload('evt_preserve_001');
      payload2.data.amount = 999999;

      markProcessed('evt_preserve_001', payload1);
      const result = markProcessed('evt_preserve_001', payload2);

      // Original hash should be preserved
      const store = getStore();
      const stored = store.processed_events.find(e => e.event_id === 'evt_preserve_001');
      expect(stored.data.amount).toBe(1000); // Original data preserved
    });
  });

  describe('Idempotency Score Calculation', () => {
    it('should calculate idempotency score correctly', () => {
      const payload1 = validPayload('evt_score_001');
      const payload2 = validPayload('evt_score_002');

      markProcessed('evt_score_001', payload1);
      markProcessed('evt_score_002', payload2);
      // Duplicate
      markProcessed('evt_score_001', payload1);

      const metrics = getMetrics();
      expect(metrics.idempotency_score).toBe(1); // No double processing incidents
    });

    it('should return score of 1 when no events processed', () => {
      const metrics = getMetrics();
      expect(metrics.idempotency_score).toBe(1);
    });
  });

  describe('isProcessed Check', () => {
    it('should return false for unprocessed event', () => {
      expect(isProcessed('evt_not_processed')).toBe(false);
    });

    it('should return true for processed event', () => {
      const payload = validPayload('evt_check_001');
      markProcessed('evt_check_001', payload);

      expect(isProcessed('evt_check_001')).toBe(true);
    });
  });
});

function validPayload(eventId) {
  return {
    id: eventId,
    type: 'payment.succeeded',
    timestamp: new Date().toISOString(),
    data: { amount: 1000 }
  };
}
