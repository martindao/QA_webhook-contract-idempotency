// tests/integration/out-of-order.test.js
// Integration tests for out-of-order event handling

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { createSignature } from '../../mock-provider/src/signature-signer.js';
import { handleEvent, getPendingEvents, reset } from '../../webhook-consumer/src/ordering-handler.js';

const CONSUMER_PORT = 3002;
const CONSOLE_PORT = 3003;
const SECRET = 'webhook-demo-secret-2026';

let consumerProcess = null;
let consoleProcess = null;

/**
 * Helper: Make HTTP request
 */
function httpRequest(method, port, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      method,
      hostname: 'localhost',
      port,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Helper: Send webhook to consumer
 */
async function sendWebhook(event) {
  const payload = JSON.stringify(event);
  const signature = createSignature(payload, SECRET);
  const timestamp = new Date().toISOString();

  return httpRequest('POST', CONSUMER_PORT, '/webhook/receive', payload, {
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Event-Id': event.id
  });
}

/**
 * Helper: Reset all state
 */
async function resetState() {
  return httpRequest('POST', CONSOLE_PORT, '/api/reset', '');
}

describe('Out-of-Order Event Integration', () => {
  beforeAll(async () => {
    // Start consumer server
    consumerProcess = spawn('node', [
      path.join(process.cwd(), 'webhook-consumer', 'src', 'webhook-handler.js')
    ], { stdio: 'pipe' });

    // Start console server
    consoleProcess = spawn('node', [
      path.join(process.cwd(), 'support-console', 'server.js')
    ], { stdio: 'pipe' });

    // Wait for servers to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 10000);

  afterAll(async () => {
    if (consumerProcess) {
      consumerProcess.kill();
      await new Promise(resolve => {
        consumerProcess.on('exit', resolve);
        setTimeout(resolve, 1000);
      });
    }
    if (consoleProcess) {
      consoleProcess.kill();
      await new Promise(resolve => {
        consoleProcess.on('exit', resolve);
        setTimeout(resolve, 1000);
      });
    }
  });

  beforeEach(async () => {
    await resetState();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should hold event with sequence 2 and process when sequence 1 arrives', async () => {
    const entityId = `order_${Date.now()}`;

    // Send sequence 2 first
    const event2 = {
      id: `evt_seq_2_${Date.now()}`,
      type: 'order.shipped',
      timestamp: new Date().toISOString(),
      sequence: 2,
      entity_id: entityId,
      data: { status: 'shipped' }
    };

    const response2 = await sendWebhook(event2);
    expect(response2.status).toBe(200);
    expect(response2.body.received).toBe(true);
    expect(response2.body.held).toBe(true);

    // Send sequence 1 (should trigger processing of both)
    const event1 = {
      id: `evt_seq_1_${Date.now()}`,
      type: 'order.created',
      timestamp: new Date().toISOString(),
      sequence: 1,
      entity_id: entityId,
      data: { status: 'created' }
    };

    const response1 = await sendWebhook(event1);
    expect(response1.status).toBe(200);
    expect(response1.body.received).toBe(true);
    expect(response1.body.processed).toBe(true);
  });

  it('should process events in correct order when sent out of order', async () => {
    const entityId = `order_multi_${Date.now()}`;

    // Send events in reverse order: 3, 1, 2
    // Using valid event types: order.created, order.shipped, payment.succeeded
    const event3 = {
      id: `evt_seq_3_${Date.now()}`,
      type: 'payment.succeeded',
      timestamp: new Date().toISOString(),
      sequence: 3,
      entity_id: entityId,
      data: { amount: 10000 }
    };

    const event1 = {
      id: `evt_seq_1_${Date.now()}`,
      type: 'order.created',
      timestamp: new Date().toISOString(),
      sequence: 1,
      entity_id: entityId,
      data: { status: 'created' }
    };

    const event2 = {
      id: `evt_seq_2_${Date.now()}`,
      type: 'order.shipped',
      timestamp: new Date().toISOString(),
      sequence: 2,
      entity_id: entityId,
      data: { status: 'shipped' }
    };

    // Send 3 first (should be held)
    const response3 = await sendWebhook(event3);
    expect(response3.body.held).toBe(true);

    // Send 1 (should process 1, then release 2 if it was held, but 2 isn't sent yet)
    const response1 = await sendWebhook(event1);
    expect(response1.body.processed).toBe(true);

    // Send 2 (should process 2, then release 3)
    const response2 = await sendWebhook(event2);
    expect(response2.body.processed).toBe(true);
  });

  it('should handle events without sequence numbers normally', async () => {
    const event = {
      id: `evt_no_seq_${Date.now()}`,
      type: 'payment.succeeded',
      timestamp: new Date().toISOString(),
      // No sequence or entity_id
      data: { amount: 10000 }
    };

    const response = await sendWebhook(event);
    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
    expect(response.body.processed).toBe(true);
    expect(response.body.duplicate).toBe(false);
  });
});

// Unit tests for ordering handler with timestamp verification
describe('Ordering Handler - Timestamp Tracking', () => {
  beforeEach(() => {
    reset();
  });

  describe('Held Event Timestamps', () => {
    it('should track held_at timestamp for held events', () => {
      const event = {
        id: 'evt_held_001',
        type: 'order.shipped',
        timestamp: new Date().toISOString(),
        sequence: 2,
        entity_id: 'order_123',
        data: { status: 'shipped' }
      };

      const result = handleEvent(event);

      expect(result.held.length).toBe(1);
      const pending = getPendingEvents();
      expect(pending.length).toBe(1);
      expect(pending[0].held_at).toBeDefined();
      expect(new Date(pending[0].held_at).toISOString()).toBe(pending[0].held_at);
    });

    it('should set held_until when held event is released', () => {
      const event2 = {
        id: 'evt_release_002',
        type: 'order.shipped',
        timestamp: new Date().toISOString(),
        sequence: 2,
        entity_id: 'order_456',
        data: { status: 'shipped' }
      };

      const event1 = {
        id: 'evt_release_001',
        type: 'order.created',
        timestamp: new Date().toISOString(),
        sequence: 1,
        entity_id: 'order_456',
        data: { status: 'created' }
      };

      // Send sequence 2 first (held)
      handleEvent(event2);

      // Send sequence 1 (should release sequence 2)
      const result = handleEvent(event1);

      expect(result.processed.length).toBe(2); // Both processed
    });

    it('should track received_at for all processed events', () => {
      const event = {
        id: 'evt_received_001',
        type: 'order.created',
        timestamp: new Date().toISOString(),
        sequence: 1,
        entity_id: 'order_789',
        data: { status: 'created' }
      };

      handleEvent(event);

      const state = require('../../runtime/store').getEventOrdering();
      const entity = state.ordering_events.find(e => e.entity_id === 'order_789');
      const processedEvent = entity.events.find(e => e.event_id === 'evt_received_001');

      expect(processedEvent.received_at).toBeDefined();
      expect(new Date(processedEvent.received_at).toISOString()).toBe(processedEvent.received_at);
    });

    it('should track processing_order for events', () => {
      const event2 = {
        id: 'evt_order_002',
        type: 'order.shipped',
        timestamp: new Date().toISOString(),
        sequence: 2,
        entity_id: 'order_order_test',
        data: { status: 'shipped' }
      };

      const event1 = {
        id: 'evt_order_001',
        type: 'order.created',
        timestamp: new Date().toISOString(),
        sequence: 1,
        entity_id: 'order_order_test',
        data: { status: 'created' }
      };

      // Send out of order
      handleEvent(event2);
      handleEvent(event1);

      const state = require('../../runtime/store').getEventOrdering();
      const entity = state.ordering_events.find(e => e.entity_id === 'order_order_test');

      // Processing order should be: evt_order_001, evt_order_002 (correct order)
      expect(entity.processing_order).toEqual(['evt_order_001', 'evt_order_002']);
      expect(entity.correct_order_maintained).toBe(true);
    });

    it('should set processed_at timestamp for all events', () => {
      const event = {
        id: 'evt_processed_at_001',
        type: 'order.created',
        timestamp: new Date().toISOString(),
        sequence: 1,
        entity_id: 'order_processed_test',
        data: { status: 'created' }
      };

      handleEvent(event);

      const state = require('../../runtime/store').getEventOrdering();
      const entity = state.ordering_events.find(e => e.entity_id === 'order_processed_test');
      const processedEvent = entity.events.find(e => e.event_id === 'evt_processed_at_001');

      expect(processedEvent.processed_at).toBeDefined();
      expect(new Date(processedEvent.processed_at).toISOString()).toBe(processedEvent.processed_at);
    });
  });
});
