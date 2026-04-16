import { check } from 'k6';
import http from 'k6/http';
import crypto from 'k6/crypto';

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';
const WEBHOOK_SECRET = 'webhook-demo-secret-2026';
const EVENT_TYPES = ['payment.succeeded', 'payment.failed', 'order.created', 'order.shipped'];

// Load test options
export const options = {
  stages: [
    // Ramp-up: 0 -> 50 VUs over 30s
    { duration: '30s', target: 50 },
    // Steady state: 50 VUs for 2 minutes
    { duration: '2m', target: 50 },
    // Ramp-down: 50 -> 0 VUs over 30s
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // 95% of requests must complete within 500ms
    http_req_duration: ['p(95)<500'],
    // Failure rate must be less than 1%
    http_req_failed: ['rate<0.01'],
  },
};

// Generate HMAC-SHA256 signature for payload
// Signature format: sha256=<hex_digest>
function generateSignature(payloadString) {
  const hasher = crypto.createHMAC('sha256', WEBHOOK_SECRET);
  hasher.update(payloadString);
  return `sha256=${hasher.digest('hex')}`;
}

// Generate unique event ID
function generateEventId() {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Generate ISO timestamp
function generateTimestamp() {
  return new Date().toISOString();
}

// Generate webhook payload
function generatePayload(eventId) {
  const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  
  const payload = {
    id: eventId,
    type: eventType,
    timestamp: generateTimestamp(),
    data: {}
  };
  
  // Add event-specific data
  if (eventType.startsWith('payment.')) {
    payload.data = {
      payment_id: `pay_${Math.floor(Math.random() * 10000)}`,
      amount: Math.floor(Math.random() * 10000) + 100,
      currency: 'usd'
    };
  } else {
    payload.data = {
      order_id: `ord_${Math.floor(Math.random() * 10000)}`,
      status: eventType === 'order.created' ? 'pending' : 'shipped'
    };
  }
  
  return payload;
}

// Setup function - reset state before test
export function setup() {
  console.log('Resetting state before load test...');
  
  const resetResponse = http.post(`${BASE_URL}/api/reset`);
  
  check(resetResponse, {
    'reset successful': (r) => r.status === 200,
  });
  
  if (resetResponse.status !== 200) {
    console.error('Failed to reset state:', resetResponse.body);
  }
  
  return { startTime: Date.now() };
}

// Default function - main test execution
export default function (data) {
  // Generate unique event ID for this iteration
  const eventId = generateEventId();
  const payload = generatePayload(eventId);
  const timestamp = generateTimestamp();
  
  // Generate signature on payload JSON string
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString);
  
  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Event-Id': eventId,
  };
  
  // Send webhook request
  const response = http.post(
    `${BASE_URL}/webhook/receive`,
    payloadString,
    { headers: headers }
  );
  
  // Validate response
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has received field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.received === true;
      } catch (e) {
        return false;
      }
    },
    'response has event_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.event_id === eventId;
      } catch (e) {
        return false;
      }
    },
  });
}

// Teardown function - cleanup after test
export function teardown(data) {
  console.log(`Load test completed. Duration: ${(Date.now() - data.startTime) / 1000}s`);
}
