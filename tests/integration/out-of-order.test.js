// tests/integration/out-of-order.test.js
// Integration tests for out-of-order event handling

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { createSignature } from '../../mock-provider/src/signature-signer.js';

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

  afterAll(() => {
    if (consumerProcess) {
      consumerProcess.kill();
    }
    if (consoleProcess) {
      consoleProcess.kill();
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
