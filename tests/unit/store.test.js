// tests/unit/store.test.js
// Unit tests for runtime/store.js helpers

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const RUNTIME_DIR = path.join(process.cwd(), 'runtime');
const LOGS_FILE = path.join(RUNTIME_DIR, 'logs.ndjson');
const SCENARIO_FILE = path.join(RUNTIME_DIR, 'scenario-mode.json');

// Import store module
const store = require('../../runtime/store.js');

describe('Runtime Store Helpers', () => {
  // Use unique test IDs to avoid collisions
  let testRunId = 0;

  beforeEach(() => {
    testRunId++;
    // Reset all state before each test
    store.resetAll();
  });

  afterEach(() => {
    // Clean up after each test
    store.resetAll();
  });

  describe('logEvent', () => {
    it('should append event to logs file', () => {
      const entry = {
        id: `evt_test_${testRunId}_001`,
        type: 'test.event',
        message: 'Test event'
      };

      store.logEvent(entry);

      const content = fs.readFileSync(LOGS_FILE, 'utf8');
      const lines = content.trim().split('\n');
      const lastLine = JSON.parse(lines[lines.length - 1]);

      expect(lastLine.id).toBe(`evt_test_${testRunId}_001`);
      expect(lastLine.type).toBe('test.event');
      expect(lastLine.logged_at).toBeDefined();
    });

    it('should preserve existing logged_at if provided', () => {
      const customTime = '2025-01-01T00:00:00.000Z';
      const entry = {
        id: `evt_test_${testRunId}_002`,
        type: 'test.event',
        logged_at: customTime
      };

      store.logEvent(entry);

      const content = fs.readFileSync(LOGS_FILE, 'utf8');
      const lines = content.trim().split('\n');
      const lastLine = JSON.parse(lines[lines.length - 1]);

      expect(lastLine.logged_at).toBe(customTime);
    });

    it('should handle multiple events in sequence', () => {
      store.logEvent({ id: `evt_seq_${testRunId}_001`, type: 'test' });
      store.logEvent({ id: `evt_seq_${testRunId}_002`, type: 'test' });
      store.logEvent({ id: `evt_seq_${testRunId}_003`, type: 'test' });

      const count = store.getEventCount();
      expect(count).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getNewEvents', () => {
    it('should return events after given index', () => {
      store.logEvent({ id: `evt_new_${testRunId}_001`, type: 'test' });
      store.logEvent({ id: `evt_new_${testRunId}_002`, type: 'test' });
      store.logEvent({ id: `evt_new_${testRunId}_003`, type: 'test' });

      const initialCount = store.getEventCount();
      const newEvents = store.getNewEvents(initialCount - 2);

      expect(newEvents.length).toBe(2);
    });

    it('should return empty array if no new events', () => {
      store.logEvent({ id: `evt_empty_${testRunId}_001`, type: 'test' });
      const count = store.getEventCount();

      const newEvents = store.getNewEvents(count);
      expect(newEvents).toEqual([]);
    });
  });

  describe('getEventCount', () => {
    it('should return 0 for empty logs file', () => {
      store.resetAll();
      const count = store.getEventCount();
      expect(count).toBe(0);
    });

    it('should return correct count after logging events', () => {
      store.logEvent({ id: `evt_count_${testRunId}_001`, type: 'test' });
      store.logEvent({ id: `evt_count_${testRunId}_002`, type: 'test' });

      const count = store.getEventCount();
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getScenarioMode', () => {
    it('should return null when no mode is set', () => {
      store.resetAll();
      const mode = store.getScenarioMode();
      expect(mode).toBeNull();
    });

    it('should return the current scenario mode', () => {
      store.setScenarioMode(`duplicate-webhook-${testRunId}`);

      const mode = store.getScenarioMode();
      expect(mode).toBe(`duplicate-webhook-${testRunId}`);
    });
  });

  describe('setScenarioMode', () => {
    it('should persist scenario mode to file', () => {
      store.setScenarioMode(`out-of-order-webhook-${testRunId}`);

      const content = JSON.parse(fs.readFileSync(SCENARIO_FILE, 'utf8'));
      expect(content.mode).toBe(`out-of-order-webhook-${testRunId}`);
      expect(content.set_at).toBeDefined();
    });

    it('should overwrite previous mode', () => {
      store.setScenarioMode(`dropped-webhook-${testRunId}`);
      store.setScenarioMode(`valid-webhook-${testRunId}`);

      const mode = store.getScenarioMode();
      expect(mode).toBe(`valid-webhook-${testRunId}`);
    });
  });

  describe('resetAll', () => {
    it('should clear all runtime files', () => {
      // Add some data
      store.logEvent({ id: 'evt_reset_001', type: 'test' });
      store.setScenarioMode('test-mode');

      // Reset
      store.resetAll();

      // Verify cleared
      expect(store.getEventCount()).toBe(0);
      expect(store.getScenarioMode()).toBeNull();
    });

    it('should reset contract results to empty state', () => {
      store.resetAll();

      const results = store.getContractResults();
      expect(results.total_webhooks).toBe(0);
      expect(results.results).toEqual([]);
      expect(results.summary.valid).toBe(0);
      expect(results.summary.invalid).toBe(0);
    });

    it('should reset idempotency store to empty state', () => {
      store.resetAll();

      const idempotency = store.getIdempotencyStore();
      expect(idempotency.processed_events).toEqual([]);
      expect(idempotency.total_unique_events).toBe(0);
      expect(idempotency.total_duplicates_skipped).toBe(0);
    });

    it('should reset replay queue to empty state', () => {
      store.resetAll();

      const queue = store.getReplayQueue();
      expect(queue.events).toEqual([]);
      expect(queue.queue_size).toBe(0);
    });

    it('should reset event ordering to empty state', () => {
      store.resetAll();

      const ordering = store.getEventOrdering();
      expect(ordering.ordering_events).toEqual([]);
    });
  });

  describe('addContractResult', () => {
    it('should add valid result and update summary', () => {
      const result = {
        event_id: 'evt_contract_001',
        type: 'payment.succeeded',
        contract_valid: true,
        received_at: new Date().toISOString(),
        validation_details: {
          valid: true,
          errors: []
        }
      };

      store.addContractResult(result);

      const results = store.getContractResults();
      expect(results.total_webhooks).toBe(1);
      expect(results.summary.valid).toBe(1);
      expect(results.summary.pass_rate).toBe(1);
    });

    it('should add invalid result and track violation breakdown', () => {
      const result = {
        event_id: 'evt_contract_002',
        type: 'payment.failed',
        contract_valid: false,
        received_at: new Date().toISOString(),
        validation_details: {
          valid: false,
          errors: [
            { type: 'missing_field', field: 'id', message: 'Missing id' }
          ]
        }
      };

      store.addContractResult(result);

      const results = store.getContractResults();
      expect(results.summary.invalid).toBe(1);
      expect(results.violation_breakdown.missing_field).toBe(1);
    });

    it('should track signature mismatch violations', () => {
      const result = {
        event_id: 'evt_contract_003',
        type: 'payment.succeeded',
        contract_valid: false,
        received_at: new Date().toISOString(),
        validation_details: {
          valid: false,
          errors: [
            { type: 'signature_mismatch', field: 'signature', message: 'Invalid signature' }
          ]
        }
      };

      store.addContractResult(result);

      const results = store.getContractResults();
      expect(results.violation_breakdown.signature_mismatch).toBe(1);
    });

    it('should track stale timestamp violations', () => {
      const result = {
        event_id: 'evt_contract_004',
        type: 'payment.succeeded',
        contract_valid: false,
        received_at: new Date().toISOString(),
        validation_details: {
          valid: false,
          errors: [
            { type: 'stale_timestamp', field: 'timestamp', message: 'Timestamp too old' }
          ]
        }
      };

      store.addContractResult(result);

      const results = store.getContractResults();
      expect(results.violation_breakdown.stale_timestamp).toBe(1);
    });

    it('should track invalid type violations', () => {
      const result = {
        event_id: 'evt_contract_005',
        type: 'invalid.type',
        contract_valid: false,
        received_at: new Date().toISOString(),
        validation_details: {
          valid: false,
          errors: [
            { type: 'invalid_type', field: 'type', message: 'Invalid event type' }
          ]
        }
      };

      store.addContractResult(result);

      const results = store.getContractResults();
      expect(results.violation_breakdown.invalid_type).toBe(1);
    });
  });

  describe('ensureRuntimeFiles', () => {
    it('should create all runtime files if missing', () => {
      store.resetAll();
      store.ensureRuntimeFiles();

      expect(fs.existsSync(path.join(RUNTIME_DIR, 'contract-results.json'))).toBe(true);
      expect(fs.existsSync(path.join(RUNTIME_DIR, 'idempotency-store.json'))).toBe(true);
      expect(fs.existsSync(path.join(RUNTIME_DIR, 'replay-queue.json'))).toBe(true);
      expect(fs.existsSync(path.join(RUNTIME_DIR, 'event-ordering.json'))).toBe(true);
      expect(fs.existsSync(LOGS_FILE)).toBe(true);
      expect(fs.existsSync(SCENARIO_FILE)).toBe(true);
    });
  });
});
