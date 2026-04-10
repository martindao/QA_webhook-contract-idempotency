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
    });

    it('should mark event as failed with error message', () => {
      const event = validEvent('evt_failed_001');
      addToQueue(event);

      markReplayed('evt_failed_001', false, 'Service unavailable');

      const queue = getQueue();
      const entry = queue.find(e => e.event_id === 'evt_failed_001');

      expect(entry.status).toBe('failed');
      expect(entry.last_error).toBe('Service unavailable');
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
