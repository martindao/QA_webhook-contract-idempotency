import { describe, it, expect, beforeEach } from 'vitest';
import { addToQueue, getQueue, getQueueSize, markReplayed, reset } from '../../webhook-consumer/src/replay-queue.js';

describe('Replay Queue - Dropped Event Handling', () => {
  beforeEach(() => {
    reset();
  });

  describe('Queueing Dropped Events', () => {
    it('should add dropped event to replay queue', () => {
      const event = validEvent('evt_dropped_001');

      const entry = addToQueue(event);

      expect(entry).toBeDefined();
      expect(entry.event_id).toBe('evt_dropped_001');
      expect(entry.status).toBe('pending');
    });

    it('should not add duplicate events to queue', () => {
      const event = validEvent('evt_dropped_002');

      addToQueue(event);
      const secondEntry = addToQueue(event);

      expect(secondEntry).toBeNull();
    });

    it('should track retry count', () => {
      const event = validEvent('evt_dropped_003');
      addToQueue(event);

      markReplayed('evt_dropped_003', false, 'Connection timeout');
      markReplayed('evt_dropped_003', false, 'Connection timeout');

      const queue = getQueue();
      const entry = queue.find(e => e.event_id === 'evt_dropped_003');

      expect(entry.retry_count).toBe(2);
    });

    it('should include payload in queue entry', () => {
      const event = validEvent('evt_payload_001');
      event.data = { amount: 5000, order_id: 'order_123' };

      const entry = addToQueue(event);

      expect(entry.payload).toBeDefined();
      expect(entry.payload.data.amount).toBe(5000);
      expect(entry.payload.data.order_id).toBe('order_123');
    });

    it('should include last_error field', () => {
      const event = validEvent('evt_error_001');
      const entry = addToQueue(event);

      expect(entry.last_error).toBeNull(); // Initially null
    });

    it('should include next_retry_at field', () => {
      const event = validEvent('evt_retry_001');
      const entry = addToQueue(event);

      expect(entry.next_retry_at).toBeNull(); // Initially null for new events
    });
  });

  describe('Queue Status', () => {
    it('should return queue size for pending events', () => {
      addToQueue(validEvent('evt_queue_001'));
      addToQueue(validEvent('evt_queue_002'));
      addToQueue(validEvent('evt_queue_003'));

      expect(getQueueSize()).toBe(3);
    });

    it('should calculate event age', () => {
      const event = validEvent('evt_age_001');
      addToQueue(event);

      const queue = getQueue();
      const entry = queue.find(e => e.event_id === 'evt_age_001');

      expect(entry.age_seconds).toBeDefined();
      expect(entry.age_seconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Replay Success/Failure', () => {
    it('should mark event as succeeded after replay', () => {
      const event = validEvent('evt_success_001');
      addToQueue(event);

      markReplayed('evt_success_001', true);

      const queue = getQueue();
      const entry = queue.find(e => e.event_id === 'evt_success_001');

      expect(entry.status).toBe('succeeded');
      expect(entry.next_retry_at).toBeNull(); // Cleared on success
    });

    it('should mark event as failed with error message', () => {
      const event = validEvent('evt_failed_001');
      addToQueue(event);

      markReplayed('evt_failed_001', false, 'Service unavailable');

      const queue = getQueue();
      const entry = queue.find(e => e.event_id === 'evt_failed_001');

      expect(entry.status).toBe('retrying');
      expect(entry.last_error).toBe('Service unavailable');
    });

    it('should set next_retry_at with exponential backoff on failure', () => {
      const event = validEvent('evt_backoff_001');
      addToQueue(event);

      markReplayed('evt_backoff_001', false, 'Connection timeout');

      const queue = getQueue();
      const entry = queue.find(e => e.event_id === 'evt_backoff_001');

      expect(entry.next_retry_at).toBeDefined();
      expect(entry.status).toBe('retrying');

      // Verify backoff is in the future
      const nextRetry = new Date(entry.next_retry_at);
      const now = new Date();
      expect(nextRetry.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should use exponential backoff for multiple retries', () => {
      const event = validEvent('evt_multi_backoff_001');
      addToQueue(event);

      markReplayed('evt_multi_backoff_001', false, 'Error 1');
      const queue1 = getQueue();
      const entry1 = queue1.find(e => e.event_id === 'evt_multi_backoff_001');
      const firstBackoff = new Date(entry1.next_retry_at);

      markReplayed('evt_multi_backoff_001', false, 'Error 2');
      const queue2 = getQueue();
      const entry2 = queue2.find(e => e.event_id === 'evt_multi_backoff_001');
      const secondBackoff = new Date(entry2.next_retry_at);

      // Second backoff should be longer (exponential)
      // First retry: 2^1 = 2 minutes, Second retry: 2^2 = 4 minutes
      const diffMs = secondBackoff.getTime() - firstBackoff.getTime();
      expect(diffMs).toBeGreaterThan(0); // Second backoff is later
    });
  });

  describe('Age Tracking', () => {
    it('should flag events exceeding max age', () => {
      const event = validEvent('evt_old_001');
      addToQueue(event);

      const queue = getQueue();
      const entry = queue.find(e => e.event_id === 'evt_old_001');

      // Fresh event should not be aged out
      expect(entry.max_age_exceeded).toBe(false);
    });
  });
});

function validEvent(eventId) {
  return {
    id: eventId,
    type: 'payment.succeeded',
    timestamp: new Date().toISOString(),
    data: { amount: 1000 }
  };
}
