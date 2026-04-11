// tests/unit/ordering-handler.test.js
// Unit tests for ordering-handler.js edge cases

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleEvent, getPendingEvents, reset } from '../../webhook-consumer/src/ordering-handler.js';
import store from '../../runtime/store.js';

describe('Ordering Handler - Edge Cases', () => {
  beforeEach(() => {
    reset();
    store.resetAll();
  });

  afterEach(() => {
    reset();
    store.resetAll();
  });

  describe('No Sequence Number', () => {
    it('should process events without sequence number immediately', () => {
      const event = {
        id: 'evt_no_seq_001',
        type: 'payment.succeeded',
        timestamp: new Date().toISOString(),
        data: { amount: 1000 }
      };

      const result = handleEvent(event);

      expect(result.processed.length).toBe(1);
      expect(result.held.length).toBe(0);
      expect(result.processed[0].id).toBe('evt_no_seq_001');
    });

    it('should process events without entity_id immediately', () => {
      const event = {
        id: 'evt_no_entity_001',
        type: 'payment.succeeded',
        timestamp: new Date().toISOString(),
        sequence: 1,
        data: { amount: 1000 }
      };

      const result = handleEvent(event);

      expect(result.processed.length).toBe(1);
      expect(result.held.length).toBe(0);
    });
  });

  describe('Sequence Gaps', () => {
    it('should hold event when sequence gap exists', () => {
      const event3 = {
        id: 'evt_gap_003',
        type: 'order.shipped',
        timestamp: new Date().toISOString(),
        sequence: 3,
        entity_id: 'order_gap_001',
        data: { status: 'shipped' }
      };

      const result = handleEvent(event3);

      expect(result.held.length).toBe(1);
      expect(result.processed.length).toBe(0);
    });

    it('should release multiple held events in correct order', () => {
      const entityId = 'order_multi_release';

      // Send events 3, 4, 5 (all should be held)
      handleEvent({
        id: 'evt_multi_003',
        type: 'payment.succeeded',
        timestamp: new Date().toISOString(),
        sequence: 3,
        entity_id: entityId,
        data: { amount: 3000 }
      });

      handleEvent({
        id: 'evt_multi_004',
        type: 'payment.succeeded',
        timestamp: new Date().toISOString(),
        sequence: 4,
        entity_id: entityId,
        data: { amount: 4000 }
      });

      handleEvent({
        id: 'evt_multi_005',
        type: 'payment.succeeded',
        timestamp: new Date().toISOString(),
        sequence: 5,
        entity_id: entityId,
        data: { amount: 5000 }
      });

      // Send event 1 (should release 2, but 2 not sent yet)
      const result1 = handleEvent({
        id: 'evt_multi_001',
        type: 'order.created',
        timestamp: new Date().toISOString(),
        sequence: 1,
        entity_id: entityId,
        data: { status: 'created' }
      });

      expect(result1.processed.length).toBe(1);

      // Send event 2 (should release 3, 4, 5)
      const result2 = handleEvent({
        id: 'evt_multi_002',
        type: 'order.shipped',
        timestamp: new Date().toISOString(),
        sequence: 2,
        entity_id: entityId,
        data: { status: 'shipped' }
      });

      expect(result2.processed.length).toBe(4); // 2, 3, 4, 5
    });
  });

  describe('Duplicate Sequence Numbers', () => {
    it('should skip events with already-processed sequence', () => {
      const entityId = 'order_dup_seq';

      // Send sequence 1
      const result1 = handleEvent({
        id: 'evt_dup_001',
        type: 'order.created',
        timestamp: new Date().toISOString(),
        sequence: 1,
        entity_id: entityId,
        data: { status: 'created' }
      });

      expect(result1.processed.length).toBe(1);

      // Send sequence 1 again (different event, same sequence)
      const result2 = handleEvent({
        id: 'evt_dup_002',
        type: 'order.created',
        timestamp: new Date().toISOString(),
        sequence: 1,
        entity_id: entityId,
        data: { status: 'created' }
      });

      // Should be skipped (sequence already processed)
      expect(result2.processed.length).toBe(0);
      expect(result2.held.length).toBe(0);
    });
  });

  describe('Multiple Entities', () => {
    it('should track ordering independently per entity', () => {
      // Entity 1: Send sequence 2 first
      handleEvent({
        id: 'evt_entity1_002',
        type: 'order.shipped',
        timestamp: new Date().toISOString(),
        sequence: 2,
        entity_id: 'entity_1',
        data: { status: 'shipped' }
      });

      // Entity 2: Send sequence 1 first (should process immediately)
      const result2 = handleEvent({
        id: 'evt_entity2_001',
        type: 'order.created',
        timestamp: new Date().toISOString(),
        sequence: 1,
        entity_id: 'entity_2',
        data: { status: 'created' }
      });

      expect(result2.processed.length).toBe(1);

      // Entity 1: Send sequence 1 (should release sequence 2)
      const result1 = handleEvent({
        id: 'evt_entity1_001',
        type: 'order.created',
        timestamp: new Date().toISOString(),
        sequence: 1,
        entity_id: 'entity_1',
        data: { status: 'created' }
      });

      expect(result1.processed.length).toBe(2);
    });
  });

  describe('Pending Events', () => {
    it('should return all pending events across entities', () => {
      // Add pending events for multiple entities
      handleEvent({
        id: 'evt_pending_001',
        type: 'order.shipped',
        timestamp: new Date().toISOString(),
        sequence: 2,
        entity_id: 'entity_pending_1',
        data: { status: 'shipped' }
      });

      handleEvent({
        id: 'evt_pending_002',
        type: 'order.shipped',
        timestamp: new Date().toISOString(),
        sequence: 3,
        entity_id: 'entity_pending_2',
        data: { status: 'shipped' }
      });

      const pending = getPendingEvents();

      expect(pending.length).toBe(2);
      expect(pending.map(p => p.event_id)).toContain('evt_pending_001');
      expect(pending.map(p => p.event_id)).toContain('evt_pending_002');
    });

    it('should return empty array when no pending events', () => {
      const pending = getPendingEvents();
      expect(pending).toEqual([]);
    });
  });

  describe('Reset Functionality', () => {
    it('should clear all ordering state on reset', () => {
      // Add some events
      handleEvent({
        id: 'evt_reset_001',
        type: 'order.shipped',
        timestamp: new Date().toISOString(),
        sequence: 2,
        entity_id: 'entity_reset',
        data: { status: 'shipped' }
      });

      // Reset
      reset();

      // Verify state is cleared
      const pending = getPendingEvents();
      expect(pending).toEqual([]);

      const state = store.getEventOrdering();
      expect(state.ordering_events).toEqual([]);
    });
  });
});
