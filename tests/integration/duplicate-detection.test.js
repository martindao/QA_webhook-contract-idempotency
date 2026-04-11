// tests/integration/duplicate-detection.test.js
// Integration tests for duplicate event detection and idempotency

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
 * Helper: Get idempotency metrics
 */
async function getIdempotencyMetrics() {
  return httpRequest('GET', CONSOLE_PORT, '/api/idempotency-metrics', null);
}

/**
 * Helper: Reset all state
 */
async function resetState() {
  return httpRequest('POST', CONSOLE_PORT, '/api/reset', '');
}

/**
 * Helper: Wait for server to be ready with health check
 */
async function waitForServer(port, healthPath, maxAttempts = 10, delayMs = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({
          method: 'GET',
          hostname: 'localhost',
          port,
          path: healthPath,
          timeout: 1000
        }, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Health check returned ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Health check timeout'));
        });
        req.end();
      });
      return true; // Server is ready
    } catch (e) {
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  return false; // Server not ready after all attempts
}

describe('Duplicate Detection Integration', () => {
  beforeAll(async () => {
    // Wait for any previous test servers to fully terminate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start consumer server
    consumerProcess = spawn('node', [
      path.join(process.cwd(), 'webhook-consumer', 'src', 'webhook-handler.js')
    ], { stdio: 'pipe' });

    // Start console server
    consoleProcess = spawn('node', [
      path.join(process.cwd(), 'support-console', 'server.js')
    ], { stdio: 'pipe' });

    // Wait for both servers to be ready with health checks
    // Consumer has /health, Console has /api/health
    const consumerReady = await waitForServer(CONSUMER_PORT, '/health', 15, 500);
    const consoleReady = await waitForServer(CONSOLE_PORT, '/api/health', 15, 500);

    if (!consumerReady || !consoleReady) {
      throw new Error(`Servers not ready: consumer=${consumerReady}, console=${consoleReady}`);
    }
  }, 15000);

  afterAll(async () => {
    if (consumerProcess) {
      consumerProcess.kill();
      // Wait for process to fully terminate
      await new Promise(resolve => {
        consumerProcess.on('exit', resolve);
        setTimeout(resolve, 1000); // Fallback timeout
      });
    }
    if (consoleProcess) {
      consoleProcess.kill();
      // Wait for process to fully terminate
      await new Promise(resolve => {
        consoleProcess.on('exit', resolve);
        setTimeout(resolve, 1000); // Fallback timeout
      });
    }
  });

  beforeEach(async () => {
    await resetState();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should process first event and mark second as duplicate', async () => {
    const event = {
      id: `evt_dup_${Date.now()}`,
      type: 'payment.succeeded',
      timestamp: new Date().toISOString(),
      data: { amount: 5000 }
    };

    // Send first time
    const response1 = await sendWebhook(event);
    expect(response1.status).toBe(200);
    expect(response1.body.received).toBe(true);
    expect(response1.body.processed).toBe(true);
    expect(response1.body.duplicate).toBe(false);

    // Send second time (duplicate)
    const response2 = await sendWebhook(event);
    expect(response2.status).toBe(200);
    expect(response2.body.received).toBe(true);
    expect(response2.body.processed).toBe(false);
    expect(response2.body.duplicate).toBe(true);
  });

  it('should track duplicate metrics correctly', async () => {
    const event = {
      id: `evt_metrics_${Date.now()}`,
      type: 'payment.succeeded',
      timestamp: new Date().toISOString(),
      data: { amount: 7500 }
    };

    // Send event 3 times
    await sendWebhook(event);
    await sendWebhook(event);
    await sendWebhook(event);

    // Check metrics
    const metricsResponse = await getIdempotencyMetrics();
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.body.unique_events_processed).toBe(1);
    expect(metricsResponse.body.duplicates_detected).toBe(2);
    expect(metricsResponse.body.duplicates_correctly_skipped).toBe(2);
    expect(metricsResponse.body.idempotency_score).toBe(1);
  });

  it('should handle multiple different events without marking as duplicates', async () => {
    const event1 = {
      id: `evt_unique_1_${Date.now()}`,
      type: 'payment.succeeded',
      timestamp: new Date().toISOString(),
      data: { amount: 1000 }
    };

    const event2 = {
      id: `evt_unique_2_${Date.now()}`,
      type: 'payment.failed',
      timestamp: new Date().toISOString(),
      data: { amount: 2000 }
    };

    const event3 = {
      id: `evt_unique_3_${Date.now()}`,
      type: 'order.created',
      timestamp: new Date().toISOString(),
      data: { order_id: 'order_123' }
    };

    // Send all different events
    const response1 = await sendWebhook(event1);
    const response2 = await sendWebhook(event2);
    const response3 = await sendWebhook(event3);

    expect(response1.body.processed).toBe(true);
    expect(response1.body.duplicate).toBe(false);

    expect(response2.body.processed).toBe(true);
    expect(response2.body.duplicate).toBe(false);

    expect(response3.body.processed).toBe(true);
    expect(response3.body.duplicate).toBe(false);

    // Verify metrics
    const metricsResponse = await getIdempotencyMetrics();
    expect(metricsResponse.body.unique_events_processed).toBe(3);
    expect(metricsResponse.body.duplicates_detected).toBe(0);
  });
});
