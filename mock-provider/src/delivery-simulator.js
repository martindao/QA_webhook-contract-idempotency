/**
 * Delivery Simulator Module
 * Simulates webhook delivery with various failure modes
 */

const http = require('http');
const { createSignature } = require('./signature-signer');

const CONSUMER_URL = 'http://localhost:3002';
const WEBHOOK_ENDPOINT = '/webhook/receive';

/**
 * Sends a webhook to the consumer
 * @param {object} event - Event to send
 * @param {object} options - Delivery options
 * @returns {Promise<object>} Delivery result
 */
async function sendWebhook(event, options = {}) {
  const { simulateDrop, simulateDelay, simulateDuplicate, simulateOutOfOrder } = options;
  
  // Simulate drop - return 504 Gateway Timeout
  if (simulateDrop) {
    return {
      success: false,
      error: 'simulated_drop',
      status: 504,
      eventId: event.id
    };
  }
  
  // Simulate delay
  if (simulateDelay) {
    await new Promise(resolve => setTimeout(resolve, simulateDelay));
  }
  
  // Sign payload
  const payload = JSON.stringify(event);
  const signature = createSignature(payload);
  const timestamp = new Date().toISOString();
  
  return new Promise((resolve) => {
    const requestOptions = {
      hostname: 'localhost',
      port: 3002,
      path: WEBHOOK_ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Event-Id': event.id
      }
    };
    
    const req = http.request(requestOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({
            success: res.statusCode === 200,
            status: res.statusCode,
            eventId: event.id,
            response
          });
        } catch (err) {
          resolve({
            success: false,
            error: 'invalid_response',
            eventId: event.id,
            status: res.statusCode
          });
        }
      });
    });
    
    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
        eventId: event.id
      });
    });
    
    req.write(payload);
    req.end();
  });
}

/**
 * Simulates dropped webhook delivery
 * @param {object} event - Event to "send"
 * @returns {Promise<object>} Simulated failure result
 */
async function simulateDroppedDelivery(event) {
  return sendWebhook(event, { simulateDrop: true });
}

/**
 * Simulates delayed webhook delivery
 * @param {object} event - Event to send
 * @param {number} delayMs - Delay in milliseconds
 * @returns {Promise<object>} Delivery result
 */
async function simulateDelayedDelivery(event, delayMs) {
  return sendWebhook(event, { simulateDelay: delayMs });
}

/**
 * Simulates duplicate webhook delivery
 * @param {object} event - Event to send multiple times
 * @param {number} count - Number of times to send
 * @returns {Promise<array>} Array of delivery results
 */
async function simulateDuplicateDelivery(event, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const result = await sendWebhook(event);
    results.push(result);
  }
  return results;
}

/**
 * Simulates out-of-order webhook delivery
 * @param {array} events - Events to send out of order
 * @returns {Promise<array>} Array of delivery results
 */
async function simulateOutOfOrderDelivery(events) {
  // Shuffle events to simulate out-of-order delivery
  const shuffled = [...events].sort(() => Math.random() - 0.5);
  const results = [];
  
  for (const event of shuffled) {
    const result = await sendWebhook(event);
    results.push(result);
  }
  
  return results;
}

module.exports = {
  sendWebhook,
  simulateDroppedDelivery,
  simulateDelayedDelivery,
  simulateDuplicateDelivery,
  simulateOutOfOrderDelivery
};
