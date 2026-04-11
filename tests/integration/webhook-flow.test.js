// tests/integration/webhook-flow.test.js
// Integration tests for full webhook receive → validate → process flow

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
 * Helper: Reset all state via console API
 */
async function resetState() {
  return httpRequest('POST', CONSOLE_PORT, '/api/reset', '');
}

describe('Webhook Flow Integration', () => {
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
    // Reset state before each test
    await resetState();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should process valid webhook with correct signature', async () => {
    const event = {
      id: `evt_test_${Date.now()}`,
      type: 'payment.succeeded',
      timestamp: new Date().toISOString(),
      data: { amount: 9900, currency: 'USD' }
    };

    const response = await sendWebhook(event);

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
    expect(response.body.processed).toBe(true);
    expect(response.body.duplicate).toBe(false);
    expect(response.body.event_id).toBe(event.id);
  });

  it('should reject webhook with invalid signature', async () => {
    const event = {
      id: `evt_invalid_${Date.now()}`,
      type: 'payment.succeeded',
      timestamp: new Date().toISOString(),
      data: { amount: 5000 }
    };

    const payload = JSON.stringify(event);
    const invalidSignature = 'sha256=invalid_signature_12345';

    const response = await httpRequest('POST', CONSUMER_PORT, '/webhook/receive', payload, {
      'X-Webhook-Signature': invalidSignature,
      'X-Webhook-Timestamp': new Date().toISOString()
    });

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
    expect(response.body.processed).toBe(false);
    expect(response.body.validation_errors).toBeDefined();
    expect(response.body.validation_errors[0].field).toBe('signature');
  });

  it('should reject webhook with missing required fields', async () => {
    const event = {
      id: `evt_missing_${Date.now()}`
      // Missing type and timestamp
    };

    const payload = JSON.stringify(event);
    const signature = createSignature(payload, SECRET);

    const response = await httpRequest('POST', CONSUMER_PORT, '/webhook/receive', payload, {
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': new Date().toISOString()
    });

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
    expect(response.body.processed).toBe(false);
    expect(response.body.validation_errors).toBeDefined();
    expect(response.body.validation_errors.length).toBeGreaterThan(0);
  });
});
