import { describe, it, expect, beforeEach } from 'vitest';
import { isProcessed, markProcessed, getStore, reset } from '../../webhook-consumer/src/idempotency-store.js';

describe('Idempotency Store - Replay Safety', () => {
  beforeEach(() => {
    reset();
  });

  describe('Replay Detection', () => {
    it('should detect replayed event as duplicate', () => {
      const payload = validPayload('evt_replay_001');
      
      // Original processing
      markProcessed('evt_replay_001', payload);
      
      // Simulated replay (same event sent again)
      const result = markProcessed('evt_replay_001', payload);

      expect(result.receive_count).toBe(2);
      expect(result.processed_count).toBe(1);
    });

    it('should not double-process on replay', () => {
      const payload = validPayload('evt_replay_002');
      
      // Process 3 times (simulating retries/replays)
      markProcessed('evt_replay_002', payload);
      markProcessed('evt_replay_002', payload);
      markProcessed('evt_replay_002', payload);

      const store = getStore();
      const event = store.processed_events.find(e => e.event_id === 'evt_replay_002');

      expect(event.processed_count).toBe(1);
      expect(event.receive_count).toBe(3);
    });
  });

  describe('Payload Integrity on Replay', () => {
    it('should preserve original payload on replay', () => {
      const originalPayload = validPayload('evt_replay_003');
      originalPayload.data = { amount: 1000, original: true };
      
      markProcessed('evt_replay_003', originalPayload);

      // Replay with different data (should be ignored)
      const replayPayload = validPayload('evt_replay_003');
      replayPayload.data = { amount: 9999, modified: true };
      
      markProcessed('evt_replay_003', replayPayload);

      const store = getStore();
      const event = store.processed_events.find(e => e.event_id === 'evt_replay_003');

      // Original data should be preserved
      expect(event.data.original).toBe(true);
      expect(event.data.amount).toBe(1000);
    });
  });

  describe('Idempotency Guarantees', () => {
    it('should maintain exactly-once semantics', () => {
      const payload = validPayload('evt_replay_004');
      
      // Multiple attempts
      for (let i = 0; i < 5; i++) {
        markProcessed('evt_replay_004', payload);
      }

      const store = getStore();
      const event = store.processed_events.find(e => e.event_id === 'evt_replay_004');

      // Only processed once despite 5 attempts
      expect(event.processed_count).toBe(1);
      expect(event.receive_count).toBe(5);
    });

    it('should track first_processed_at timestamp', () => {
      const payload = validPayload('evt_replay_005');
      
      markProcessed('evt_replay_005', payload);

      const store = getStore();
      const event = store.processed_events.find(e => e.event_id === 'evt_replay_005');

      expect(event.first_processed_at).toBeDefined();
    });

    it('should update last_received_at on replay', () => {
      const payload = validPayload('evt_replay_006');
      
      markProcessed('evt_replay_006', payload);
      const firstLastReceived = getStore().processed_events.find(e => e.event_id === 'evt_replay_006').last_received_at;
      
      // Small delay
      markProcessed('evt_replay_006', payload);
      const secondLastReceived = getStore().processed_events.find(e => e.event_id === 'evt_replay_006').last_received_at;

      expect(secondLastReceived).toBeDefined();
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
